<?php

declare(strict_types=1);

session_start();

header('Access-Control-Allow-Origin: http://localhost:3000');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';
require_once __DIR__ . '/../config/inventory.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
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
$actorId = requireAdmin($pdo);

$data = json_decode(file_get_contents('php://input'), true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Invalid request body.'
    ]);
    exit;
}

$name = trim((string)($data['name'] ?? ''));
$slug = trim((string)($data['slug'] ?? ''));
$priceCents = filter_var($data['price_cents'] ?? null, FILTER_VALIDATE_INT);
$stock = filter_var($data['stock'] ?? null, FILTER_VALIDATE_INT);
$categoryId = !empty($data['category_id']) ? $data['category_id'] : null;
$lowStockThreshold = filter_var(
    $data['low_stock_threshold'] ?? 5,
    FILTER_VALIDATE_INT
);
$description = !empty($data['description']) ? trim((string)$data['description']) : null;
$imgUrl = !empty($data['img_url']) ? trim((string)$data['img_url']) : null;
$modelUrl = isset($data['model_url']) && $data['model_url'] !== '' ? (is_string($data['model_url']) ? trim($data['model_url']) : false) : null;
$weightG = $data['weight_g'] ?? null;
$weightG = $weightG === null || $weightG === '' ? null : filter_var($weightG, FILTER_VALIDATE_INT);
$specs = $data['specs'] ?? null;
$tags = $data['tags'] ?? null;

if (($modelUrl === false) || ($weightG === false) || ($weightG !== null && $weightG < 0) || $lowStockThreshold === false || $lowStockThreshold < 0 || ($specs !== null && (!is_array($specs) || array_is_list($specs))) || ($tags !== null && (!is_array($tags) || !array_is_list($tags))) || (is_array($tags) && count(array_filter($tags, 'is_string')) !== count($tags))) {
    http_response_code(422); echo json_encode(['success'=>false,'message'=>'Invalid model_url, weight_g, specs, or tags.']); exit;
}

if ($name === '' || $slug === '' || $priceCents === false || $stock === false) {
    http_response_code(422);
    echo json_encode([
        'success' => false,
        'message' => 'Name, slug, price, and stock are required.'
    ]);
    exit;
}

if ($priceCents < 0 || $stock < 0) {
    http_response_code(422);
    echo json_encode([
        'success' => false,
        'message' => 'Price and stock cannot be negative.'
    ]);
    exit;
}

$stmt = $pdo->prepare(
    'SELECT id FROM products WHERE slug = :slug LIMIT 1'
);
$stmt->execute([
    'slug' => $slug
]);

if ($stmt->fetch()) {
    http_response_code(409);
    echo json_encode([
        'success' => false,
        'message' => 'A product with this slug already exists.'
    ]);
    exit;
}

$id = bin2hex(random_bytes(16));
$sku = generateProductSku($pdo);

$pdo->beginTransaction();
try {
    $stmt = $pdo->prepare(
        'INSERT INTO products
        (id, name, slug, price_cents, stock, description, img_url, category_id, sku,
         model_url, weight_g, specs, tags, low_stock_threshold)
        VALUES
        (:id, :name, :slug, :price_cents, 0, :description, :img_url, :category_id, :sku,
         :model_url, :weight_g, :specs, :tags, :low_stock_threshold)'
    );

    $stmt->execute([
        'id' => $id,
        'name' => $name,
        'slug' => $slug,
        'price_cents' => $priceCents,
        'description' => $description,
        'img_url' => $imgUrl,
        'category_id' => $categoryId,
        'sku' => $sku,
        'model_url' => $modelUrl,
        'weight_g' => $weightG,
        'specs' => $specs === null ? null : json_encode($specs, JSON_UNESCAPED_UNICODE),
        'tags' => $tags === null ? null : json_encode($tags, JSON_UNESCAPED_UNICODE),
        'low_stock_threshold' => $lowStockThreshold,
    ]);

    if ($stock > 0) {
        changeInventoryStock($pdo, $id, null, $stock, 'Initial stock on product creation.', $actorId);
    }
    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $e;
}

$stmt = $pdo->prepare(
    'SELECT p.*, c.name AS category_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.id = :id
     LIMIT 1'
);

$stmt->execute([
    'id' => $id
]);

$product = $stmt->fetch();
$product['specs'] = $product['specs'] === null ? null : json_decode($product['specs'], true);
$product['tags'] = $product['tags'] === null ? null : json_decode($product['tags'], true);
$product['price_cents'] = (int) $product['price_cents'];
$product['stock'] = (int) $product['stock'];
$product['low_stock_threshold'] = (int) $product['low_stock_threshold'];
$product['availability'] = inventoryAvailability($product['stock'], $product['low_stock_threshold']);
$product['is_low_stock'] = $product['availability'] === 'low_stock';

echo json_encode([
    'success' => true,
    'message' => 'Product created successfully.',
    'product' => $product
], JSON_UNESCAPED_UNICODE);
