<?php

declare(strict_types=1);

session_start();
header('Access-Control-Allow-Origin: http://localhost:3000');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: DELETE, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (!in_array($_SERVER['REQUEST_METHOD'], ['DELETE', 'POST'], true)) {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';

try {
    $pdo = getDatabaseConnection();
    requireAdmin($pdo);
    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid JSON body.']);
        exit;
    }

    $variantId = trim((string) ($input['id'] ?? ''));
    if ($variantId === '') {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'id is required.']);
        exit;
    }

    $delete = $pdo->prepare('DELETE FROM variants WHERE id = :id');
    $delete->execute(['id' => $variantId]);
    if ($delete->rowCount() !== 1) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Variant not found.']);
        exit;
    }

    echo json_encode(['success' => true, 'message' => 'Variant deleted.']);
} catch (Throwable $e) {
    error_log('Variant deletion error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to delete variant.']);
}
