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
require_once __DIR__ . '/../config/inventory.php';

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
if ($reason === '' || mb_strlen($reason) > 500) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'reason must be between 1 and 500 characters.']);
    exit;
}

try {
    $pdo = getDatabaseConnection();
    $pdo->beginTransaction();

    $orderQuery = $pdo->prepare(
        'SELECT id, user_id, status, tracking_status, payment_status, promo_code
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

    $canCancel = $order['status'] === 'pending'
        || ($order['status'] === 'paid' && $order['tracking_status'] === 'processing');
    if (!$canCancel) {
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode([
            'success' => false,
            'message' => 'This order can no longer be cancelled.'
        ]);
        exit;
    }

    $itemsQuery = $pdo->prepare(
        'SELECT id, product_id, variant_id, qty
         FROM order_items
         WHERE order_id = :order_id'
    );
    $itemsQuery->execute(['order_id' => $orderId]);
    foreach ($itemsQuery->fetchAll(PDO::FETCH_ASSOC) as $item) {
        if ($item['product_id'] !== null) {
            changeInventoryStock(
                $pdo,
                (string) $item['product_id'],
                $item['variant_id'] !== null ? (string) $item['variant_id'] : null,
                (int) $item['qty'],
                'Order cancelled: stock restored',
                (string) $_SESSION['user_id'],
                $orderId,
                (string) $item['id'],
                'order-cancel-restore:' . $item['id']
            );
        }
    }

    if ($order['promo_code'] !== null && $order['promo_code'] !== '') {
        $promoUpdate = $pdo->prepare(
            'UPDATE promos
             SET used_count = used_count - 1
             WHERE UPPER(code) = :code AND used_count > 0'
        );
        $promoUpdate->execute(['code' => strtoupper($order['promo_code'])]);
        if ($promoUpdate->rowCount() !== 1) {
            throw new RuntimeException('Unable to restore promo usage for the cancelled order.');
        }
    }

    $update = $pdo->prepare(
        "UPDATE orders
         SET status = 'cancelled', cancelled_at = NOW(), cancel_reason = :reason
         WHERE id = :order_id"
    );
    $update->execute([
        'reason' => $reason !== '' ? $reason : null,
        'order_id' => $orderId,
    ]);

    $history = $pdo->prepare(
        'INSERT INTO order_status_history (order_id, status, note)
         VALUES (:order_id, :status, :note)'
    );
    $history->execute([
        'order_id' => $orderId,
        'status' => 'cancelled',
        'note' => $reason !== '' ? $reason : 'Cancelled by customer.',
    ]);

    $refundRequestId = null;
    if ($order['payment_status'] === 'paid') {
        $existingRefund = $pdo->prepare(
            'SELECT id, status FROM refund_requests WHERE order_id = :order_id FOR UPDATE'
        );
        $existingRefund->execute(['order_id' => $orderId]);
        $existing = $existingRefund->fetch(PDO::FETCH_ASSOC);
        if ($existing && $existing['status'] !== 'pending') {
            throw new DomainException('A resolved refund request already exists for this order.');
        }
        if ($existing) {
            $refundRequestId = $existing['id'];
        } else {
            $refundRequestId = newUuid();
            $refundInsert = $pdo->prepare(
                "INSERT INTO refund_requests (id, order_id, user_id, reason, status)
                 VALUES (:id, :order_id, :user_id, :reason, 'pending')"
            );
            $refundInsert->execute([
                'id' => $refundRequestId,
                'order_id' => $orderId,
                'user_id' => $_SESSION['user_id'],
                'reason' => $reason !== '' ? $reason : 'Customer cancelled paid order.',
            ]);
        }
    }

    $notification = $pdo->prepare(
        "INSERT INTO notifications (user_id, order_id, type, title, message)
         VALUES (:user_id, :order_id, 'order_update', :title, :message)"
    );
    $notification->execute([
        'user_id' => $_SESSION['user_id'],
        'order_id' => $orderId,
        'title' => 'Order cancelled',
        'message' => $refundRequestId === null
            ? 'Your order has been cancelled.'
            : 'Your order has been cancelled. A refund request is pending review.',
    ]);

    $pdo->commit();
    echo json_encode([
        'success' => true,
        'message' => 'Order cancelled.',
        'refund_request_id' => $refundRequestId,
    ]);
} catch (DomainException $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(409);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Customer order cancellation error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to cancel order.']);
}
