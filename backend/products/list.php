<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Arduino Store - Products API
|--------------------------------------------------------------------------
|
| GET /arduino-store/backend/products/list.php
|
| Optional parameters:
|
|   ?search=arduino
|   ?category_id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
|
| Examples:
|
|   products/list.php
|   products/list.php?search=arduino
|   products/list.php?category_id=123
|   products/list.php?search=sensor&category_id=123
|
|--------------------------------------------------------------------------
*/


// ------------------------------------------------------------
// CORS
// ------------------------------------------------------------

header('Access-Control-Allow-Origin: http://localhost:3000');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');


// ------------------------------------------------------------
// Handle browser preflight requests
// ------------------------------------------------------------

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}


// ------------------------------------------------------------
// Only GET is allowed
// ------------------------------------------------------------

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);

    echo json_encode(
        [
            'success' => false,
            'message' => 'Method not allowed.',
        ],
        JSON_UNESCAPED_UNICODE
    );

    exit;
}


// ------------------------------------------------------------
// Database
// ------------------------------------------------------------

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/inventory.php';


// ------------------------------------------------------------
// Read query parameters
// ------------------------------------------------------------

$search = trim($_GET['search'] ?? '');
$categoryId = trim($_GET['category_id'] ?? '');


// ------------------------------------------------------------
// Build SQL query
// ------------------------------------------------------------

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
        p.low_stock_threshold,

        c.name AS category_name,
        c.slug AS category_slug

    FROM products p

    LEFT JOIN categories c
        ON c.id = p.category_id

    WHERE 1 = 1
";

$params = [];


// ------------------------------------------------------------
// Search filter
// ------------------------------------------------------------

if ($search !== '') {
    $sql .= "
        AND (
            p.name LIKE :search_name
            OR p.description LIKE :search_description
            OR p.sku LIKE :search_sku
        )
    ";

    $searchValue = '%' . $search . '%';

    $params[':search_name'] = $searchValue;
    $params[':search_description'] = $searchValue;
    $params[':search_sku'] = $searchValue;
}


// ------------------------------------------------------------
// Category filter
// ------------------------------------------------------------

if ($categoryId !== '') {
    $sql .= "
        AND p.category_id = :category_id
    ";

    $params[':category_id'] = $categoryId;
}


// ------------------------------------------------------------
// Sort newest products first
// ------------------------------------------------------------

$sql .= "
    ORDER BY p.created_at DESC
";


try {
    // --------------------------------------------------------
    // Connect to database
    // --------------------------------------------------------

    $db = getDatabaseConnection();


    // --------------------------------------------------------
    // Execute query
    // --------------------------------------------------------

    $statement = $db->prepare($sql);

    $statement->execute($params);

    $products = $statement->fetchAll();

    if ($products !== []) {
        $placeholders = [];
        $variantParams = [];
        foreach ($products as $index => $product) {
            $placeholder = ':product_' . $index;
            $placeholders[] = $placeholder;
            $variantParams[$placeholder] = $product['id'];
        }

        $variantQuery = $db->prepare(
            'SELECT v.id, v.product_id, v.variant_name, v.option_value,
                    v.price_adjustment, v.stock, v.img_url, p.low_stock_threshold
             FROM variants v
             INNER JOIN products p ON p.id = v.product_id
             WHERE v.product_id IN (' . implode(', ', $placeholders) . ')
             ORDER BY v.variant_name, v.option_value'
        );
        $variantQuery->execute($variantParams);
        $variantsByProduct = [];
        foreach ($variantQuery->fetchAll(PDO::FETCH_ASSOC) as $variant) {
            $variant['price_adjustment'] = (int) $variant['price_adjustment'];
            $variant['stock'] = (int) $variant['stock'];
            $variant['low_stock_threshold'] = (int) $variant['low_stock_threshold'];
            $variant['availability'] = inventoryAvailability($variant['stock'], $variant['low_stock_threshold']);
            $variantsByProduct[$variant['product_id']][] = $variant;
        }

        foreach ($products as &$product) {
            $product['variants'] = $variantsByProduct[$product['id']] ?? [];
        }
        unset($product);
    }


    // --------------------------------------------------------
    // Convert JSON database fields
    // --------------------------------------------------------

    foreach ($products as &$product) {

        /*
         * specs is stored as JSON in MySQL.
         *
         * Convert it back into a PHP array/object before
         * sending it to Next.js.
         */

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


        /*
         * tags is also stored as JSON.
         */

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


        /*
         * Convert numeric database values to actual numbers
         * instead of returning them as strings.
         */

        $product['price_cents'] =
            (int) $product['price_cents'];

        $product['stock'] =
            (int) $product['stock'];
        $product['low_stock_threshold'] =
            (int) $product['low_stock_threshold'];
        $product['availability'] =
            inventoryAvailability($product['stock'], $product['low_stock_threshold']);
        $product['is_low_stock'] =
            $product['availability'] === 'low_stock';

        if ($product['weight_g'] !== null) {
            $product['weight_g'] =
                (int) $product['weight_g'];
        }
    }

    unset($product);


    // --------------------------------------------------------
    // Return successful response
    // --------------------------------------------------------

    echo json_encode(
        [
            'success' => true,
            'products' => $products,
            'count' => count($products),
        ],
        JSON_UNESCAPED_UNICODE |
        JSON_UNESCAPED_SLASHES
    );

} catch (Throwable $e) {

    /*
     * Log the actual error on the server.
     *
     * Do not expose SQL/database details to the browser.
     */

    error_log(
        'Arduino Store products API error: ' .
        $e->getMessage()
    );


    // --------------------------------------------------------
    // Return safe error
    // --------------------------------------------------------

    http_response_code(500);

    echo json_encode(
        [
            'success' => false,
            'message' => 'Unable to load products.',
        ],
        JSON_UNESCAPED_UNICODE
    );
}