<?php

declare(strict_types=1);
header('Access-Control-Allow-Origin: http://localhost:3000');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); echo json_encode(['success'=>false,'message'=>'Method not allowed.']); exit; }
session_set_cookie_params(['lifetime'=>0,'path'=>'/','samesite'=>'Lax','secure'=>false,'httponly'=>true]);
session_start();
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/xendit.php';
if (empty($_SESSION['user_id'])) { http_response_code(401); echo json_encode(['success'=>false,'message'=>'Authentication required.']); exit; }
$orderId = isset($_GET['order_id']) && is_string($_GET['order_id']) ? trim($_GET['order_id']) : '';
if ($orderId === '') { http_response_code(422); echo json_encode(['success'=>false,'message'=>'order_id is required.']); exit; }
$pdo = getDatabaseConnection();
try {
    $query = $pdo->prepare('SELECT id, user_id, status, payment_method, payment_status, payment_reference FROM orders WHERE id = :id AND user_id = :user_id LIMIT 1');
    $query->execute(['id'=>$orderId,'user_id'=>$_SESSION['user_id']]);
    $order = $query->fetch(PDO::FETCH_ASSOC);
    if (!$order) { http_response_code(404); echo json_encode(['success'=>false,'message'=>'Order not found.']); exit; }
    $invoiceStatus = null;
    if (xenditIsOnlineMethod((string)$order['payment_method']) && $order['payment_status'] !== 'paid' && !empty($order['payment_reference']) && xenditIsConfigured()) {
        $invoice = xenditSyncOrder($pdo, $orderId, (string)$order['payment_reference']);
        $invoiceStatus = strtoupper((string)($invoice['status'] ?? ''));
        $query->execute(['id'=>$orderId,'user_id'=>$_SESSION['user_id']]);
        $order = $query->fetch(PDO::FETCH_ASSOC);
    }
    echo json_encode(['success'=>true,'order_id'=>$orderId,'order_status'=>$order['status'],'payment_method'=>$order['payment_method'],'payment_status'=>$order['payment_status'],'invoice_status'=>$invoiceStatus]);
} catch (XenditException $e) { http_response_code(502); echo json_encode(['success'=>false,'message'=>$e->getMessage()]); }
catch (Throwable $e) { error_log('Payment status failed: ' . $e->getMessage()); http_response_code(500); echo json_encode(['success'=>false,'message'=>'Unable to check payment status.']); }