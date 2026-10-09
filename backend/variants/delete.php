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
require_once __DIR__ . '/../config/inventory.php';

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

    $pdo->beginTransaction();
    $variantQuery = $pdo->prepare('SELECT product_id, stock FROM variants WHERE id = :id FOR UPDATE');
    $variantQuery->execute(['id' => $variantId]);
    $variant = $variantQuery->fetch(PDO::FETCH_ASSOC);
    if (!$variant) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Variant not found.']);
        exit;
    }
    if ($variant['product_id'] !== null && (int) $variant['stock'] > 0) {
        changeInventoryStock(
            $pdo,
            (string) $variant['product_id'],
            $variantId,
            -(int) $variant['stock'],
            'Variant deleted from catalog.',
            (string) $_SESSION['user_id'],
            null,
            null,
            'variant-delete:' . $variantId
        );
    }
    $delete = $pdo->prepare('DELETE FROM variants WHERE id = :id');
    $delete->execute(['id' => $variantId]);
    if ($delete->rowCount() !== 1) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Variant not found.']);
        exit;
    }
    $pdo->commit();

    echo json_encode(['success' => true, 'message' => 'Variant deleted.']);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Variant deletion error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to delete variant.']);
}
