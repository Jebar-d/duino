<?php

declare(strict_types=1);

require_once __DIR__ . '/auth.php';

class InventoryUnavailableException extends RuntimeException
{
}

function generateProductSku(PDO $pdo): string
{
    for ($attempt = 0; $attempt < 10; $attempt++) {
        $sku = 'ARD-' . strtoupper(bin2hex(random_bytes(8)));
        $query = $pdo->prepare('SELECT 1 FROM products WHERE sku = :sku LIMIT 1');
        $query->execute(['sku' => $sku]);
        if (!$query->fetchColumn()) {
            return $sku;
        }
    }

    throw new RuntimeException('Unable to generate a unique product SKU.');
}

function inventoryAvailability(int $stock, int $threshold): string
{
    if ($stock === 0) {
        return 'out_of_stock';
    }

    return $stock <= $threshold ? 'low_stock' : 'in_stock';
}

function changeInventoryStock(
    PDO $pdo,
    string $productId,
    ?string $variantId,
    int $delta,
    string $reason,
    ?string $actorId = null,
    ?string $orderId = null,
    ?string $orderItemId = null,
    ?string $idempotencyKey = null
): array {
    if ($delta === 0) {
        throw new InvalidArgumentException('Stock change must be non-zero.');
    }

    if ($idempotencyKey !== null) {
        $existing = $pdo->prepare(
            'SELECT id, stock_before, stock_after, movement_type, quantity
             FROM stock_transactions
             WHERE idempotency_key = :idempotency_key
             LIMIT 1'
        );
        $existing->execute(['idempotency_key' => $idempotencyKey]);
        $movement = $existing->fetch(PDO::FETCH_ASSOC);
    }

    if ($variantId !== null) {
        $stockQuery = $pdo->prepare(
            'SELECT stock FROM variants
             WHERE id = :variant_id AND product_id = :product_id
             FOR UPDATE'
        );
        $stockQuery->execute([
            'variant_id' => $variantId,
            'product_id' => $productId,
        ]);
        $table = 'variants';
        $recordId = $variantId;
    } else {
        $stockQuery = $pdo->prepare(
            'SELECT stock FROM products WHERE id = :product_id FOR UPDATE'
        );
        $stockQuery->execute(['product_id' => $productId]);
        $table = 'products';
        $recordId = $productId;
    }

    $stockValue = $stockQuery->fetchColumn();
    if ($stockValue === false) {
        throw new RuntimeException('Inventory item not found.');
    }

    $before = (int) $stockValue;
    if ($idempotencyKey !== null && $movement) {
        $expectedType = $delta > 0 ? 'IN' : 'OUT';
        if (
            $movement['movement_type'] !== $expectedType
            || (int) $movement['quantity'] !== abs($delta)
        ) {
            throw new RuntimeException('Inventory idempotency key conflicts with the requested stock movement.');
        }
        return [
            'id' => $movement['id'],
            'stock_before' => (int) $movement['stock_before'],
            'stock_after' => (int) $movement['stock_after'],
            'movement_type' => $movement['movement_type'],
            'quantity' => (int) $movement['quantity'],
        ];
    }

    $after = $before + $delta;
    if ($after < 0) {
        throw new InventoryUnavailableException('Insufficient stock available.');
    }

    $update = $pdo->prepare(
        "UPDATE {$table} SET stock = :stock WHERE id = :id AND stock = :previous_stock"
    );
    $update->execute([
        'stock' => $after,
        'id' => $recordId,
        'previous_stock' => $before,
    ]);
    if ($update->rowCount() !== 1) {
        throw new InventoryUnavailableException('Stock changed while processing; please retry.');
    }

    $movementType = $delta > 0 ? 'IN' : 'OUT';
    $quantity = abs($delta);
    $transactionId = newUuid();
    $insert = $pdo->prepare(
        'INSERT INTO stock_transactions
            (id, product_id, variant_id, order_id, order_item_id, movement_type,
             quantity, stock_before, stock_after, reason, actor_id, idempotency_key)
         VALUES
            (:id, :product_id, :variant_id, :order_id, :order_item_id, :movement_type,
             :quantity, :stock_before, :stock_after, :reason, :actor_id, :idempotency_key)'
    );
    $insert->execute([
        'id' => $transactionId,
        'product_id' => $productId,
        'variant_id' => $variantId,
        'order_id' => $orderId,
        'order_item_id' => $orderItemId,
        'movement_type' => $movementType,
        'quantity' => $quantity,
        'stock_before' => $before,
        'stock_after' => $after,
        'reason' => $reason,
        'actor_id' => $actorId,
        'idempotency_key' => $idempotencyKey,
    ]);

    return [
        'id' => $transactionId,
        'stock_before' => $before,
        'stock_after' => $after,
        'movement_type' => $movementType,
        'quantity' => $quantity,
    ];
}
