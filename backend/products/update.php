<?php

declare(strict_types=1);

session_start();

header('Access-Control-Allow-Origin: http://localhost:3000');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: PUT, OPTIONS');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
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

requireAdmin($pdo);

$data = json_decode(file_get_contents('php://input'), true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Invalid request body.'
    ]);
    exit;
}

$id = trim((string)($data['id'] ?? ''));
$name = trim((string)($data['name'] ?? ''));
$slug = trim((string)($data['slug'] ?? ''));
$priceCents = filter_var($data['price_cents'] ?? null, FILTER_VALIDATE_INT);
$stock = filter_var($data['stock'] ?? null, FILTER_VALIDATE_INT);
$categoryId = !empty($data['category_id']) ? $data['category_id'] : null;
$sku = !empty($data['sku']) ? trim((string)$data['sku']) : null;
$description = !empty($data['description']) ? trim((string)$data['description']) : null;
$imgUrl = !empty($data['img_url']) ? trim((string)$data['img_url']) : null;
$modelUrl = isset($data['model_url']) && $data['model_url'] !== '' ? (is_string($data['model_url']) ? trim($data['model_url']) : false) : null;
$weightG = $data['weight_g'] ?? null;
$weightG = $weightG === null || $weightG === '' ? null : filter_var($weightG, FILTER_VALIDATE_INT);
$specs = $data['specs'] ?? null;
$tags = $data['tags'] ?? null;
if (($modelUrl === false) || ($weightG === false) || ($weightG !== null && $weightG < 0) || ($specs !== null && (!is_array($specs) || array_is_list($specs))) || ($tags !== null && (!is_array($tags) || !array_is_list($tags))) || (is_array($tags) && count(array_filter($tags, 'is_string')) !== count($tags))) {
    http_response_code(422); echo json_encode(['success'=>false,'message'=>'Invalid model_url, weight_g, specs, or tags.']); exit;
}

if (
    $id === '' ||
    $name === '' ||
    $slug === '' ||
    $priceCents === false ||
    $stock === false
) {
    http_response_code(422);
    echo json_encode([
        'success' => false,
        'message' => 'ID, name, slug, price, and stock are required.'
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
    'SELECT id FROM products WHERE id = :id LIMIT 1'
);
$stmt->execute([
    'id' => $id
]);

if (!$stmt->fetch()) {
    http_response_code(404);
    echo json_encode([
        'success' => false,
        'message' => 'Product not found.'
    ]);
    exit;
}

$stmt = $pdo->prepare(
    'SELECT id FROM products WHERE slug = :slug AND id <> :id LIMIT 1'
);
$stmt->execute([
    'slug' => $slug,
    'id' => $id
]);

if ($stmt->fetch()) {
    http_response_code(409);
    echo json_encode([
        'success' => false,
        'message' => 'A product with this slug already exists.'
    ]);
    exit;
}

if ($sku !== null) {
    $stmt = $pdo->prepare(
        'SELECT id FROM products WHERE sku = :sku AND id <> :id LIMIT 1'
    );
    $stmt->execute([
        'sku' => $sku,
        'id' => $id
    ]);

    if ($stmt->fetch()) {
        http_response_code(409);
        echo json_encode([
            'success' => false,
            'message' => 'A product with this SKU already exists.'
        ]);
        exit;
    }
}

$stmt = $pdo->prepare(
    'UPDATE products
     SET name = :name,
         slug = :slug,
         price_cents = :price_cents,
         stock = :stock,
         description = :description,
         img_url = :img_url,
         category_id = :category_id,
         sku = :sku
         ,model_url = :model_url,
         weight_g = :weight_g,
         specs = :specs,
         tags = :tags
     WHERE id = :id'
);

$stmt->execute([
    'name' => $name,
    'slug' => $slug,
    'price_cents' => $priceCents,
    'stock' => $stock,
    'description' => $description,
    'img_url' => $imgUrl,
    'category_id' => $categoryId,
    'sku' => $sku,
    'model_url' => $modelUrl,
    'weight_g' => $weightG,
    'specs' => $specs === null ? null : json_encode($specs, JSON_UNESCAPED_UNICODE),
    'tags' => $tags === null ? null : json_encode($tags, JSON_UNESCAPED_UNICODE),
    'id' => $id
]);

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

echo json_encode([
    'success' => true,
    'message' => 'Product updated successfully.',
    'product' => $product
], JSON_UNESCAPED_UNICODE);
