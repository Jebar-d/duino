<?php

declare(strict_types=1);

session_start();
header('Access-Control-Allow-Origin: http://localhost:3000');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
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
require_once __DIR__ . '/../config/auth.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid request body.']);
    exit;
}

$orderId = trim((string) ($input['order_id'] ?? ''));
$reason = $input['reason'] ?? null;
if ($orderId === '' || !is_string($reason)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'order_id and reason are required.']);
    exit;
}
$reason = trim($reason);
$reasonLength = mb_strlen($reason);
if ($reasonLength < 10 || $reasonLength > 500) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'reason must be between 10 and 500 characters.']);
    exit;
}

try {
    $pdo = getDatabaseConnection();
    $pdo->beginTransaction();

    $orderQuery = $pdo->prepare(
        'SELECT id, user_id, status, created_at
         FROM orders
         WHERE id = :order_id AND user_id = :user_id
         FOR UPDATE'
    );
    $orderQuery->execute([
        'order_id' => $orderId,
        'user_id' => $_SESSION['user_id'],
    ]);
    $order = $orderQuery->fetch(PDO::FETCH_ASSOC);
    if (!$order) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Order not found.']);
        exit;
    }
    if (!in_array($order['status'], ['paid', 'shipped', 'delivered', 'completed'], true)) {
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'This order is not eligible for a refund request.']);
        exit;
    }

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
        'history_order_id' => $orderId,
        'created_at' => $order['created_at'],
    ]);
    $ageInSeconds = $refundWindowQuery->fetchColumn();
    if (
        $ageInSeconds === false
        || $ageInSeconds === null
        || (int) $ageInSeconds < 0
        || (int) $ageInSeconds > 7 * 24 * 60 * 60
    ) {
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'Refund requests must be made within 7 days of delivery.']);
        exit;
    }

    $existingQuery = $pdo->prepare('SELECT id FROM refund_requests WHERE order_id = :order_id FOR UPDATE');
    $existingQuery->execute(['order_id' => $orderId]);
    if ($existingQuery->fetchColumn()) {
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'A refund request already exists for this order.']);
        exit;
    }

    $refundId = newUuid();
    $insert = $pdo->prepare(
        "INSERT INTO refund_requests (id, order_id, user_id, reason, status)
         VALUES (:id, :order_id, :user_id, :reason, 'pending')"
    );
    $insert->execute([
        'id' => $refundId,
        'order_id' => $orderId,
        'user_id' => $_SESSION['user_id'],
        'reason' => $reason,
    ]);

    $history = $pdo->prepare(
        'INSERT INTO order_status_history (order_id, status, note)
         VALUES (:order_id, :status, :note)'
    );
    $history->execute([
        'order_id' => $orderId,
        'status' => 'refund_requested',
        'note' => $reason,
    ]);

    $notification = $pdo->prepare(
        "INSERT INTO notifications (user_id, order_id, type, title, message)
         VALUES (:user_id, :order_id, 'refund', :title, :message)"
    );
    $notification->execute([
        'user_id' => $_SESSION['user_id'],
        'order_id' => $orderId,
        'title' => 'Refund request received',
        'message' => 'Your refund request is pending review.',
    ]);

    $pdo->commit();
    echo json_encode([
        'success' => true,
        'message' => 'Refund request submitted.',
        'refund_request' => [
            'id' => $refundId,
            'order_id' => $orderId,
            'status' => 'pending',
            'reason' => $reason,
        ],
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Customer refund request error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to submit refund request.']);
}
