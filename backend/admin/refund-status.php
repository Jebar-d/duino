<?php

declare(strict_types=1);

session_start();
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: http://localhost:3000');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../config/inventory.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid request body.']);
    exit;
}

$refundId = trim((string) ($input['id'] ?? ''));
$status = $input['status'] ?? null;
$adminNote = $input['admin_note'] ?? null;
if ($refundId === '' || !is_string($status) || !in_array($status, ['approved', 'rejected'], true)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'A refund request ID and valid status are required.']);
    exit;
}
if ($adminNote !== null && !is_string($adminNote)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'admin_note must be a string.']);
    exit;
}
$adminNote = $adminNote === null ? null : trim($adminNote);
if ($adminNote !== null && mb_strlen($adminNote) > 5000) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'admin_note is too long.']);
    exit;
}

try {
    $pdo = getDatabaseConnection();
    requireAdmin($pdo);
    $pdo->beginTransaction();

    $details = $pdo->prepare(
        'SELECT r.user_id, r.order_id, o.status AS order_status
         FROM refund_requests r
         INNER JOIN orders o ON o.id = r.order_id
         WHERE r.id = :id
         FOR UPDATE'
    );
    $details->execute(['id' => $refundId]);
    $refund = $details->fetch(PDO::FETCH_ASSOC);
    if (!$refund) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Refund request not found.']);
        exit;
    }

    if ($status === 'approved' && $refund['order_status'] === 'refunded') {
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'This order has already been refunded.']);
        exit;
    }

    $updateRefund = $pdo->prepare(
        "UPDATE refund_requests
         SET status = :status, admin_note = :admin_note, resolved_at = NOW()
         WHERE id = :id AND status = 'pending'"
    );
    $updateRefund->execute([
        'id' => $refundId,
        'status' => $status,
        'admin_note' => $adminNote,
    ]);
    if ($updateRefund->rowCount() !== 1) {
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'Refund request has already been resolved.']);
        exit;
    }

    if ($status === 'approved') {
        if ($refund['order_status'] !== 'cancelled') {
            $items = $pdo->prepare(
                'SELECT id, product_id, variant_id, qty
                 FROM order_items
                 WHERE order_id = :order_id'
            );
            $items->execute(['order_id' => $refund['order_id']]);
            foreach ($items->fetchAll(PDO::FETCH_ASSOC) as $item) {
                if ($item['product_id'] !== null) {
                    changeInventoryStock(
                        $pdo,
                        (string) $item['product_id'],
                        $item['variant_id'] !== null ? (string) $item['variant_id'] : null,
                        (int) $item['qty'],
                        'Refund approved: stock restored',
                        (string) $_SESSION['user_id'],
                        (string) $refund['order_id'],
                        (string) $item['id'],
                        'order-refund-restore:' . $item['id']
                    );
                }
            }
        }

        $updateOrder = $pdo->prepare("UPDATE orders SET status = 'refunded' WHERE id = :order_id");
        $updateOrder->execute(['order_id' => $refund['order_id']]);

        $history = $pdo->prepare(
            'INSERT INTO order_status_history (order_id, status, note)
             VALUES (:order_id, :status, :note)'
        );
        $history->execute([
            'order_id' => $refund['order_id'],
            'status' => 'refunded',
            'note' => $adminNote !== null && $adminNote !== ''
                ? $adminNote
                : 'Refund approved.',
        ]);
    }

    $notification = $pdo->prepare(
        "INSERT INTO notifications (user_id, order_id, type, title, message)
         VALUES (:user_id, :order_id, 'refund', :title, :message)"
    );
    $notification->execute([
        'user_id' => $refund['user_id'],
        'order_id' => $refund['order_id'],
        'title' => 'Refund ' . $status,
        'message' => $adminNote !== null && $adminNote !== ''
            ? 'Your refund request was ' . $status . '. ' . $adminNote
            : 'Your refund request was ' . $status . '.',
    ]);

    $pdo->commit();
    echo json_encode([
        'success' => true,
        'message' => 'Refund request ' . $status . ' successfully.',
    ]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Arduino Store refund status error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to update refund request.']);
}
