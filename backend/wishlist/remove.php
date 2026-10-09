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

$wishlistId = trim((string) ($input["wishlist_id"] ?? ""));
$productId = trim((string) ($input["product_id"] ?? ""));

if ($wishlistId === "" && $productId === "") {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Wishlist ID or product ID is required."
    ]);
    exit;
}

try {
    if ($wishlistId !== "") {
        $delete = $pdo->prepare("
            DELETE FROM wishlists
            WHERE id = :wishlist_id
            AND user_id = :user_id
        ");

        $delete->execute([
            "wishlist_id" => $wishlistId,
            "user_id" => $_SESSION["user_id"]
        ]);
    } else {
        $delete = $pdo->prepare("
            DELETE FROM wishlists
            WHERE product_id = :product_id
            AND user_id = :user_id
        ");

        $delete->execute([
            "product_id" => $productId,
            "user_id" => $_SESSION["user_id"]
        ]);
    }

    if ($delete->rowCount() === 0) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Wishlist item not found."
        ]);
        exit;
    }

    echo json_encode([
        "success" => true,
        "message" => "Product removed from wishlist."
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    error_log(
        "Arduino Store wishlist remove error: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to remove product from wishlist."
    ]);
}