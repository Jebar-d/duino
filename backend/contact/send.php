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

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'Invalid request body.']); exit; }
$name = trim(strip_tags((string)($input['name'] ?? '')));
$email = trim(strip_tags((string)($input['email'] ?? '')));
$subject = trim(strip_tags((string)($input['subject'] ?? '')));
$message = trim(strip_tags((string)($input['message'] ?? '')));
$messageLength = function_exists('mb_strlen') ? mb_strlen($message, 'UTF-8') : strlen($message);
if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || $subject === '' || $messageLength < 10 || $messageLength > 2000) {
    http_response_code(422);
    echo json_encode(['success'=>false,'message'=>'Provide a name, valid email, subject, and a 10 to 2000 character message.']);
    exit;
}

try {
    $pdo = getDatabaseConnection();
    $userId = $_SESSION['user_id'] ?? null;
    $ipAddress = (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    if ($userId !== null) {
        $rate = $pdo->prepare('SELECT COUNT(*) FROM contact_messages WHERE user_id = :user_id AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)');
        $rate->execute(['user_id'=>$userId]);
    } else {
        $rate = $pdo->prepare('SELECT COUNT(*) FROM contact_messages WHERE ip_address = :ip AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)');
        $rate->execute(['ip'=>$ipAddress]);
    }
    if ((int)$rate->fetchColumn() >= 5) { http_response_code(429); echo json_encode(['success'=>false,'message'=>'Contact form rate limit reached. Try again later.']); exit; }

    $insert = $pdo->prepare('INSERT INTO contact_messages (id, user_id, name, email, subject, message, ip_address) VALUES (:id, :user_id, :name, :email, :subject, :message, :ip)');
    $insert->execute([
        'id'=>newUuid(),
        'user_id'=>$userId,
        'name'=>$name,
        'email'=>$email,
        'subject'=>$subject,
        'message'=>$message,
        'ip'=>$ipAddress,
    ]);
    echo json_encode(['success'=>true,'message'=>'Your message has been sent.']);
} catch (Throwable $e) {
    error_log('Contact form error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success'=>false,'message'=>'Unable to send your message.']);
}
