<?php

declare(strict_types=1);

header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
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

require_once __DIR__ . "/../config/database.php";

$pdo = getDatabaseConnection();

$productId = trim($_GET["product_id"] ?? "");

if ($productId === "") {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Product ID is required."
    ]);
    exit;
}

try {
    $query = $pdo->prepare("
        SELECT
            r.id,
            r.product_id,
            r.user_id,
            r.rating,
            r.comment,
            r.created_at,
            p.username,
            p.first_name,
            p.last_name
        FROM reviews r
        LEFT JOIN profiles p ON p.id = r.user_id
        WHERE r.product_id = :product_id
        ORDER BY r.created_at DESC
    ");

    $query->execute([
        "product_id" => $productId
    ]);

    $reviews = $query->fetchAll(PDO::FETCH_ASSOC);

    $averageQuery = $pdo->prepare("
        SELECT
            COUNT(*) AS review_count,
            COALESCE(AVG(rating), 0) AS average_rating
        FROM reviews
        WHERE product_id = :product_id
    ");

    $averageQuery->execute([
        "product_id" => $productId
    ]);

    $summary = $averageQuery->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
        "success" => true,
        "reviews" => $reviews,
        "review_count" => (int) ($summary["review_count"] ?? 0),
        "average_rating" => round((float) ($summary["average_rating"] ?? 0), 1)
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    error_log(
        "Arduino Store review list error: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to load reviews."
    ]);
}