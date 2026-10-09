<?php

declare(strict_types=1);

session_start();
header('Access-Control-Allow-Origin: http://localhost:3000');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); echo json_encode(['success'=>false,'message'=>'Method not allowed.']); exit; }
require_once __DIR__ . '/../config/database.php';
if (empty($_SESSION['user_id'])) { http_response_code(401); echo json_encode(['success'=>false,'message'=>'Authentication required.']); exit; }

$limit = filter_var($_GET['limit'] ?? 20, FILTER_VALIDATE_INT);
if ($limit === false || $limit < 1 || $limit > 100) { http_response_code(422); echo json_encode(['success'=>false,'message'=>'limit must be between 1 and 100.']); exit; }

try {
    $pdo = getDatabaseConnection();
    $unread = $pdo->prepare('SELECT COUNT(*) FROM notifications WHERE user_id = :user_id AND is_read = 0');
    $unread->execute(['user_id' => $_SESSION['user_id']]);
    $sql = 'SELECT id, order_id, title, message, type, is_read, created_at FROM notifications WHERE user_id = :user_id';
    if (($_GET['unread'] ?? '') === '1') { $sql .= ' AND is_read = 0'; }
    $sql .= ' ORDER BY created_at DESC LIMIT :limit';
    $query = $pdo->prepare($sql);
    $query->bindValue(':user_id', $_SESSION['user_id']);
    $query->bindValue(':limit', $limit, PDO::PARAM_INT);
    $query->execute();
    echo json_encode(['success'=>true,'notifications'=>$query->fetchAll(),'unread_count'=>(int)$unread->fetchColumn()], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    error_log('Notification list error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success'=>false,'message'=>'Unable to load notifications.']);
}
