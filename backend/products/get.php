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

$slug = trim($_GET['slug'] ?? '');

if ($slug === '') {
    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' => 'Product slug is required.'
    ]);

    exit;
}

try {
    $db = getDatabaseConnection();

    $sql = "
        SELECT
            p.id,
            p.name,
            p.slug,
            p.price_cents,
            p.stock,
            p.description,
            p.img_url,
            p.model_url,
            p.created_at,
            p.category_id,
            p.specs,
            p.tags,
            p.weight_g,
            p.sku,
            c.name AS category_name,
            c.slug AS category_slug
        FROM products p
        LEFT JOIN categories c
            ON c.id = p.category_id
        WHERE p.slug = :slug
        LIMIT 1
    ";

    $statement = $db->prepare($sql);

    $statement->execute([
        ':slug' => $slug
    ]);

    $product = $statement->fetch();

    if (!$product) {
        http_response_code(404);

        echo json_encode([
            'success' => false,
            'message' => 'Product not found.'
        ]);

        exit;
    }

    if (
        isset($product['specs']) &&
        $product['specs'] !== null &&
        $product['specs'] !== ''
    ) {
        $decodedSpecs = json_decode(
            $product['specs'],
            true
        );

        $product['specs'] =
            json_last_error() === JSON_ERROR_NONE
                ? $decodedSpecs
                : null;
    } else {
        $product['specs'] = null;
    }

    if (
        isset($product['tags']) &&
        $product['tags'] !== null &&
        $product['tags'] !== ''
    ) {
        $decodedTags = json_decode(
            $product['tags'],
            true
        );

        $product['tags'] =
            json_last_error() === JSON_ERROR_NONE
                ? $decodedTags
                : null;
    } else {
        $product['tags'] = null;
    }

    $product['price_cents'] = (int) $product['price_cents'];
    $product['stock'] = (int) $product['stock'];

    if ($product['weight_g'] !== null) {
        $product['weight_g'] = (int) $product['weight_g'];
    }

    $variants = $db->prepare('SELECT id, product_id, variant_name, option_value, price_adjustment, stock, img_url FROM variants WHERE product_id = :product_id ORDER BY variant_name, option_value');
    $variants->execute(['product_id' => $product['id']]);
    $product['variants'] = $variants->fetchAll();
    foreach ($product['variants'] as &$variant) {
        $variant['price_adjustment'] = (int) $variant['price_adjustment'];
        $variant['stock'] = (int) $variant['stock'];
    }
    unset($variant);

    echo json_encode([
        'success' => true,
        'product' => $product
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

} catch (Throwable $e) {
    error_log(
        'Arduino Store product API error: ' .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to load product.'
    ]);
}
