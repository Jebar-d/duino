<?php

declare(strict_types=1);

session_start();
header('Access-Control-Allow-Origin: http://localhost:3000');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: PUT, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (!in_array($_SERVER['REQUEST_METHOD'], ['PUT', 'POST'], true)) {
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
    $productId = trim((string) ($input['product_id'] ?? ''));
    $variantName = trim((string) ($input['variant_name'] ?? ''));
    $optionValue = trim((string) ($input['option_value'] ?? ''));
    $priceAdjustment = filter_var($input['price_adjustment'] ?? null, FILTER_VALIDATE_INT);
    $stock = filter_var($input['stock'] ?? null, FILTER_VALIDATE_INT);

    if (
        $variantId === ''
        || $productId === ''
        || $variantName === ''
        || $optionValue === ''
        || mb_strlen($variantName) > 100
        || mb_strlen($optionValue) > 100
        || $priceAdjustment === false
        || $stock === false
        || $stock < 0
    ) {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Invalid variant fields.']);
        exit;
    }

    $product = $pdo->prepare('SELECT id FROM products WHERE id = :id LIMIT 1');
    $product->execute(['id' => $productId]);
    if (!$product->fetchColumn()) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Product not found.']);
        exit;
    }

    $duplicate = $pdo->prepare(
        'SELECT id
         FROM variants
         WHERE product_id = :product_id
           AND variant_name = :variant_name
           AND option_value = :option_value
           AND id <> :id
         LIMIT 1'
    );
    $duplicate->execute([
        'product_id' => $productId,
        'variant_name' => $variantName,
        'option_value' => $optionValue,
        'id' => $variantId,
    ]);
    if ($duplicate->fetchColumn()) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'Variant already exists.']);
        exit;
    }

    $update = $pdo->prepare(
        'UPDATE variants
         SET product_id = :product_id,
             variant_name = :variant_name,
             option_value = :option_value,
             price_adjustment = :price_adjustment,
             stock = :stock
         WHERE id = :id'
    );
    $update->execute([
        'product_id' => $productId,
        'variant_name' => $variantName,
        'option_value' => $optionValue,
        'price_adjustment' => $priceAdjustment,
        'stock' => $stock,
        'id' => $variantId,
    ]);
    if ($update->rowCount() === 0) {
        $exists = $pdo->prepare('SELECT id FROM variants WHERE id = :id LIMIT 1');
        $exists->execute(['id' => $variantId]);
        if (!$exists->fetchColumn()) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Variant not found.']);
            exit;
        }
    }

    echo json_encode([
        'success' => true,
        'message' => 'Variant updated.',
        'variant' => [
            'id' => $variantId,
            'product_id' => $productId,
            'variant_name' => $variantName,
            'option_value' => $optionValue,
            'price_adjustment' => $priceAdjustment,
            'stock' => $stock,
        ],
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    error_log('Variant update error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to update variant.']);
}
