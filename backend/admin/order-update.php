<?php

declare(strict_types=1);

session_start();
header('Access-Control-Allow-Origin: http://localhost:3000');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['success'=>false,'message'=>'Method not allowed.']); exit; }
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';
$pdo = getDatabaseConnection();
requireAdmin($pdo);

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'Invalid request body.']); exit; }
$orderId = trim((string)($input['order_id'] ?? $input['id'] ?? ''));
$allowedStatuses = ['pending','paid','processing','shipped','delivered','completed','cancelled','refunded'];
$status = $input['status'] ?? null;
$trackingStatus = $input['tracking_status'] ?? null;
$expectedDelivery = $input['expected_delivery'] ?? null;
if ($orderId === '') { http_response_code(422); echo json_encode(['success'=>false,'message'=>'order_id is required.']); exit; }
if ($status !== null && !in_array($status, $allowedStatuses, true)) { http_response_code(422); echo json_encode(['success'=>false,'message'=>'Invalid status.']); exit; }
if ($trackingStatus !== null && (!is_string($trackingStatus) || strlen($trackingStatus) > 100)) { http_response_code(422); echo json_encode(['success'=>false,'message'=>'Invalid tracking_status.']); exit; }
if ($expectedDelivery !== null && ($expectedDelivery !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$expectedDelivery))) { http_response_code(422); echo json_encode(['success'=>false,'message'=>'Invalid expected_delivery date.']); exit; }

try {
    $pdo->beginTransaction();
    $query = $pdo->prepare('SELECT user_id, status, tracking_status FROM orders WHERE id = :id FOR UPDATE');
    $query->execute(['id'=>$orderId]);
    $existing = $query->fetch(PDO::FETCH_ASSOC);
    if (!$existing) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['success'=>false,'message'=>'Order not found.']);
        exit;
    }

    $statusChanged = $status !== null && $status !== $existing['status'];
    $trackingChanged = $trackingStatus !== null && $trackingStatus !== $existing['tracking_status'];
    $sets = [];
    $params = ['id'=>$orderId];
    if ($status !== null) { $sets[] = 'status = :status'; $params['status'] = $status; }
    if ($trackingStatus !== null) { $sets[] = 'tracking_status = :tracking_status'; $params['tracking_status'] = $trackingStatus; }
    if (array_key_exists('expected_delivery', $input)) { $sets[] = 'expected_delivery = :expected_delivery'; $params['expected_delivery'] = $expectedDelivery !== '' ? $expectedDelivery : null; }
    if ($status === 'cancelled' && $existing['status'] !== 'cancelled') {
        $sets[] = 'cancelled_at = NOW()';
        $items = $pdo->prepare('SELECT product_id, variant_id, qty FROM order_items WHERE order_id = :id');
        $items->execute(['id'=>$orderId]);
        foreach ($items->fetchAll(PDO::FETCH_ASSOC) as $item) {
            if ($item['variant_id'] !== null) {
                $restore = $pdo->prepare('UPDATE variants SET stock = stock + :qty WHERE id = :id');
            } else {
                $restore = $pdo->prepare('UPDATE products SET stock = stock + :qty WHERE id = :id');
            }
            $restore->execute(['qty'=>$item['qty'],'id'=>$item['variant_id'] ?? $item['product_id']]);
        }
    }
    if ($sets !== []) {
        $update = $pdo->prepare('UPDATE orders SET ' . implode(', ', $sets) . ' WHERE id = :id');
        $update->execute($params);
    }

    $currentStatus = $status ?? $existing['status'];
    $history = $pdo->prepare('INSERT INTO order_status_history (order_id, status, note) VALUES (:order_id, :status, :note)');
    $history->execute(['order_id'=>$orderId,'status'=>$currentStatus,'note'=>$input['note'] ?? null]);
    $pdo->commit();

    if (($statusChanged || $trackingChanged) && $existing['user_id'] !== null) {
        try {
            $parts = [];
            if ($statusChanged) { $parts[] = 'Order status: ' . $status; }
            if ($trackingChanged) { $parts[] = 'Tracking status: ' . $trackingStatus; }
            if (!empty($input['note'])) { $parts[] = trim((string)$input['note']); }
            $notification = $pdo->prepare("INSERT INTO notifications (user_id, order_id, type, title, message) VALUES (:user_id, :order_id, 'order_update', :title, :message)");
            $notification->execute([
                'user_id'=>$existing['user_id'],
                'order_id'=>$orderId,
                'title'=>'Order update',
                'message'=>implode(' ', $parts),
            ]);
        } catch (Throwable $notificationError) {
            error_log('Order update notification failed: ' . $notificationError->getMessage());
        }
    }

    $updatedQuery = $pdo->prepare('SELECT * FROM orders WHERE id = :id LIMIT 1');
    $updatedQuery->execute(['id'=>$orderId]);
    echo json_encode(['success'=>true,'message'=>'Order updated.','order'=>$updatedQuery->fetch(PDO::FETCH_ASSOC)], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) { $pdo->rollBack(); }
    error_log('Admin order update error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success'=>false,'message'=>'Unable to update order.']);
}
