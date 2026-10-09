<?php

ini_set("display_errors", "0");
ini_set("log_errors", "1");
error_reporting(E_ALL);

header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json; charset=utf-8");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);
    exit;
}

session_set_cookie_params([
    "lifetime" => 0,
    "path" => "/",
    "secure" => false,
    "httponly" => true,
    "samesite" => "Lax"
]);

session_start();

require_once __DIR__ . "/../config/database.php";

$pdo = getDatabaseConnection();

if (empty($_SESSION["user_id"])) {
    http_response_code(401);
    echo json_encode([
        "success" => false,
        "message" => "You must be logged in."
    ]);
    exit;
}

$input = json_decode(
    file_get_contents("php://input"),
    true
);

if (!is_array($input)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Invalid request data."
    ]);
    exit;
}

$productId = trim((string) ($input["product_id"] ?? ""));

if ($productId === "") {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Product ID is required."
    ]);
    exit;
}

try {
    $productQuery = $pdo->prepare("
        SELECT id, name, slug, price_cents, stock, description, img_url, model_url, category_id
        FROM products
        WHERE id = :product_id
        LIMIT 1
    ");

    $productQuery->execute([
        "product_id" => $productId
    ]);

    $product = $productQuery->fetch(PDO::FETCH_ASSOC);

    if (!$product) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Product not found."
        ]);
        exit;
    }

    $existingQuery = $pdo->prepare("
        SELECT id
        FROM wishlists
        WHERE user_id = :user_id
        AND product_id = :product_id
        LIMIT 1
    ");

    $existingQuery->execute([
        "user_id" => $_SESSION["user_id"],
        "product_id" => $productId
    ]);

    $existing = $existingQuery->fetch(PDO::FETCH_ASSOC);

    if ($existing) {
        echo json_encode([
            "success" => true,
            "message" => "Product is already in your wishlist.",
            "already_exists" => true,
            "wishlist_id" => $existing["id"],
            "product" => [
                "id" => $product["id"],
                "name" => $product["name"],
                "slug" => $product["slug"],
                "price_cents" => (int) $product["price_cents"],
                "stock" => (int) $product["stock"],
                "description" => $product["description"],
                "img_url" => $product["img_url"],
                "model_url" => $product["model_url"],
                "category_id" => $product["category_id"]
            ]
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $wishlistId = bin2hex(random_bytes(16));

    $insert = $pdo->prepare("
        INSERT INTO wishlists (
            id,
            user_id,
            product_id
        )
        VALUES (
            :id,
            :user_id,
            :product_id
        )
    ");

    $insert->execute([
        "id" => $wishlistId,
        "user_id" => $_SESSION["user_id"],
        "product_id" => $productId
    ]);

    echo json_encode([
        "success" => true,
        "message" => "Product added to wishlist.",
        "already_exists" => false,
        "wishlist_id" => $wishlistId,
        "product" => [
            "id" => $product["id"],
            "name" => $product["name"],
            "slug" => $product["slug"],
            "price_cents" => (int) $product["price_cents"],
            "stock" => (int) $product["stock"],
            "description" => $product["description"],
            "img_url" => $product["img_url"],
            "model_url" => $product["model_url"],
            "category_id" => $product["category_id"]
        ]
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    error_log(
        "Arduino Store wishlist add error: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to add product to wishlist."
    ]);
}