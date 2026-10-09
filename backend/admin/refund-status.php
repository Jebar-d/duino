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
    echo json_encode(['success' => false, 'message' => 'Invalid request data.']);
    exit;
}

$id = trim((string) ($input['id'] ?? ''));
$status = trim((string) ($input['status'] ?? ''));

if ($id === '' || !in_array($status, ['approved', 'rejected'], true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'A refund request ID and valid status are required.']);
    exit;
}

try {
    $pdo = getDatabaseConnection();
    requireAdmin($pdo);

    $details = $pdo->prepare('SELECT user_id, order_id FROM refund_requests WHERE id = :id LIMIT 1');
    $details->execute(['id' => $id]);
    $refund = $details->fetch(PDO::FETCH_ASSOC);
    if (!$refund) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Refund request not found.']);
        exit;
    }

    $query = $pdo->prepare(
        'UPDATE refund_requests
         SET status = :status, resolved_at = NOW()
         WHERE id = :id AND status = \'pending\''
    );
    $query->execute(['id' => $id, 'status' => $status]);

    if ($query->rowCount() !== 1) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'Refund request was not found or has already been resolved.']);
        exit;
    }

    try {
        $notification = $pdo->prepare("INSERT INTO notifications (user_id, order_id, type, title, message) VALUES (:user_id, :order_id, 'refund', :title, :message)");
        $notification->execute([
            'user_id' => $refund['user_id'],
            'order_id' => $refund['order_id'],
            'title' => 'Refund ' . $status,
            'message' => 'Your refund request was ' . $status . '.',
        ]);
    } catch (Throwable $notificationError) {
        error_log('Refund notification failed: ' . $notificationError->getMessage());
    }

    echo json_encode([
        'success' => true,
        'message' => 'Refund request ' . $status . ' successfully.'
    ]);
} catch (Throwable $e) {
    error_log('Arduino Store refund status error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to update refund request.']);
}
