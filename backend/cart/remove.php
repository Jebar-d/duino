<?php

declare(strict_types=1);

header('Access-Control-Allow-Origin: http://localhost:3000');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);

    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed.'
    ]);

    exit;
}

require_once __DIR__ . '/../config/database.php';

session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => false,
    'httponly' => true,
    'samesite' => 'Lax'
]);

session_start();

$userId = $_SESSION['user_id'] ?? null;

if (!$userId) {
    http_response_code(401);

    echo json_encode([
        'success' => false,
        'message' => 'Not authenticated.',
        'user' => null
    ]);

    exit;
}

$input = json_decode(
    file_get_contents('php://input'),
    true
);

if (!is_array($input)) {
    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' => 'Invalid request data.'
    ]);

    exit;
}

$productId = trim((string) ($input['product_id'] ?? ''));
$variantId = isset($input['variant_id']) && $input['variant_id'] !== '' ? trim((string)$input['variant_id']) : null;

if ($productId === '') {
    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' => 'Product ID is required.'
    ]);

    exit;
}

try {
    $db = getDatabaseConnection();

    /*
     * Make sure the item belongs to the
     * currently authenticated user's cart.
     */
    $checkStatement = $db->prepare(
        'SELECT id, product_id, qty
         FROM cart_items
         WHERE user_id = :user_id
           AND product_id = :product_id
           AND (variant_id = :variant_id OR (variant_id IS NULL AND :variant_null IS NULL))
         LIMIT 1'
    );

    $checkStatement->execute([
        ':user_id' => $userId,
        ':product_id' => $productId, ':variant_id' => $variantId, ':variant_null' => $variantId
    ]);

    $cartItem = $checkStatement->fetch();

    if (!$cartItem) {
        http_response_code(404);

        echo json_encode([
            'success' => false,
            'message' => 'This product is not in your cart.'
        ]);

        exit;
    }

    /*
     * Remove only this user's cart item.
     */
    $deleteStatement = $db->prepare(
        'DELETE FROM cart_items
         WHERE user_id = :user_id
           AND product_id = :product_id
           AND (variant_id = :variant_id OR (variant_id IS NULL AND :variant_null IS NULL))'
    );

    $deleteStatement->execute([
        ':user_id' => $userId,
        ':product_id' => $productId, ':variant_id' => $variantId, ':variant_null' => $variantId
    ]);

    if ($deleteStatement->rowCount() === 0) {
        http_response_code(500);

        echo json_encode([
            'success' => false,
            'message' => 'Unable to remove the cart item.'
        ]);

        exit;
    }

    echo json_encode([
        'success' => true,
        'message' => 'Product removed from cart.',
        'product_id' => $productId
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {

    error_log(
        'Arduino Store cart remove error: ' .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to remove product from cart.'
    ]);
}
