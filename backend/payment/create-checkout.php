<?php

declare(strict_types=1);

session_set_cookie_params(['lifetime'=>0,'path'=>'/','samesite'=>'Lax','secure'=>false,'httponly'=>true]);
session_start();
header('Access-Control-Allow-Origin: http://localhost:3000');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['success'=>false,'message'=>'Method not allowed.']); exit; }
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/xendit.php';
if (empty($_SESSION['user_id'])) { http_response_code(401); echo json_encode(['success'=>false,'message'=>'Authentication required.']); exit; }
if (!xenditIsConfigured()) { http_response_code(503); echo json_encode(['success'=>false,'message'=>xenditNotConfiguredMessage()]); exit; }
$input = json_decode(file_get_contents('php://input'), true);
$orderId = is_array($input) && is_string($input['order_id'] ?? null) ? trim($input['order_id']) : '';
if ($orderId === '') { http_response_code(422); echo json_encode(['success'=>false,'message'=>'order_id is required.']); exit; }
$pdo = getDatabaseConnection();
try {
    $pdo->beginTransaction();
    $query = $pdo->prepare('SELECT id, user_id, total_cents, payment_method, payment_status, status, payment_reference, shipping_address FROM orders WHERE id = :id FOR UPDATE');
    $query->execute(['id'=>$orderId]);
    $order = $query->fetch(PDO::FETCH_ASSOC);
    if (!$order || (string)$order['user_id'] !== (string)$_SESSION['user_id']) { $pdo->rollBack(); http_response_code(404); echo json_encode(['success'=>false,'message'=>'Order not found.']); exit; }
    if (!xenditIsOnlineMethod((string)$order['payment_method'])) { $pdo->rollBack(); http_response_code(422); echo json_encode(['success'=>false,'message'=>'This order does not use online payment.']); exit; }
    if ($order['payment_status'] === 'paid') { $pdo->commit(); echo json_encode(['success'=>true,'already_paid'=>true]); exit; }
    if ($order['status'] !== 'pending' || $order['payment_status'] !== 'unpaid') { $pdo->rollBack(); http_response_code(409); echo json_encode(['success'=>false,'message'=>'Order is no longer eligible for payment.']); exit; }
    $emailQuery = $pdo->prepare('SELECT email FROM users WHERE id = :id LIMIT 1');
    $emailQuery->execute(['id'=>$_SESSION['user_id']]);
    $email = (string)$emailQuery->fetchColumn();
    $order['email'] = $email;
    if (!empty($order['payment_reference'])) {
        $invoiceId = (string)$order['payment_reference'];
        $pdo->commit();
        $invoice = xenditGetInvoice($invoiceId);
        if (strtoupper((string)($invoice['status'] ?? '')) === 'PENDING' && !empty($invoice['invoice_url'])) {
            echo json_encode(['success'=>true,'checkout_url'=>$invoice['invoice_url']]); exit;
        }
        xenditApplyInvoice($pdo, $orderId, $invoice);
        $check = $pdo->prepare('SELECT payment_status, status FROM orders WHERE id = :id');
        $check->execute(['id'=>$orderId]);
        $latest = $check->fetch(PDO::FETCH_ASSOC);
        if ($latest && $latest['payment_status'] === 'paid') { echo json_encode(['success'=>true,'already_paid'=>true]); exit; }
        http_response_code(409); echo json_encode(['success'=>false,'message'=>'Payment link expired, order cancelled.']); exit;
    }
    $invoice = xenditCreateInvoice($order);
    $save = $pdo->prepare('UPDATE orders SET payment_reference = :reference WHERE id = :id');
    $save->execute(['reference'=>$invoice['id'],'id'=>$orderId]);
    $pdo->commit();
    echo json_encode(['success'=>true,'checkout_url'=>$invoice['invoice_url']]);
} catch (XenditException $e) {
    if ($pdo->inTransaction()) { $pdo->rollBack(); }
    http_response_code(502); echo json_encode(['success'=>false,'message'=>$e->getMessage()]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) { $pdo->rollBack(); }
    error_log('Create checkout failed: ' . $e->getMessage());
    http_response_code(500); echo json_encode(['success'=>false,'message'=>'Unable to create online checkout.']);
}