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
if (empty($_SESSION['user_id'])) { http_response_code(401); echo json_encode(['success'=>false,'message'=>'Authentication required.']); exit; }
$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'Invalid request body.']); exit; }

try {
    $pdo = getDatabaseConnection();
    if (!empty($input['all_read'])) {
        $query = $pdo->prepare('DELETE FROM notifications WHERE user_id = :user_id AND is_read = 1');
        $query->execute(['user_id'=>$_SESSION['user_id']]);
    } else {
        $id = filter_var($input['id'] ?? null, FILTER_VALIDATE_INT);
        if ($id === false || $id === null || $id < 1) { http_response_code(422); echo json_encode(['success'=>false,'message'=>'Provide a valid id or all_read=true.']); exit; }
        $query = $pdo->prepare('DELETE FROM notifications WHERE id = :id AND user_id = :user_id');
        $query->execute(['id'=>$id,'user_id'=>$_SESSION['user_id']]);
    }
    echo json_encode(['success'=>true,'message'=>'Notifications deleted.']);
} catch (Throwable $e) {
    error_log('Notification delete error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success'=>false,'message'=>'Unable to delete notifications.']);
}
