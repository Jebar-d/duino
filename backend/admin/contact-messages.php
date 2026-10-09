<?php

declare(strict_types=1);

session_start();
header('Access-Control-Allow-Origin: http://localhost:3000');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if (!in_array($_SERVER['REQUEST_METHOD'], ['GET','POST'], true)) { http_response_code(405); echo json_encode(['success'=>false,'message'=>'Method not allowed.']); exit; }
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';
$pdo = getDatabaseConnection();
requireAdmin($pdo);

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $messages = $pdo->query('SELECT id, user_id, name, email, subject, message, is_handled, created_at FROM contact_messages ORDER BY created_at DESC')->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['success'=>true,'messages'=>$messages], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $input = json_decode(file_get_contents('php://input'), true);
    $id = is_array($input) ? trim((string)($input['id'] ?? '')) : '';
    $handled = is_array($input) ? filter_var($input['is_handled'] ?? null, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) : null;
    if ($id === '' || $handled === null) { http_response_code(422); echo json_encode(['success'=>false,'message'=>'id and boolean is_handled are required.']); exit; }
    $update = $pdo->prepare('UPDATE contact_messages SET is_handled = :handled WHERE id = :id');
    $update->execute(['handled'=>$handled ? 1 : 0,'id'=>$id]);
    if ($update->rowCount() === 0) {
        $check = $pdo->prepare('SELECT id FROM contact_messages WHERE id = :id');
        $check->execute(['id'=>$id]);
        if (!$check->fetch()) { http_response_code(404); echo json_encode(['success'=>false,'message'=>'Contact message not found.']); exit; }
    }
    echo json_encode(['success'=>true,'message'=>'Contact message updated.']);
} catch (Throwable $e) {
    error_log('Admin contact messages error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success'=>false,'message'=>'Unable to process contact messages.']);
}
