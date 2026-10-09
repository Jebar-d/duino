<?php

declare(strict_types=1);

session_start();

header('Access-Control-Allow-Origin: http://localhost:3000');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: DELETE, OPTIONS');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed.'
    ]);
    exit;
}

if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'Authentication required.'
    ]);
    exit;
}

$pdo = getDatabaseConnection();

requireAdmin($pdo);

$data = json_decode(file_get_contents('php://input'), true);
$id = trim((string)($data['id'] ?? ''));

if ($id === '') {
    http_response_code(422);
    echo json_encode([
        'success' => false,
        'message' => 'Product ID is required.'
    ]);
    exit;
}

$stmt = $pdo->prepare(
    'SELECT id FROM products WHERE id = :id LIMIT 1'
);
$stmt->execute([
    'id' => $id
]);

if (!$stmt->fetch()) {
    http_response_code(404);
    echo json_encode([
        'success' => false,
        'message' => 'Product not found.'
    ]);
    exit;
}

$stmt = $pdo->prepare(
    'SELECT COUNT(*) FROM order_items WHERE product_id = :id'
);
$stmt->execute([
    'id' => $id
]);

$orderItemCount = (int)$stmt->fetchColumn();

if ($orderItemCount > 0) {
    http_response_code(409);
    echo json_encode([
        'success' => false,
        'message' => 'This product cannot be deleted because it is associated with existing orders.'
    ]);
    exit;
}

$stmt = $pdo->prepare(
    'SELECT COUNT(*) FROM stock_transactions WHERE product_id = :id'
);
$stmt->execute(['id' => $id]);
if ((int) $stmt->fetchColumn() > 0) {
    http_response_code(409);
    echo json_encode([
        'success' => false,
        'message' => 'This product cannot be deleted because it has inventory history.'
    ]);
    exit;
}

$pdo->beginTransaction();

try {
    $stmt = $pdo->prepare(
        'DELETE FROM cart_items WHERE product_id = :id'
    );
    $stmt->execute([
        'id' => $id
    ]);

    $stmt = $pdo->prepare(
        'DELETE FROM wishlists WHERE product_id = :id'
    );
    $stmt->execute([
        'id' => $id
    ]);

    $stmt = $pdo->prepare(
        'DELETE FROM reviews WHERE product_id = :id'
    );
    $stmt->execute([
        'id' => $id
    ]);

    $stmt = $pdo->prepare(
        'DELETE FROM variants WHERE product_id = :id'
    );
    $stmt->execute([
        'id' => $id
    ]);

    $stmt = $pdo->prepare(
        'DELETE FROM products WHERE id = :id'
    );
    $stmt->execute([
        'id' => $id
    ]);

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Product deleted successfully.'
    ]);
} catch (Throwable $e) {
    $pdo->rollBack();

    error_log('Product deletion failed: ' . $e->getMessage());

    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to delete product.'
    ]);
}
