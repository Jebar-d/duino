<?php

declare(strict_types=1);

function buildOrderResponse(PDO $pdo, array $order): array
{
    $itemQuery = $pdo->prepare('SELECT id, order_id, product_id, variant_id, qty, price_cents, product_name, product_img FROM order_items WHERE order_id = :order_id ORDER BY id ASC');
    $itemQuery->execute(['order_id' => $order['id']]);
    $items = $itemQuery->fetchAll(PDO::FETCH_ASSOC);
    foreach ($items as &$item) {
        $item['qty'] = (int)$item['qty'];
        $item['price_cents'] = (int)$item['price_cents'];
        $item['subtotal_cents'] = $item['qty'] * $item['price_cents'];
    }
    unset($item);

    $shippingAddress = null;
    if (!empty($order['shipping_address'])) {
        $decoded = is_string($order['shipping_address'])
            ? json_decode($order['shipping_address'], true)
            : $order['shipping_address'];
        if (is_array($decoded)) {
            $shippingAddress = $decoded;
        }
    }

    $order['total_cents'] = (int)$order['total_cents'];
    $order['email_confirmed'] = (bool)($order['email_confirmed'] ?? false);
    $order['items'] = $items;
    $order['item_count'] = array_sum(array_column($items, 'qty'));
    $order['shipping_address'] = $shippingAddress;

    $tableCheck = $pdo->prepare('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :table_name');
    $tableCheck->execute(['table_name' => 'order_status_history']);
    if ((int)$tableCheck->fetchColumn() > 0) {
        $historyQuery = $pdo->prepare('SELECT * FROM order_status_history WHERE order_id = :order_id ORDER BY created_at ASC');
        $historyQuery->execute(['order_id' => $order['id']]);
        $order['history'] = $historyQuery->fetchAll(PDO::FETCH_ASSOC);
    } else {
        $order['history'] = [];
    }

    return $order;
}

function addOrderRefundAndActions(PDO $pdo, array $order): array
{
    $refundQuery = $pdo->prepare(
        'SELECT id, status, reason, admin_note, created_at
         FROM refund_requests
         WHERE order_id = :order_id
         LIMIT 1'
    );
    $refundQuery->execute(['order_id' => $order['id']]);
    $refund = $refundQuery->fetch(PDO::FETCH_ASSOC);

    $order['refund_request'] = $refund ?: null;
    $order['can_cancel'] = $order['status'] === 'pending'
        || ($order['status'] === 'paid' && ($order['tracking_status'] ?? null) === 'processing');

    $eligibleStatus = in_array(
        $order['status'],
        ['paid', 'shipped', 'delivered', 'completed'],
        true
    );
    $refundWindowQuery = $pdo->prepare(
        "SELECT TIMESTAMPDIFF(
            SECOND,
            COALESCE(
                (
                    SELECT created_at
                    FROM order_status_history
                    WHERE order_id = :history_order_id AND status = 'delivered'
                    ORDER BY created_at DESC
                    LIMIT 1
                ),
                :created_at
            ),
            NOW()
        )"
    );
    $refundWindowQuery->execute([
        'history_order_id' => $order['id'],
        'created_at' => $order['created_at'],
    ]);
    $ageInSeconds = $refundWindowQuery->fetchColumn();
    $withinRefundWindow = $ageInSeconds !== false
        && $ageInSeconds !== null
        && (int) $ageInSeconds >= 0
        && (int) $ageInSeconds <= 7 * 24 * 60 * 60;

    $order['can_request_refund'] = $eligibleStatus
        && $refund === false
        && $withinRefundWindow;

    return $order;
}
