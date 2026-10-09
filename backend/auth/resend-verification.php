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
if (empty($_SESSION['user_id'])) { http_response_code(401); echo json_encode(['success'=>false,'message'=>'Authentication required.']); exit; }

try {
    $pdo = getDatabaseConnection();
    $userQuery = $pdo->prepare('SELECT email, email_verified FROM users WHERE id = :id LIMIT 1');
    $userQuery->execute(['id'=>$_SESSION['user_id']]);
    $user = $userQuery->fetch(PDO::FETCH_ASSOC);
    if (!$user) { http_response_code(404); echo json_encode(['success'=>false,'message'=>'User account not found.']); exit; }
    if ((bool)$user['email_verified']) { echo json_encode(['success'=>true,'message'=>'Email is already verified.']); exit; }

    $countQuery = $pdo->prepare('SELECT COUNT(*) FROM email_verification_tokens WHERE user_id = :user_id AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)');
    $countQuery->execute(['user_id'=>$_SESSION['user_id']]);
    if ((int)$countQuery->fetchColumn() >= 3) { http_response_code(429); echo json_encode(['success'=>false,'message'=>'Verification email limit reached. Try again later.']); exit; }

    $token = bin2hex(random_bytes(32));
    $insert = $pdo->prepare('INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at) VALUES (:id, :user_id, :token_hash, DATE_ADD(NOW(), INTERVAL 24 HOUR))');
    $insert->execute(['id'=>newUuid(),'user_id'=>$_SESSION['user_id'],'token_hash'=>hash('sha256',$token)]);
    $link = 'http://localhost:3000/verify-email?token=' . rawurlencode($token);
    $sent = @mail($user['email'], 'Verify your Arduino Store email', "Verify your email address using this link:\n\n" . $link);
    if (!$sent) {
        $directory = __DIR__ . '/../logs';
        if (!is_dir($directory)) { mkdir($directory, 0755, true); }
        file_put_contents($directory . '/mail.log', date('c') . ' ' . $user['email'] . ' ' . $link . PHP_EOL, FILE_APPEND | LOCK_EX);
    }
    echo json_encode(['success'=>true,'message'=>'Verification email sent.']);
} catch (Throwable $e) {
    error_log('Resend verification error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success'=>false,'message'=>'Unable to send verification email.']);
}
