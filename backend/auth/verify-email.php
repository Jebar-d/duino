<?php

declare(strict_types=1);

header('Access-Control-Allow-Origin: http://localhost:3000');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['success'=>false,'message'=>'Method not allowed.']); exit; }
require_once __DIR__ . '/../config/database.php';

$input = json_decode(file_get_contents('php://input'), true);
$token = is_array($input) ? trim((string)($input['token'] ?? '')) : '';
if ($token === '') { http_response_code(422); echo json_encode(['success'=>false,'message'=>'Verification token is required.']); exit; }

try {
    $pdo = getDatabaseConnection();
    $pdo->beginTransaction();
    $query = $pdo->prepare('SELECT id, user_id FROM email_verification_tokens WHERE token_hash = :token_hash AND used_at IS NULL AND expires_at > NOW() LIMIT 1 FOR UPDATE');
    $query->execute(['token_hash'=>hash('sha256',$token)]);
    $verification = $query->fetch(PDO::FETCH_ASSOC);
    if (!$verification) {
        $pdo->rollBack();
        http_response_code(400);
        echo json_encode(['success'=>false,'message'=>'Verification token is invalid, expired, or already used.']);
        exit;
    }
    $userUpdate = $pdo->prepare('UPDATE users SET email_verified = 1 WHERE id = :user_id');
    $userUpdate->execute(['user_id'=>$verification['user_id']]);
    $tokenUpdate = $pdo->prepare('UPDATE email_verification_tokens SET used_at = NOW() WHERE id = :id');
    $tokenUpdate->execute(['id'=>$verification['id']]);
    $pdo->commit();
    echo json_encode(['success'=>true,'message'=>'Email verified successfully.']);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) { $pdo->rollBack(); }
    error_log('Email verification error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success'=>false,'message'=>'Unable to verify email.']);
}
