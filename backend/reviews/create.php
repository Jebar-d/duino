<?php

declare(strict_types=1);

header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
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
        "message" => "You must be logged in to submit a review."
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
$rating = (int) ($input["rating"] ?? 0);
$comment = trim((string) ($input["comment"] ?? ""));

if ($productId === "") {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Product ID is required."
    ]);
    exit;
}

if ($rating < 1 || $rating > 5) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Rating must be between 1 and 5."
    ]);
    exit;
}

if ($comment === "") {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Review comment is required."
    ]);
    exit;
}

try {
    $productQuery = $pdo->prepare("
        SELECT id
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
        FROM reviews
        WHERE product_id = :product_id
        AND user_id = :user_id
        LIMIT 1
    ");

    $existingQuery->execute([
        "product_id" => $productId,
        "user_id" => $_SESSION["user_id"]
    ]);

    $existingReview = $existingQuery->fetch(PDO::FETCH_ASSOC);

    if ($existingReview) {
        http_response_code(409);
        echo json_encode([
            "success" => false,
            "message" => "You have already reviewed this product."
        ]);
        exit;
    }

    $reviewId = sprintf(
        "%04x%04x-%04x-%04x-%04x-%04x%04x%04x",
        random_int(0, 0xffff),
        random_int(0, 0xffff),
        random_int(0, 0xffff),
        random_int(0, 0x0fff) | 0x4000,
        random_int(0, 0x3fff) | 0x8000,
        random_int(0, 0xffff),
        random_int(0, 0xffff),
        random_int(0, 0xffff)
    );

    $insert = $pdo->prepare("
        INSERT INTO reviews (
            id,
            product_id,
            user_id,
            rating,
            comment,
            created_at
        )
        VALUES (
            :id,
            :product_id,
            :user_id,
            :rating,
            :comment,
            NOW()
        )
    ");

    $insert->execute([
        "id" => $reviewId,
        "product_id" => $productId,
        "user_id" => $_SESSION["user_id"],
        "rating" => $rating,
        "comment" => $comment
    ]);

    $reviewQuery = $pdo->prepare("
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
        WHERE r.id = :review_id
        LIMIT 1
    ");

    $reviewQuery->execute([
        "review_id" => $reviewId
    ]);

    $review = $reviewQuery->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
        "success" => true,
        "message" => "Review submitted successfully.",
        "review" => $review
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    error_log(
        "Arduino Store review create error: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to submit review."
    ]);
}