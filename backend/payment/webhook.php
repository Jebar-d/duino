<?php

declare(strict_types=1);

header('Access-Control-Allow-Origin: http://localhost:3000');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, x-callback-token');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['success'=>false,'message'=>'Method not allowed.']); exit; }
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config.php';
$callbackToken = $_SERVER['HTTP_X_CALLBACK_TOKEN'] ?? '';
if (XENDIT_CALLBACK_TOKEN === '' || !hash_equals(XENDIT_CALLBACK_TOKEN, (string)$callbackToken)) {
    http_response_code(401);
    echo json_encode(['success'=>false,'message'=>'Invalid callback token.']);
    exit;
}
$input = json_decode(file_get_contents('php://input'), true);
$reference = is_array($input) ? trim((string)($input['external_id'] ?? $input['payment_reference'] ?? '')) : '';
$status = is_array($input) ? strtoupper((string)($input['status'] ?? '')) : '';
if ($reference === '' || !in_array($status, ['PAID','SETTLED'], true)) {
    http_response_code(422);
    echo json_encode(['success'=>false,'message'=>'A paid event with payment reference is required.']);
    exit;
}
try {
    $pdo = getDatabaseConnection();
    $update = $pdo->prepare("UPDATE orders SET payment_status = 'paid', status = 'paid' WHERE payment_reference = :reference");
    $update->execute(['reference'=>$reference]);
    if ($update->rowCount() === 0) {
        $check = $pdo->prepare('SELECT id FROM orders WHERE payment_reference = :reference');
        $check->execute(['reference'=>$reference]);
        if (!$check->fetch()) { http_response_code(404); echo json_encode(['success'=>false,'message'=>'Payment reference not found.']); exit; }
    }
    echo json_encode(['success'=>true,'message'=>'Payment recorded.']);
} catch (Throwable $e) {
    error_log('Payment webhook error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success'=>false,'message'=>'Unable to record payment.']);
}
