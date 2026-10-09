<?php

declare(strict_types=1);

header('Access-Control-Allow-Origin: http://localhost:3000');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
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

try {
    $db = getDatabaseConnection();

    $statement = $db->prepare(
        'SELECT
            ci.id,
            ci.user_id,
            ci.product_id,
            ci.variant_id,
            ci.qty,
            ci.created_at,

            p.name AS product_name,
            p.slug AS product_slug,
            p.price_cents,
            p.stock,
            v.stock AS variant_stock, v.price_adjustment, v.variant_name, v.option_value,
            p.description,
            p.img_url,
            p.model_url,
            p.category_id

        FROM cart_items ci

        INNER JOIN products p
            ON p.id = ci.product_id
        LEFT JOIN variants v ON v.id = ci.variant_id

        WHERE ci.user_id = :user_id

        ORDER BY ci.created_at DESC'
    );

    $statement->execute([
        ':user_id' => $userId
    ]);

    $items = $statement->fetchAll();

    $cartItems = [];

    $totalCents = 0;
    $totalQuantity = 0;

    foreach ($items as $item) {
        $quantity = (int) $item['qty'];
        $priceCents = (int) $item['price_cents'] + (int)($item['price_adjustment'] ?? 0);

        $subtotalCents = $priceCents * $quantity;

        $totalCents += $subtotalCents;
        $totalQuantity += $quantity;

        $cartItems[] = [
            'id' => $item['id'],
            'user_id' => $item['user_id'],
            'product_id' => $item['product_id'],
            'variant_id' => $item['variant_id'],
            'qty' => $quantity,
            'created_at' => $item['created_at'],

            'product' => [
                'id' => $item['product_id'],
                'name' => $item['product_name'],
                'slug' => $item['product_slug'],
                'price_cents' => $priceCents,
                'stock' => $item['variant_id'] !== null ? (int)$item['variant_stock'] : (int) $item['stock'],
                'variant' => $item['variant_id'] !== null ? ['id'=>$item['variant_id'],'variant_name'=>$item['variant_name'],'option_value'=>$item['option_value']] : null,
                'description' => $item['description'],
                'img_url' => $item['img_url'],
                'model_url' => $item['model_url'],
                'category_id' => $item['category_id']
            ],

            'subtotal_cents' => $subtotalCents
        ];
    }

    echo json_encode([
        'success' => true,
        'items' => $cartItems,
        'count' => count($cartItems),
        'total_quantity' => $totalQuantity,
        'total_cents' => $totalCents
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {

    error_log(
        'Arduino Store cart list error: ' .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to load cart.'
    ]);
}
