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

    $conditions = [];
    $params = [];
    foreach (['product_id', 'variant_id', 'order_id'] as $filter) {
        if (isset($_GET[$filter]) && is_string($_GET[$filter]) && trim($_GET[$filter]) !== '') {
            $conditions[] = "st.{$filter} = :{$filter}";
            $params[$filter] = trim($_GET[$filter]);
        }
    }
    $where = $conditions === [] ? '' : 'WHERE ' . implode(' AND ', $conditions);
    $limit = filter_var($_GET['limit'] ?? 50, FILTER_VALIDATE_INT);
    if ($limit === false || $limit < 1 || $limit > 100) {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'limit must be between 1 and 100.']);
        exit;
    }

    $query = $pdo->prepare(
        "SELECT st.*, p.name AS product_name, p.sku,
                v.variant_name, v.option_value,
                u.email AS actor_email
         FROM stock_transactions st
         INNER JOIN products p ON p.id = st.product_id
         LEFT JOIN variants v ON v.id = st.variant_id
         LEFT JOIN users u ON u.id = st.actor_id
         {$where}
         ORDER BY st.created_at DESC, st.id DESC
         LIMIT {$limit}"
    );
    $query->execute($params);
    $transactions = $query->fetchAll(PDO::FETCH_ASSOC);
    foreach ($transactions as &$transaction) {
        foreach (['quantity', 'stock_before', 'stock_after'] as $field) {
            $transaction[$field] = (int) $transaction[$field];
        }
    }
    unset($transaction);

    echo json_encode(['success' => true, 'transactions' => $transactions], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Throwable $e) {
    error_log('Stock transaction history failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to load stock transactions.']);
}
