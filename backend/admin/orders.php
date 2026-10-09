<?php

declare(strict_types=1);

session_start();
header('Access-Control-Allow-Origin: http://localhost:3000');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';

try {
    $pdo = getDatabaseConnection();
    requireAdmin($pdo);

    $page = filter_var($_GET['page'] ?? 1, FILTER_VALIDATE_INT);
    if ($page === false || $page < 1) {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'page must be a positive integer.']);
        exit;
    }

    $limit = 20;
    $offset = ($page - 1) * $limit;
    $status = trim((string) ($_GET['status'] ?? ''));
    $search = trim((string) ($_GET['search'] ?? ''));
    $allowedStatuses = [
        'pending', 'paid', 'processing', 'shipped',
        'delivered', 'completed', 'cancelled', 'refunded',
    ];
    if ($status !== '' && !in_array($status, $allowedStatuses, true)) {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Invalid order status.']);
        exit;
    }

    $conditions = [];
    $params = [];
    if ($status !== '') {
        $conditions[] = 'o.status = :status';
        $params['status'] = $status;
    }
    if ($search !== '') {
        $conditions[] = '(o.id LIKE :order_search OR u.email LIKE :email_search)';
        $searchValue = '%' . $search . '%';
        $params['order_search'] = $searchValue;
        $params['email_search'] = $searchValue;
    }
    $where = $conditions === [] ? '' : ' WHERE ' . implode(' AND ', $conditions);

    $count = $pdo->prepare(
        'SELECT COUNT(DISTINCT o.id)
         FROM orders o
         LEFT JOIN users u ON u.id = o.user_id' . $where
    );
    $count->execute($params);
    $total = (int) $count->fetchColumn();

    $query = $pdo->prepare(
        'SELECT
            o.id,
            o.user_id,
            o.total_cents,
            o.status,
            o.created_at,
            o.payment_method,
            o.payment_status,
            o.tracking_status,
            o.expected_delivery,
            o.shipping_method,
            u.email AS customer_email,
            COALESCE(item_totals.item_count, 0) AS item_count
         FROM orders o
         LEFT JOIN users u ON u.id = o.user_id
         LEFT JOIN (
            SELECT order_id, SUM(qty) AS item_count
            FROM order_items
            GROUP BY order_id
         ) item_totals ON item_totals.order_id = o.id' . $where . '
         ORDER BY o.created_at DESC
         LIMIT :limit OFFSET :offset'
    );
    foreach ($params as $name => $value) {
        $query->bindValue(':' . $name, $value);
    }
    $query->bindValue(':limit', $limit, PDO::PARAM_INT);
    $query->bindValue(':offset', $offset, PDO::PARAM_INT);
    $query->execute();
    $orders = $query->fetchAll(PDO::FETCH_ASSOC);
    foreach ($orders as &$order) {
        $order['total_cents'] = (int) $order['total_cents'];
        $order['item_count'] = (int) $order['item_count'];
    }
    unset($order);

    echo json_encode([
        'success' => true,
        'orders' => $orders,
        'pagination' => [
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
            'pages' => (int) ceil($total / $limit),
        ],
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    error_log('Admin orders list error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to load orders.']);
}
