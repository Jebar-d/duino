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
        'message' => 'Please log in before adding items to your cart.'
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
$requestedQuantity = (int) ($input['qty'] ?? 1);

if ($productId === '') {
    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' => 'Product ID is required.'
    ]);

    exit;
}

if ($requestedQuantity < 1) {
    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' => 'Quantity must be at least 1.'
    ]);

    exit;
}

if ($requestedQuantity > 999) {
    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' => 'Quantity cannot exceed 999.'
    ]);

    exit;
}

try {
    $db = getDatabaseConnection();

    $db->beginTransaction();

    /*
     * Lock the product row while checking stock.
     * This prevents two simultaneous requests from
     * exceeding the available stock.
     */
    $productStatement = $db->prepare(
        'SELECT
            id,
            name,
            slug,
            price_cents,
            stock,
            img_url,
            model_url
         FROM products
         WHERE id = :product_id
         LIMIT 1
         FOR UPDATE'
    );

    $productStatement->execute([
        ':product_id' => $productId
    ]);

    $product = $productStatement->fetch();

    if (!$product) {
        $db->rollBack();

        http_response_code(404);

        echo json_encode([
            'success' => false,
            'message' => 'Product not found.'
        ]);

        exit;
    }

    $stock = (int) $product['stock'];
    $variant = null;
    if ($variantId !== null) {
        $vs = $db->prepare('SELECT id, price_adjustment, stock, variant_name, option_value FROM variants WHERE id=:id AND product_id=:pid FOR UPDATE');
        $vs->execute(['id'=>$variantId,'pid'=>$productId]); $variant=$vs->fetch();
        if (!$variant) { $db->rollBack(); http_response_code(404); echo json_encode(['success'=>false,'message'=>'Variant not found.']); exit; }
        $stock=(int)$variant['stock'];
    }

    if ($stock <= 0) {
        $db->rollBack();

        http_response_code(409);

        echo json_encode([
            'success' => false,
            'message' => 'This product is currently out of stock.'
        ]);

        exit;
    }

    /*
     * Check whether this product is already
     * in the user's cart.
     */
    $cartStatement = $db->prepare(
        'SELECT id, qty
         FROM cart_items
         WHERE user_id = :user_id
           AND product_id = :product_id
           AND (variant_id = :variant_id OR (variant_id IS NULL AND :variant_null IS NULL))
         LIMIT 1
         FOR UPDATE'
    );

    $cartStatement->execute([
        ':user_id' => $userId,
        ':product_id' => $productId,
        ':variant_id' => $variantId, ':variant_null' => $variantId
    ]);

    $existingItem = $cartStatement->fetch();

    if ($existingItem) {
        $currentQuantity = (int) $existingItem['qty'];
        $newQuantity = $currentQuantity + $requestedQuantity;

        if ($newQuantity > $stock) {
            $db->rollBack();

            http_response_code(409);

            echo json_encode([
                'success' => false,
                'message' => "Only {$stock} item(s) are currently available.",
                'available_stock' => $stock,
                'current_cart_quantity' => $currentQuantity
            ]);

            exit;
        }

        $updateStatement = $db->prepare(
            'UPDATE cart_items
             SET qty = :qty
             WHERE id = :id'
        );

        $updateStatement->execute([
            ':qty' => $newQuantity,
            ':id' => $existingItem['id']
        ]);

        $cartItemId = $existingItem['id'];
        $finalQuantity = $newQuantity;

    } else {

        if ($requestedQuantity > $stock) {
            $db->rollBack();

            http_response_code(409);

            echo json_encode([
                'success' => false,
                'message' => "Only {$stock} item(s) are currently available.",
                'available_stock' => $stock
            ]);

            exit;
        }

        $cartItemId = sprintf(
            '%s-%s-%s-%s-%s',
            bin2hex(random_bytes(4)),
            bin2hex(random_bytes(2)),
            bin2hex(random_bytes(2)),
            bin2hex(random_bytes(2)),
            bin2hex(random_bytes(6))
        );

        $insertStatement = $db->prepare(
            'INSERT INTO cart_items (
                id,
                user_id,
                product_id,
                variant_id,
                qty
            ) VALUES (
                :id,
                :user_id,
                :product_id,
                :variant_id,
                :qty
            )'
        );

        $insertStatement->execute([
            ':id' => $cartItemId,
            ':user_id' => $userId,
            ':product_id' => $productId,
            ':variant_id' => $variantId,
            ':qty' => $requestedQuantity
        ]);

        $finalQuantity = $requestedQuantity;
    }

    $db->commit();

    $priceCents = (int) $product['price_cents'] + (int)($variant['price_adjustment'] ?? 0);

    echo json_encode([
        'success' => true,
        'message' => 'Product added to cart.',
        'item' => [
            'id' => $cartItemId,
            'user_id' => $userId,
            'product_id' => $product['id'],
            'variant_id' => $variantId,
            'qty' => $finalQuantity,
            'subtotal_cents' => $priceCents * $finalQuantity,

            'product' => [
                'id' => $product['id'],
                'name' => $product['name'],
                'slug' => $product['slug'],
                'price_cents' => $priceCents,
                'stock' => $stock,
                'variant' => $variant,
                'img_url' => $product['img_url'],
                'model_url' => $product['model_url']
            ]
        ]
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {

    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }

    error_log(
        'Arduino Store cart add error: ' .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to add product to cart.'
    ]);
}
