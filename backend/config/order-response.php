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
