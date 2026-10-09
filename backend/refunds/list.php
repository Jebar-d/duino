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

if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Authentication required.']);
    exit;
}

require_once __DIR__ . '/../config/database.php';

try {
    $pdo = getDatabaseConnection();
    $query = $pdo->prepare(
        'SELECT
            r.id,
            r.order_id,
            r.reason,
            r.status,
            r.admin_note,
            r.created_at,
            r.resolved_at,
            o.total_cents,
            o.status AS order_status,
            o.created_at AS order_created_at
         FROM refund_requests r
         INNER JOIN orders o ON o.id = r.order_id
         WHERE r.user_id = :user_id
         ORDER BY r.created_at DESC'
    );
    $query->execute(['user_id' => $_SESSION['user_id']]);
    $refunds = $query->fetchAll(PDO::FETCH_ASSOC);
    foreach ($refunds as &$refund) {
        $refund['total_cents'] = (int) $refund['total_cents'];
    }
    unset($refund);

    echo json_encode(['success' => true, 'refunds' => $refunds], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    error_log('Customer refund list error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to load refund requests.']);
}
