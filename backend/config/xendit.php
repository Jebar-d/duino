<?php

declare(strict_types=1);

require_once __DIR__ . '/../config.php';

class XenditException extends RuntimeException
{
    public int $httpStatus;

    public function __construct(string $message, int $httpStatus = 0)
    {
        parent::__construct($message);
        $this->httpStatus = $httpStatus;
    }
}

function xenditIsOnlineMethod(string $method): bool
{
    return in_array($method, ['gcash', 'maya', 'card'], true);
}

function xenditIsConfigured(): bool
{
    return defined('XENDIT_SECRET_KEY') && XENDIT_SECRET_KEY !== '' && str_starts_with(XENDIT_SECRET_KEY, 'xnd_');
}

function xenditNotConfiguredMessage(): string
{
    return 'Online payment is not configured yet. Please choose Cash on Delivery.';
}

function xenditRequest(string $method, string $path, ?array $payload = null): array
{
    if (!xenditIsConfigured()) {
        throw new XenditException(xenditNotConfiguredMessage());
    }
    $base = rtrim((string)(getenv('XENDIT_API_BASE_URL') ?: 'https://api.xendit.co'), '/');
    $curl = curl_init($base . $path);
    $options = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPAUTH => CURLAUTH_BASIC,
        CURLOPT_USERPWD => XENDIT_SECRET_KEY . ':',
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => ['Accept: application/json', 'Content-Type: application/json'],
        CURLOPT_CUSTOMREQUEST => strtoupper($method),
    ];
    if ($payload !== null) {
        $options[CURLOPT_POSTFIELDS] = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }
    if (defined('XENDIT_CA_BUNDLE') && XENDIT_CA_BUNDLE !== '') {
        $options[CURLOPT_CAINFO] = XENDIT_CA_BUNDLE;
    }
    curl_setopt_array($curl, $options);
    $raw = curl_exec($curl);
    $http = (int)curl_getinfo($curl, CURLINFO_HTTP_CODE);
    $curlError = curl_error($curl);
    curl_close($curl);
    $body = is_string($raw) ? json_decode($raw, true) : null;
    if ($curlError !== '' || $http < 200 || $http >= 300 || !is_array($body)) {
        $errorCode = is_array($body) ? (string)($body['error_code'] ?? $body['code'] ?? '') : '';
        $message = is_array($body) ? (string)($body['message'] ?? '') : '';
        error_log('Xendit request failed: HTTP ' . $http . ' error_code=' . $errorCode . ' message=' . $message . ' transport=' . $curlError);
        throw new XenditException('Unable to process online payment. Please try again.', $http);
    }
    return $body;
}

function xenditCreateInvoice(array $order): array
{
    $methodMap = ['gcash' => 'GCASH', 'maya' => 'PAYMAYA', 'card' => 'CREDIT_CARD'];
    $method = (string)$order['payment_method'];
    if (!isset($methodMap[$method])) {
        throw new XenditException('This order does not use online payment.');
    }
    $address = is_array($order['shipping_address']) ? $order['shipping_address'] : json_decode((string)$order['shipping_address'], true);
    if (!is_array($address)) {
        $address = [];
    }
    $givenName = trim((string)($address['given_names'] ?? $address['first_name'] ?? ''));
    $surname = trim((string)($address['surname'] ?? $address['last_name'] ?? ''));
    $name = trim((string)($address['name'] ?? $address['full_name'] ?? trim($givenName . ' ' . $surname) ?: 'Customer'));
    $parts = preg_split('/\s+/', $name, 2) ?: ['Customer'];
    $base = defined('FRONTEND_URL') ? FRONTEND_URL : 'http://localhost:3000';
    $redirect = rtrim((string)$base, '/') . '/order-complete?order=' . rawurlencode((string)$order['id']);
    $payload = [
        'external_id' => 'duino-' . $order['id'] . '-' . bin2hex(random_bytes(4)),
        'amount' => ((int)$order['total_cents']) / 100,
        'currency' => 'PHP',
        'description' => 'Duino order ' . $order['id'],
        'invoice_duration' => 3600,
        'success_redirect_url' => $redirect,
        'failure_redirect_url' => $redirect,
        'payment_methods' => [$methodMap[$method]],
        'customer' => ['given_names' => $givenName !== '' ? $givenName : $parts[0], 'surname' => $surname !== '' ? $surname : ($parts[1] ?? ''), 'email' => (string)$order['email']],
    ];
    try {
        $invoice = xenditRequest('POST', '/v2/invoices', $payload);
    } catch (XenditException $e) {
        if ($e->httpStatus !== 400) {
            throw $e;
        }
        error_log('Xendit rejected payment_methods; retrying without the field.');
        // Retry only when the provider specifically rejects the payment method field.
        $payloadWithoutMethods = $payload;
        unset($payloadWithoutMethods['payment_methods']);
        try {
            $invoice = xenditRequest('POST', '/v2/invoices', $payloadWithoutMethods);
        } catch (XenditException $retryError) {
            throw $retryError;
        }
    }
    if (empty($invoice['id']) || empty($invoice['invoice_url'])) {
        throw new XenditException('Unable to process online payment. Please try again.');
    }
    return $invoice;
}

