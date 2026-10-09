<?php

declare(strict_types=1);

ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);
header('Access-Control-Allow-Origin: http://localhost:3000');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

class CustomerOrderUpdateException extends RuntimeException
{
    public int $httpStatus;

    public function __construct(int $httpStatus, string $message)
    {
        parent::__construct($message);
        $this->httpStatus = $httpStatus;
    }
}

function customerOrderError(int $status, string $message): never
{
    throw new CustomerOrderUpdateException($status, $message);
}

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        customerOrderError(405, 'Method not allowed.');
    }

    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'samesite' => 'Lax', 'secure' => false, 'httponly' => true]);
    session_start();
    if (empty($_SESSION['user_id'])) {
        customerOrderError(401, 'You must be logged in.');
    }

    require_once __DIR__ . '/../config/database.php';
    require_once __DIR__ . '/../config/auth.php';
    require_once __DIR__ . '/../config/inventory.php';
    require_once __DIR__ . '/../config/promos.php';
    require_once __DIR__ . '/../config/order-response.php';

    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        customerOrderError(400, 'Invalid request body.');
    }
    $orderId = $input['order_id'] ?? null;
    $hasAddress = array_key_exists('shipping_address', $input);
    $hasItems = array_key_exists('items', $input);
    if (!is_string($orderId) || trim($orderId) === '' || $hasAddress === $hasItems) {
        customerOrderError(422, 'Provide order_id and either shipping_address or items.');
    }
    $orderId = trim($orderId);
    $cleanAddress = null;
    if ($hasAddress) {
        $address = $input['shipping_address'];
        if (!is_array($address)) {
            customerOrderError(422, 'shipping_address must be an object.');
        }
        $fields = ['first_name', 'middle_name', 'last_name', 'suffix', 'address_line', 'city', 'province', 'postal_code', 'contact_number'];
        $cleanAddress = [];
        foreach ($fields as $field) {
            $value = $address[$field] ?? '';
            if (!is_string($value)) {
                customerOrderError(422, 'Address fields must be strings.');
            }
            $cleanAddress[$field] = trim(strip_tags($value));
        }
        if ($cleanAddress['first_name'] === '' || $cleanAddress['last_name'] === '' || $cleanAddress['address_line'] === '') {
            customerOrderError(422, 'first_name, last_name, and address_line are required.');
        }
        if (!preg_match('/^\d{4}$/', $cleanAddress['postal_code'])) {
            customerOrderError(422, 'postal_code must contain 4 digits.');
        }
        if (!preg_match('/^\d{11,13}$/', $cleanAddress['contact_number'])) {
            customerOrderError(422, 'contact_number must contain 11 to 13 digits.');
        }
    }

    $pdo = getDatabaseConnection();
    $pdo->beginTransaction();
    $orderQuery = $pdo->prepare('SELECT id, user_id, total_cents, promo_code, status, shipping_address, created_at, shipping_method, payment_method, payment_status, tracking_status, expected_delivery, cancelled_at, cancel_reason, notes, email_confirmed FROM orders WHERE id = :id AND user_id = :user_id LIMIT 1 FOR UPDATE');
    $orderQuery->execute(['id' => $orderId, 'user_id' => $_SESSION['user_id']]);
    $order = $orderQuery->fetch(PDO::FETCH_ASSOC);
    if (!$order) {
        $pdo->rollBack();
        customerOrderError(404, 'Order not found.');
    }
    $status = strtolower((string)$order['status']);
    $tracking = strtolower((string)$order['tracking_status']);
    $online = in_array(strtolower((string)$order['payment_method']), ['gcash', 'maya', 'card'], true);
    if ($status !== 'pending' || $tracking === 'shipped' || in_array($status, ['cancelled', 'refunded'], true) || ($online && strtolower((string)$order['payment_status']) === 'paid')) {
        $pdo->rollBack();
        customerOrderError(409, 'This order can no longer be edited.');
    }

    if ($hasAddress) {
        $update = $pdo->prepare('UPDATE orders SET shipping_address = :address WHERE id = :id');
        $update->execute(['address' => json_encode($cleanAddress, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), 'id' => $orderId]);
    } else {
        $items = $input['items'];
        if (!is_array($items) || count($items) < 1 || count($items) > 100) {
            customerOrderError(422, 'Order must contain at least one item.');
        }
        $oldItemsQuery = $pdo->prepare('SELECT id, product_id, variant_id, qty FROM order_items WHERE order_id = :id FOR UPDATE');
        $oldItemsQuery->execute(['id' => $orderId]);
        foreach ($oldItemsQuery->fetchAll(PDO::FETCH_ASSOC) as $oldItem) {
            if ($oldItem['product_id'] !== null) {
                changeInventoryStock(
                    $pdo,
                    (string) $oldItem['product_id'],
                    $oldItem['variant_id'] !== null ? (string) $oldItem['variant_id'] : null,
                    (int) $oldItem['qty'],
                    'Customer order item edit: stock released',
                    (string) $_SESSION['user_id'],
                    $orderId,
                    (string) $oldItem['id'],
                    'order-edit-release:' . $oldItem['id']
                );
            }
        }

        $newItems = [];
        $seen = [];
        $subtotalCents = 0;
        foreach ($items as $item) {
            if (!is_array($item)) {
                customerOrderError(422, 'Each item must be an object.');
            }
            $productId = $item['product_id'] ?? null;
            $variantId = $item['variant_id'] ?? null;
            $qty = filter_var($item['qty'] ?? null, FILTER_VALIDATE_INT);
            if (!is_string($productId) || trim($productId) === '' || strlen($productId) > 36 || ($variantId !== null && (!is_string($variantId) || trim($variantId) === '' || strlen($variantId) > 36)) || $qty === false || $qty < 1 || $qty > 1000) {
                customerOrderError(422, 'Each item needs valid product_id, variant_id, and qty values.');
            }
            $productId = trim($productId);
            $variantId = $variantId !== null ? trim($variantId) : null;
            $key = $productId . '|' . ($variantId ?? '');
            if (isset($seen[$key])) {
                customerOrderError(422, 'Duplicate order items are not allowed.');
            }
            $seen[$key] = true;

            $productQuery = $pdo->prepare('SELECT p.id, p.name, p.price_cents, p.stock, p.img_url, v.id AS matched_variant_id, v.stock AS variant_stock, v.price_adjustment FROM products p LEFT JOIN variants v ON v.id = :variant_id AND v.product_id = p.id WHERE p.id = :product_id LIMIT 1 FOR UPDATE');
            $productQuery->execute(['variant_id' => $variantId, 'product_id' => $productId]);
            $product = $productQuery->fetch(PDO::FETCH_ASSOC);
            if (!$product || ($variantId !== null && $product['matched_variant_id'] === null)) {
                customerOrderError(422, 'A selected product or variant is unavailable.');
            }
            $available = $variantId !== null ? (int)$product['variant_stock'] : (int)$product['stock'];
            if ($available < $qty) {
                customerOrderError(422, 'Requested quantity exceeds available stock for ' . $product['name'] . '.');
            }
            $price = (int)$product['price_cents'] + (int)($product['price_adjustment'] ?? 0);
            if ($price < 0) {
                customerOrderError(422, 'Product price is invalid.');
            }
            $newItemId = newUuid();
            changeInventoryStock(
                $pdo,
                $productId,
                $variantId,
                -$qty,
                'Customer order item edit',
                (string) $_SESSION['user_id'],
                $orderId,
                $newItemId,
                'order-edit-sale:' . $newItemId
            );
            $newItems[] = ['id' => $newItemId, 'product_id' => $productId, 'variant_id' => $variantId, 'qty' => $qty, 'price_cents' => $price, 'product_name' => $product['name'], 'product_img' => $product['img_url']];
            $subtotalCents += $price * $qty;
        }

        $discountCents = 0;
        $freeShipping = false;
        if (!empty($order['promo_code'])) {
            $promoQuery = $pdo->prepare('SELECT code, discount_percent, valid_from, valid_until, max_uses, used_count, is_free_shipping, min_order_cents FROM promos WHERE UPPER(code) = :code LIMIT 1 FOR UPDATE');
            $promoQuery->execute(['code' => strtoupper((string)$order['promo_code'])]);
            $promo = $promoQuery->fetch(PDO::FETCH_ASSOC);
            $now = new DateTimeImmutable('now', new DateTimeZone('Asia/Manila'));
            $promoStatus = $promo ? promoExpirationStatus($promo, $now) : 'invalid';
            if (!$promo || $promoStatus === 'expired' || $promoStatus === 'scheduled' || (!empty($promo['valid_from']) && $now < new DateTimeImmutable((string)$promo['valid_from'], new DateTimeZone('Asia/Manila'))) || $subtotalCents < (int)($promo['min_order_cents'] ?? 0) || ($promo['max_uses'] !== null && (int)$promo['max_uses'] > 0 && (int)$promo['used_count'] > (int)$promo['max_uses'])) {
                customerOrderError(409, 'The order promo is no longer valid; remove it before editing items.');
            }
            $percent = max(0, min(100, (int)($promo['discount_percent'] ?? 0)));
            $discountCents = min($subtotalCents, (int)round($subtotalCents * ($percent / 100)));
            $freeShipping = (int)($promo['is_free_shipping'] ?? 0) === 1;
        }
        $shippingCents = ($subtotalCents >= 150000 || $freeShipping) ? 0 : 9900;
        $totalCents = max(0, $subtotalCents - $discountCents) + $shippingCents;

        $deleteItems = $pdo->prepare('DELETE FROM order_items WHERE order_id = :id');
        $deleteItems->execute(['id' => $orderId]);
        $insertItem = $pdo->prepare('INSERT INTO order_items (id, order_id, product_id, variant_id, qty, price_cents, product_name, product_img) VALUES (:id, :order_id, :product_id, :variant_id, :qty, :price_cents, :product_name, :product_img)');
        foreach ($newItems as $item) {
            $insertItem->execute(['id' => $item['id'], 'order_id' => $orderId] + $item);
        }
        $updateOrder = $pdo->prepare('UPDATE orders SET total_cents = :total_cents WHERE id = :id');
        $updateOrder->execute(['total_cents' => $totalCents, 'id' => $orderId]);
    }

    $historyCheck = $pdo->prepare('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :table_name');
    $historyCheck->execute(['table_name' => 'order_status_history']);
    if ((int)$historyCheck->fetchColumn() > 0) {
        $history = $pdo->prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (:order_id, :status, :note)');
        $history->execute(['order_id' => $orderId, 'status' => $order['status'], 'note' => 'Customer updated the order.']);
    }
    $pdo->commit();

    try {
        $notification = $pdo->prepare("INSERT INTO notifications (user_id, order_id, type, title, message) VALUES (:user_id, :order_id, 'order_update', :title, :message)");
        $notification->execute(['user_id' => $_SESSION['user_id'], 'order_id' => $orderId, 'title' => 'Order updated', 'message' => 'Your order details have been updated.']);
    } catch (Throwable $notificationError) {
        error_log('Customer order update notification failed: ' . $notificationError->getMessage());
    }

    $responseQuery = $pdo->prepare('SELECT id, user_id, total_cents, promo_code, status, shipping_address, created_at, shipping_method, payment_method, payment_status, tracking_status, expected_delivery, cancelled_at, cancel_reason, notes, email_confirmed FROM orders WHERE id = :id AND user_id = :user_id LIMIT 1');
    $responseQuery->execute(['id' => $orderId, 'user_id' => $_SESSION['user_id']]);
    $updatedOrder = $responseQuery->fetch(PDO::FETCH_ASSOC);
    echo json_encode(['success' => true, 'message' => 'Order updated successfully.', 'order' => buildOrderResponse($pdo, $updatedOrder)], JSON_UNESCAPED_UNICODE);
} catch (CustomerOrderUpdateException $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code($e->httpStatus);
    echo json_encode(['success' => false, 'message' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
} catch (InventoryUnavailableException $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(409);
    echo json_encode(['success' => false, 'message' => $e->getMessage(), 'error_code' => 'INSUFFICIENT_STOCK'], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Customer order update failed: ' . $e->getMessage());
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode(['success' => false, 'message' => 'Unable to update order.'], JSON_UNESCAPED_UNICODE);
}
