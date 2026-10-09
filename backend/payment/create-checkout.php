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
require_once __DIR__ . '/../config.php';

if (XENDIT_SECRET_KEY === '') { http_response_code(503); echo json_encode(['success'=>false,'message'=>'Online payments are not configured yet.']); exit; }
if (empty($_SESSION['user_id'])) { http_response_code(401); echo json_encode(['success'=>false,'message'=>'Authentication required.']); exit; }
$input = json_decode(file_get_contents('php://input'), true);
$orderId = is_array($input) ? trim((string)($input['order_id'] ?? '')) : '';
if ($orderId === '') { http_response_code(422); echo json_encode(['success'=>false,'message'=>'order_id is required.']); exit; }

try {
    $pdo = getDatabaseConnection();
    $query = $pdo->prepare('SELECT o.id, o.total_cents, o.payment_method, u.email FROM orders o LEFT JOIN users u ON u.id = o.user_id WHERE o.id = :id AND o.user_id = :user_id LIMIT 1');
    $query->execute(['id'=>$orderId,'user_id'=>$_SESSION['user_id']]);
    $order = $query->fetch(PDO::FETCH_ASSOC);
    if (!$order) { http_response_code(404); echo json_encode(['success'=>false,'message'=>'Order not found.']); exit; }
    if (!in_array($order['payment_method'], ['gcash','maya','card'], true)) { http_response_code(422); echo json_encode(['success'=>false,'message'=>'This order does not use online payment.']); exit; }

    $reference = 'arduino-' . $order['id'] . '-' . bin2hex(random_bytes(5));
    $payload = [
        'external_id' => $reference,
        'amount' => ((int)$order['total_cents']) / 100,
        'currency' => 'PHP',
        'payer_email' => $order['email'],
        'description' => 'Arduino Store order ' . $order['id'],
        'success_redirect_url' => 'http://localhost:3000/orders/' . rawurlencode($order['id']),
        'failure_redirect_url' => 'http://localhost:3000/orders/' . rawurlencode($order['id']),
    ];
    $curl = curl_init('https://api.xendit.co/v2/invoices');
    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_USERPWD => XENDIT_SECRET_KEY . ':',
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_TIMEOUT => 30,
    ]);
    $raw = curl_exec($curl);
    $status = (int)curl_getinfo($curl, CURLINFO_HTTP_CODE);
    $curlError = curl_error($curl);
    curl_close($curl);
    $response = is_string($raw) ? json_decode($raw, true) : null;
    if ($curlError !== '' || $status < 200 || $status >= 300 || !is_array($response) || empty($response['invoice_url'])) {
        error_log('Xendit checkout error: ' . $curlError . ' HTTP ' . $status);
        http_response_code(502);
        echo json_encode(['success'=>false,'message'=>'Unable to create online checkout.']);
        exit;
    }
    $save = $pdo->prepare("UPDATE orders SET payment_reference = :reference, payment_status = 'unpaid' WHERE id = :id");
    $save->execute(['reference'=>$reference,'id'=>$orderId]);
    echo json_encode(['success'=>true,'checkout_url'=>$response['invoice_url']]);
} catch (Throwable $e) {
    error_log('Create checkout error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success'=>false,'message'=>'Unable to create online checkout.']);
}