function xenditGetInvoice(string $invoiceId): array
{
    return xenditRequest('GET', '/v2/invoices/' . rawurlencode($invoiceId));
}

function xenditApplyInvoice(PDO $pdo, string $orderId, array $invoice): void
{
    $notify = null;
    try {
        $pdo->beginTransaction();
        $query = $pdo->prepare('SELECT id, user_id, total_cents, status, payment_status, payment_reference FROM orders WHERE id = :id FOR UPDATE');
        $query->execute(['id' => $orderId]);
        $order = $query->fetch(PDO::FETCH_ASSOC);
        if (!$order || (string)$order['payment_reference'] !== (string)($invoice['id'] ?? '') || !str_starts_with((string)($invoice['external_id'] ?? ''), 'duino-' . $orderId . '-')) {
            throw new XenditException('Payment invoice does not match this order.');
        }
        $status = strtoupper((string)($invoice['status'] ?? ''));
        if (in_array($status, ['PAID', 'SETTLED'], true)) {
            if ((int)round(((float)($invoice['amount'] ?? 0)) * 100) !== (int)$order['total_cents'] || strtoupper((string)($invoice['currency'] ?? '')) !== 'PHP') {
                throw new XenditException('Payment amount does not match this order.');
            }
            if ($order['payment_status'] !== 'paid') {
                $update = $pdo->prepare("UPDATE orders SET payment_status = 'paid', status = IF(status = 'pending', 'paid', status) WHERE id = :id");
                $update->execute(['id' => $orderId]);
                $history = $pdo->prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (:id, :status, :note)');
                $history->execute(['id' => $orderId, 'status' => $order['status'] === 'pending' ? 'paid' : $order['status'], 'note' => 'Payment received']);
                $notify = ['user_id' => $order['user_id'], 'type' => 'payment', 'title' => 'Payment received', 'message' => 'Payment received for your order.'];
            }
        } elseif ($status === 'EXPIRED' && $order['payment_status'] !== 'paid') {
            $cancel = $order['status'] === 'pending';
            $update = $pdo->prepare("UPDATE orders SET payment_status = 'expired', cancelled_at = IF(status = 'pending', NOW(), cancelled_at), cancel_reason = IF(status = 'pending', 'Online payment expired', cancel_reason), status = IF(status = 'pending', 'cancelled', status) WHERE id = :id");
            $update->execute(['id' => $orderId]);
            if ($cancel) {
                $items = $pdo->prepare('SELECT product_id, variant_id, qty FROM order_items WHERE order_id = :id');
                $items->execute(['id' => $orderId]);
                foreach ($items->fetchAll(PDO::FETCH_ASSOC) as $item) {
                    $restore = $item['variant_id'] !== null
                        ? $pdo->prepare('UPDATE variants SET stock = stock + :qty WHERE id = :id')
                        : $pdo->prepare('UPDATE products SET stock = stock + :qty WHERE id = :id');
                    $restore->execute(['qty' => $item['qty'], 'id' => $item['variant_id'] ?? $item['product_id']]);
                }
                $history = $pdo->prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (:id, :status, :note)');
                $history->execute(['id' => $orderId, 'status' => 'cancelled', 'note' => 'Online payment expired']);
                $notify = ['user_id' => $order['user_id'], 'type' => 'order_update', 'title' => 'Order update', 'message' => 'Your order was cancelled because online payment expired.'];
            }
        } elseif ($status !== 'PENDING' && $status !== 'EXPIRED') {
            throw new XenditException('Unable to process online payment. Please try again.');
        }
        $pdo->commit();
    } catch (XenditException $e) {
        if ($pdo->inTransaction()) { $pdo->rollBack(); }
        throw $e;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) { $pdo->rollBack(); }
        error_log('Xendit invoice update failed: ' . $e->getMessage());
        throw new XenditException('Unable to update payment status. Please try again.');
    }
    if ($notify !== null && $notify['user_id'] !== null) {
        try {
            $statement = $pdo->prepare('INSERT INTO notifications (user_id, order_id, type, title, message) VALUES (:user_id, :order_id, :type, :title, :message)');
            $statement->execute($notify + ['order_id' => $orderId]);
        } catch (Throwable $e) {
            error_log('Xendit notification failed: ' . $e->getMessage());
        }
    }
}

function xenditSyncOrder(PDO $pdo, string $orderId, string $invoiceId): array
{
    $invoice = xenditGetInvoice($invoiceId);
    xenditApplyInvoice($pdo, $orderId, $invoice);
    return $invoice;
}
