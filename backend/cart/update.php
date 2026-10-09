<?php

declare(strict_types=1);

header('Access-Control-Allow-Origin: http://localhost:3000');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: PUT, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (
    $_SERVER['REQUEST_METHOD'] !== 'PUT' &&
    $_SERVER['REQUEST_METHOD'] !== 'POST'
) {
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
        'message' => 'Please log in before updating your cart.'
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

$cartItemId = trim((string) ($input['id'] ?? ''));
$requestedQuantity = (int) ($input['qty'] ?? 0);

if ($cartItemId === '') {
    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' => 'Cart item ID is required.'
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
     * Find the cart item belonging to the currently
     * authenticated user and lock it for this transaction.
     */
    $cartStatement = $db->prepare(
        'SELECT
            ci.id,
            ci.user_id,
            ci.product_id,
            ci.variant_id,
            ci.qty,

            p.name AS product_name,
            p.slug AS product_slug,
            p.price_cents,
            p.stock,
            v.stock AS variant_stock, v.price_adjustment,
            p.img_url,
            p.model_url

         FROM cart_items ci

         INNER JOIN products p
            ON p.id = ci.product_id
         LEFT JOIN variants v ON v.id=ci.variant_id

         WHERE ci.id = :cart_item_id
           AND ci.user_id = :user_id

         LIMIT 1

         FOR UPDATE'
    );

    $cartStatement->execute([
        ':cart_item_id' => $cartItemId,
        ':user_id' => $userId
    ]);

    $cartItem = $cartStatement->fetch();

    if (!$cartItem) {
        $db->rollBack();

        http_response_code(404);

        echo json_encode([
            'success' => false,
            'message' => 'Cart item not found.'
        ]);

        exit;
    }

    $stock = $cartItem['variant_id'] !== null ? (int)$cartItem['variant_stock'] : (int) $cartItem['stock'];

    if ($stock <= 0) {
        $db->rollBack();

        http_response_code(409);

        echo json_encode([
            'success' => false,
            'message' => 'This product is currently out of stock.',
            'available_stock' => 0
        ]);

        exit;
    }

    if ($requestedQuantity > $stock) {
        $db->rollBack();

        http_response_code(409);

        echo json_encode([
            'success' => false,
            'message' => "Only {$stock} item(s) are currently available.",
            'available_stock' => $stock,
            'requested_quantity' => $requestedQuantity
        ]);

        exit;
    }

    $updateStatement = $db->prepare(
        'UPDATE cart_items
         SET qty = :qty
         WHERE id = :id
           AND user_id = :user_id'
    );

    $updateStatement->execute([
        ':qty' => $requestedQuantity,
        ':id' => $cartItemId,
        ':user_id' => $userId
    ]);

    $db->commit();

    $priceCents = (int) $cartItem['price_cents'] + (int)($cartItem['price_adjustment'] ?? 0);
    $subtotalCents = $priceCents * $requestedQuantity;

    echo json_encode([
        'success' => true,
        'message' => 'Cart quantity updated.',
        'item' => [
            'id' => $cartItem['id'],
            'user_id' => $cartItem['user_id'],
            'product_id' => $cartItem['product_id'],
            'variant_id' => $cartItem['variant_id'],
            'qty' => $requestedQuantity,
            'subtotal_cents' => $subtotalCents,

            'product' => [
                'id' => $cartItem['product_id'],
                'name' => $cartItem['product_name'],
                'slug' => $cartItem['product_slug'],
                'price_cents' => $priceCents,
                'stock' => $stock,
                'img_url' => $cartItem['img_url'],
                'model_url' => $cartItem['model_url']
            ]
        ]
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {

    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }

    error_log(
        'Arduino Store cart update error: ' .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to update cart.'
    ]);
}
