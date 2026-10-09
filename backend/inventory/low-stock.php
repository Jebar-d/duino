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

try {
    $pdo = getDatabaseConnection();
    requireAdmin($pdo);

    $products = $pdo->query(
        'SELECT id AS product_id, NULL AS variant_id, name AS product_name,
                sku, stock, low_stock_threshold, "product" AS item_type
         FROM products
         WHERE stock > 0 AND stock <= low_stock_threshold
         UNION ALL
         SELECT p.id AS product_id, v.id AS variant_id, p.name AS product_name,
                p.sku, v.stock, p.low_stock_threshold, "variant" AS item_type
         FROM variants v
         INNER JOIN products p ON p.id = v.product_id
         WHERE v.stock > 0 AND v.stock <= p.low_stock_threshold
         ORDER BY stock ASC'
    )->fetchAll(PDO::FETCH_ASSOC);
    foreach ($products as &$product) {
        $product['stock'] = (int) $product['stock'];
        $product['low_stock_threshold'] = (int) $product['low_stock_threshold'];
        $product['availability'] = 'low_stock';
        $product['is_low_stock'] = true;
    }
    unset($product);

    echo json_encode(['success' => true, 'products' => $products, 'count' => count($products)], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    error_log('Low stock list failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to load low-stock inventory.']);
}
