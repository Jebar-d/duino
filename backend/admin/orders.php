<?php

declare(strict_types=1);

session_start();
header('Access-Control-Allow-Origin: http://localhost:3000');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); echo json_encode(['success'=>false,'message'=>'Method not allowed.']); exit; }
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';

try {
    $pdo = getDatabaseConnection();
    requireAdmin($pdo);
    $page = filter_var($_GET['page'] ?? 1, FILTER_VALIDATE_INT);
    $limit = filter_var($_GET['limit'] ?? 20, FILTER_VALIDATE_INT);
    if ($page === false || $page < 1 || $limit === false || $limit < 1) {
        http_response_code(422);
        echo json_encode(['success'=>false,'message'=>'page and limit must be positive integers.']);
        exit;
    }
    $limit = min(100, $limit);
    $offset = ($page - 1) * $limit;
    $status = trim((string)($_GET['status'] ?? ''));
    $where = $status !== '' ? ' WHERE o.status = :status' : '';

    $count = $pdo->prepare('SELECT COUNT(*) FROM orders o' . $where);
    if ($status !== '') { $count->execute(['status'=>$status]); }
    else { $count->execute(); }
    $total = (int)$count->fetchColumn();

    $query = $pdo->prepare('SELECT o.*, u.email AS customer_email FROM orders o LEFT JOIN users u ON u.id = o.user_id' . $where . ' ORDER BY o.created_at DESC LIMIT :limit OFFSET :offset');
    if ($status !== '') { $query->bindValue(':status', $status); }
    $query->bindValue(':limit', $limit, PDO::PARAM_INT);
    $query->bindValue(':offset', $offset, PDO::PARAM_INT);
    $query->execute();

    echo json_encode([
        'success' => true,
        'orders' => $query->fetchAll(PDO::FETCH_ASSOC),
        'pagination' => [
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
            'pages' => (int)ceil($total / $limit),
        ],
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    error_log('Admin orders list error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success'=>false,'message'=>'Unable to load orders.']);
}
