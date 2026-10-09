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

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid request body.']);
    exit;
}

$productId = is_string($input['product_id'] ?? null) ? trim($input['product_id']) : '';
$variantId = $input['variant_id'] ?? null;
$quantity = filter_var($input['quantity'] ?? null, FILTER_VALIDATE_INT);
$reason = is_string($input['reason'] ?? null) ? trim($input['reason']) : '';
if (
    $productId === ''
    || ($variantId !== null && (!is_string($variantId) || trim($variantId) === ''))
    || $quantity === false
    || $quantity < 1
    || $reason === ''
    || mb_strlen($reason) > 255
) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'product_id, positive quantity, and a reason of at most 255 characters are required.']);
    exit;
}
$variantId = $variantId === null ? null : trim($variantId);

try {
    $pdo = getDatabaseConnection();
    $actorId = requireAdmin($pdo);
    $pdo->beginTransaction();

    $movement = changeInventoryStock(
        $pdo,
        $productId,
        $variantId,
        $quantity,
        $reason,
        $actorId
    );

    $productQuery = $pdo->prepare(
        'SELECT id, name, sku, stock, low_stock_threshold
         FROM products WHERE id = :id LIMIT 1'
    );
    $productQuery->execute(['id' => $productId]);
    $product = $productQuery->fetch(PDO::FETCH_ASSOC);
    if (!$product) {
        throw new RuntimeException('Product not found.');
    }
    $stock = $movement['stock_after'];
    if ($variantId === null) {
        $product['stock'] = $stock;
        $product['availability'] = inventoryAvailability($stock, (int) $product['low_stock_threshold']);
        $product['is_low_stock'] = $product['availability'] === 'low_stock';
    } else {
        $product['stock'] = (int) $product['stock'];
        $product['availability'] = inventoryAvailability($product['stock'], (int) $product['low_stock_threshold']);
        $product['variant_id'] = $variantId;
        $product['variant_stock'] = $stock;
        $product['variant_availability'] = inventoryAvailability($stock, (int) $product['low_stock_threshold']);
        $product['variant_is_low_stock'] = $product['variant_availability'] === 'low_stock';
    }
    $product['low_stock_threshold'] = (int) $product['low_stock_threshold'];
    $transactionQuery = $pdo->prepare(
        'SELECT id, product_id, variant_id, order_id, order_item_id, movement_type,
                quantity, stock_before, stock_after, reason, actor_id, created_at
         FROM stock_transactions
         WHERE id = :id
         LIMIT 1'
    );
    $transactionQuery->execute(['id' => $movement['id']]);
    $transaction = $transactionQuery->fetch(PDO::FETCH_ASSOC);
    if (!$transaction) {
        throw new RuntimeException('Stock transaction was not recorded.');
    }
    foreach (['quantity', 'stock_before', 'stock_after'] as $field) {
        $transaction[$field] = (int) $transaction[$field];
    }
    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Stock added successfully.',
        'product' => $product,
        'transaction' => $transaction,
    ], JSON_UNESCAPED_UNICODE);
} catch (InventoryUnavailableException $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(409);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Stock addition failed: ' . $e->getMessage());
    http_response_code($e->getMessage() === 'Inventory item not found.' ? 404 : 500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage() === 'Inventory item not found.' ? $e->getMessage() : 'Unable to add stock.',
    ]);
}
