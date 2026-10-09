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

    $productCount = (int) $pdo->query('SELECT COUNT(*) FROM products')->fetchColumn();
    $orderCount = (int) $pdo->query('SELECT COUNT(*) FROM orders')->fetchColumn();
    $userCount = (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
    $promoCount = (int) $pdo->query('SELECT COUNT(*) FROM promos')->fetchColumn();
    $revenueCents = (int) $pdo->query(
        "SELECT COALESCE(SUM(total_cents), 0) FROM orders WHERE status IN ('paid', 'delivered')"
    )->fetchColumn();

    $recentQuery = $pdo->query(
        'SELECT o.id, o.total_cents, o.status, o.created_at, o.payment_method, o.user_id, u.email AS customer_email
         FROM orders o
         LEFT JOIN users u ON u.id = o.user_id
         ORDER BY o.created_at DESC
         LIMIT 5'
    );
    $recentOrders = $recentQuery->fetchAll(PDO::FETCH_ASSOC);

    foreach ($recentOrders as &$order) {
        $order['total_cents'] = (int) $order['total_cents'];
    }

    unset($order);

    echo json_encode([
        'success' => true,
        'dashboard' => [
            'product_count' => $productCount,
            'order_count' => $orderCount,
            'user_count' => $userCount,
            'promo_count' => $promoCount,
            'revenue_cents' => $revenueCents,
            'recent_orders' => $recentOrders
        ]
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    error_log('Arduino Store admin dashboard error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to load dashboard.']);
}
