<?php

declare(strict_types=1);

session_start();
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
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../config/inventory.php';

try {
    $pdo = getDatabaseConnection();
    requireAdmin($pdo);

    $query = $pdo->query(
        'SELECT p.*, c.name AS category_name, c.slug AS category_slug
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         ORDER BY p.name'
    );
    $products = $query->fetchAll(PDO::FETCH_ASSOC);
    $variantQuery = $pdo->query(
        'SELECT v.id, v.product_id, v.variant_name, v.option_value,
                v.price_adjustment, v.stock, v.img_url, p.low_stock_threshold
         FROM variants v
         INNER JOIN products p ON p.id = v.product_id
         ORDER BY v.variant_name, v.option_value'
    );
    $variantsByProduct = [];
    foreach ($variantQuery->fetchAll(PDO::FETCH_ASSOC) as $variant) {
        $variant['price_adjustment'] = (int) $variant['price_adjustment'];
        $variant['stock'] = (int) $variant['stock'];
        $variant['low_stock_threshold'] = (int) $variant['low_stock_threshold'];
        $variant['availability'] = inventoryAvailability($variant['stock'], $variant['low_stock_threshold']);
        $variantsByProduct[$variant['product_id']][] = $variant;
    }

    foreach ($products as &$product) {
        $product['price_cents'] = (int) $product['price_cents'];
        $product['stock'] = (int) $product['stock'];
        $product['low_stock_threshold'] = (int) $product['low_stock_threshold'];
        $product['availability'] = inventoryAvailability($product['stock'], $product['low_stock_threshold']);
        $product['is_low_stock'] = $product['availability'] === 'low_stock';
        $product['specs'] = $product['specs'] === null ? null : json_decode($product['specs'], true);
        $product['tags'] = $product['tags'] === null ? null : json_decode($product['tags'], true);
        $product['variants'] = $variantsByProduct[$product['id']] ?? [];
    }
    unset($product);

    echo json_encode(['success' => true, 'products' => $products, 'count' => count($products)], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Throwable $e) {
    error_log('Inventory list failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to load inventory.']);
}
