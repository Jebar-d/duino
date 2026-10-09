<?php

declare(strict_types=1);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, x-callback-token');
header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['success'=>false,'message'=>'Method not allowed.']); exit; }
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/xendit.php';
$token = defined('XENDIT_CALLBACK_TOKEN') ? XENDIT_CALLBACK_TOKEN : '';
$provided = (string)($_SERVER['HTTP_X_CALLBACK_TOKEN'] ?? '');
if ($token === '' || !hash_equals($token, $provided)) { http_response_code(401); echo json_encode(['success'=>false,'message'=>'Invalid callback token.']); exit; }
$input = json_decode(file_get_contents('php://input'), true);
$invoiceId = is_array($input) && is_string($input['id'] ?? null) ? trim($input['id']) : '';
if ($invoiceId === '') { http_response_code(422); echo json_encode(['success'=>false,'message'=>'Invoice id is required.']); exit; }
try {
    $pdo = getDatabaseConnection();
    $lookup = $pdo->prepare('SELECT id FROM orders WHERE payment_reference = :reference LIMIT 1');
    $lookup->execute(['reference'=>$invoiceId]);
    $orderId = $lookup->fetchColumn();
    if ($orderId === false) { http_response_code(200); echo json_encode(['success'=>true,'message'=>'Ignored']); exit; }
    xenditSyncOrder($pdo, (string)$orderId, $invoiceId);
    echo json_encode(['success'=>true,'message'=>'Payment synchronized.']);
} catch (XenditException $e) { http_response_code(502); echo json_encode(['success'=>false,'message'=>$e->getMessage()]); }
catch (Throwable $e) { error_log('Payment webhook failed: ' . $e->getMessage()); http_response_code(500); echo json_encode(['success'=>false,'message'=>'Unable to synchronize payment.']); }