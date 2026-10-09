<?php

declare(strict_types=1);

session_start();
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

    $productId = trim((string) ($input['product_id'] ?? ''));
    $variantName = trim((string) ($input['variant_name'] ?? ''));
    $optionValue = trim((string) ($input['option_value'] ?? ''));
    $priceAdjustment = filter_var($input['price_adjustment'] ?? null, FILTER_VALIDATE_INT);
    $stock = filter_var($input['stock'] ?? null, FILTER_VALIDATE_INT);

    if (
        $productId === ''
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

    $product = $pdo->prepare('SELECT id, low_stock_threshold FROM products WHERE id = :id LIMIT 1');
    $product->execute(['id' => $productId]);
    $productRow = $product->fetch(PDO::FETCH_ASSOC);
    if (!$productRow) {
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
         LIMIT 1'
    );
    $duplicate->execute([
        'product_id' => $productId,
        'variant_name' => $variantName,
        'option_value' => $optionValue,
    ]);
    if ($duplicate->fetchColumn()) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'Variant already exists.']);
        exit;
    }

    $variantId = newUuid();
    $pdo->beginTransaction();
    $insert = $pdo->prepare(
        'INSERT INTO variants
            (id, product_id, variant_name, option_value, price_adjustment, stock)
         VALUES
            (:id, :product_id, :variant_name, :option_value, :price_adjustment, 0)'
    );
    $insert->execute([
        'id' => $variantId,
        'product_id' => $productId,
        'variant_name' => $variantName,
        'option_value' => $optionValue,
        'price_adjustment' => $priceAdjustment,
    ]);
    if ($stock > 0) {
        changeInventoryStock(
            $pdo,
            $productId,
            $variantId,
            $stock,
            'Initial variant stock.',
            (string) $_SESSION['user_id']
        );
    }
    $pdo->commit();

    echo json_encode([
        'success' => true,
        'variant' => [
            'id' => $variantId,
            'product_id' => $productId,
            'variant_name' => $variantName,
            'option_value' => $optionValue,
            'price_adjustment' => $priceAdjustment,
            'stock' => $stock,
            'availability' => inventoryAvailability($stock, (int) $productRow['low_stock_threshold']),
            'img_url' => null,
        ],
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Variant creation error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to create variant.']);
}
