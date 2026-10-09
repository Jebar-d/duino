<?php

ini_set("display_errors", "0");
ini_set("log_errors", "1");
error_reporting(E_ALL);

header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Content-Type: application/json; charset=utf-8");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
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

try {
    $query = $pdo->prepare("
        SELECT
            w.id,
            w.user_id,
            w.product_id,
            w.created_at,
            p.id AS product_id_value,
            p.name,
            p.slug,
            p.price_cents,
            p.stock,
            p.description,
            p.img_url,
            p.model_url,
            p.created_at AS product_created_at,
            p.category_id
        FROM wishlists w
        INNER JOIN products p
            ON p.id = w.product_id
        WHERE w.user_id = :user_id
        ORDER BY w.created_at DESC
    ");

    $query->execute([
        "user_id" => $_SESSION["user_id"]
    ]);

    $rows = $query->fetchAll(PDO::FETCH_ASSOC);

    $items = [];

    foreach ($rows as $row) {
        $items[] = [
            "id" => $row["id"],
            "user_id" => $row["user_id"],
            "product_id" => $row["product_id"],
            "created_at" => $row["created_at"],
            "product" => [
                "id" => $row["product_id_value"],
                "name" => $row["name"],
                "slug" => $row["slug"],
                "price_cents" => (int) $row["price_cents"],
                "stock" => (int) $row["stock"],
                "description" => $row["description"],
                "img_url" => $row["img_url"],
                "model_url" => $row["model_url"],
                "created_at" => $row["product_created_at"],
                "category_id" => $row["category_id"]
            ]
        ];
    }

    echo json_encode([
        "success" => true,
        "items" => $items,
        "count" => count($items)
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    error_log(
        "Arduino Store wishlist list error: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to load wishlist."
    ]);
}