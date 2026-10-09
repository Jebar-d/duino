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

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid request body.']);
    exit;
}

$orderId = trim((string) ($input['order_id'] ?? ''));
$allowedStatuses = [
    'pending', 'paid', 'processing', 'shipped',
    'delivered', 'completed', 'cancelled', 'refunded',
];
$allowedTrackingStatuses = [
    'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered',
];
$status = $input['status'] ?? null;
$trackingStatus = $input['tracking_status'] ?? null;
$expectedDelivery = $input['expected_delivery'] ?? null;
$note = $input['note'] ?? null;

if ($orderId === '') {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'order_id is required.']);
    exit;
}
if ($status !== null && (!is_string($status) || !in_array($status, $allowedStatuses, true))) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Invalid status.']);
    exit;
}
if ($trackingStatus !== null && (!is_string($trackingStatus) || !in_array($trackingStatus, $allowedTrackingStatuses, true))) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Invalid tracking_status.']);
    exit;
}
if (
    $expectedDelivery !== null
    && $expectedDelivery !== ''
    && (
        !is_string($expectedDelivery)
        || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $expectedDelivery)
        || DateTime::createFromFormat('!Y-m-d', $expectedDelivery) === false
        || DateTime::createFromFormat('!Y-m-d', $expectedDelivery)->format('Y-m-d') !== $expectedDelivery
    )
) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Invalid expected_delivery date.']);
    exit;
}
if ($note !== null && !is_string($note)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'note must be a string.']);
    exit;
}
$note = $note === null ? null : trim($note);
if ($note !== null && mb_strlen($note) > 2000) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'note is too long.']);
    exit;
}

if ($status === null && $trackingStatus === null && !array_key_exists('expected_delivery', $input)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'At least one order field must be provided.']);
    exit;
}

if ($status === 'delivered') {
    $trackingStatus = 'delivered';
}

try {
    $pdo = getDatabaseConnection();
    requireAdmin($pdo);
    $pdo->beginTransaction();

    $query = $pdo->prepare(
        'SELECT user_id, status, tracking_status, expected_delivery
         FROM orders
         WHERE id = :id
         FOR UPDATE'
    );
    $query->execute(['id' => $orderId]);
    $existing = $query->fetch(PDO::FETCH_ASSOC);
    if (!$existing) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Order not found.']);
        exit;
    }

    $newStatus = $status ?? $existing['status'];
    $newTracking = $trackingStatus ?? $existing['tracking_status'];
    $newExpectedDelivery = array_key_exists('expected_delivery', $input)
        ? ($expectedDelivery === '' ? null : $expectedDelivery)
        : $existing['expected_delivery'];
    $statusChanged = $newStatus !== $existing['status'];
    $trackingChanged = $newTracking !== $existing['tracking_status'];
    $deliveryChanged = $newExpectedDelivery !== $existing['expected_delivery'];
    $hasNote = $note !== null && $note !== '';

    if (!$statusChanged && !$trackingChanged && !$deliveryChanged && !$hasNote) {
        $pdo->rollBack();
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'No order fields have changed.']);
        exit;
    }

    if ($newStatus === 'cancelled' && $existing['status'] !== 'cancelled') {
        $items = $pdo->prepare('SELECT product_id, variant_id, qty FROM order_items WHERE order_id = :id');
        $items->execute(['id' => $orderId]);
        foreach ($items->fetchAll(PDO::FETCH_ASSOC) as $item) {
            if ($item['variant_id'] !== null) {
                $restore = $pdo->prepare('UPDATE variants SET stock = stock + :qty WHERE id = :id');
                $restore->execute(['qty' => $item['qty'], 'id' => $item['variant_id']]);
            } elseif ($item['product_id'] !== null) {
                $restore = $pdo->prepare('UPDATE products SET stock = stock + :qty WHERE id = :id');
                $restore->execute(['qty' => $item['qty'], 'id' => $item['product_id']]);
            }
        }
    }

    $update = $pdo->prepare(
        'UPDATE orders
         SET status = :status,
             tracking_status = :tracking_status,
             expected_delivery = :expected_delivery
         WHERE id = :id'
    );
    $update->execute([
        'status' => $newStatus,
        'tracking_status' => $newTracking,
        'expected_delivery' => $newExpectedDelivery,
        'id' => $orderId,
    ]);

    $historyNote = $note;
    if ($trackingChanged) {
        $trackingNote = 'Tracking status: ' . $newTracking;
        $historyNote = $historyNote === null || $historyNote === ''
            ? $trackingNote
            : $historyNote . ' ' . $trackingNote;
    }
    $history = $pdo->prepare(
        'INSERT INTO order_status_history (order_id, status, note)
         VALUES (:order_id, :status, :note)'
    );
    $history->execute([
        'order_id' => $orderId,
        'status' => $newStatus,
        'note' => $historyNote,
    ]);

    if ($existing['user_id'] !== null) {
        $messageParts = [];
        if ($statusChanged) {
            $messageParts[] = 'Order status: ' . $newStatus . '.';
        }
        if ($trackingChanged) {
            $messageParts[] = 'Tracking status: ' . $newTracking . '.';
        }
        if ($deliveryChanged) {
            $messageParts[] = $newExpectedDelivery === null
                ? 'Expected delivery was cleared.'
                : 'Expected delivery: ' . $newExpectedDelivery . '.';
        }
        if ($note !== null && $note !== '') {
            $messageParts[] = $note;
        }

        $notification = $pdo->prepare(
            "INSERT INTO notifications (user_id, order_id, type, title, message)
             VALUES (:user_id, :order_id, 'order_update', :title, :message)"
        );
        $notification->execute([
            'user_id' => $existing['user_id'],
            'order_id' => $orderId,
            'title' => 'Order update',
            'message' => implode(' ', $messageParts),
        ]);
    }

    $pdo->commit();
    $updatedQuery = $pdo->prepare('SELECT * FROM orders WHERE id = :id LIMIT 1');
    $updatedQuery->execute(['id' => $orderId]);
    echo json_encode([
        'success' => true,
        'message' => 'Order updated.',
        'order' => $updatedQuery->fetch(PDO::FETCH_ASSOC),
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Admin order update error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to update order.']);
}
