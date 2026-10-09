<?php

declare(strict_types=1);

session_start();

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: http://localhost:3000');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Authentication required.']);
    exit;
}

require_once __DIR__ . '/../config/database.php';

$id = trim((string) ($_GET['id'] ?? ''));

if ($id === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Order ID is required.']);
    exit;
}

try {
    $pdo = getDatabaseConnection();
    $adminQuery = $pdo->prepare(
        'SELECT role FROM users WHERE id = :id LIMIT 1'
    );
    $adminQuery->execute(['id' => $_SESSION['user_id']]);
    $admin = $adminQuery->fetch();

    if (!$admin || $admin['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Administrator access required.']);
        exit;
    }

    $orderQuery = $pdo->prepare(
        'SELECT id, user_id, total_cents, status, shipping_address, created_at, shipping_method, payment_method
         FROM orders
         WHERE id = :id
         LIMIT 1'
    );
    $orderQuery->execute(['id' => $id]);
    $order = $orderQuery->fetch(PDO::FETCH_ASSOC);

    if (!$order) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Order not found.']);
        exit;
    }

    $itemQuery = $pdo->prepare(
        'SELECT id, product_id, variant_id, qty, price_cents, product_name, product_img
         FROM order_items
         WHERE order_id = :id
         ORDER BY id ASC'
    );
    $itemQuery->execute(['id' => $id]);
    $items = $itemQuery->fetchAll(PDO::FETCH_ASSOC);

    foreach ($items as &$item) {
        $item['qty'] = (int) $item['qty'];
        $item['price_cents'] = (int) $item['price_cents'];
        $item['subtotal_cents'] = $item['qty'] * $item['price_cents'];
    }

    unset($item);

    $order['total_cents'] = (int) $order['total_cents'];
    $order['items'] = $items;

    echo json_encode(['success' => true, 'order' => $order], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    error_log('Arduino Store admin refund order error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to load order.']);
}
