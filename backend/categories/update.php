<?php

declare(strict_types=1);

header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: PUT, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=utf-8");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

if (
    $_SERVER["REQUEST_METHOD"] !== "PUT" &&
    $_SERVER["REQUEST_METHOD"] !== "POST"
) {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Method not allowed."
    ]);
    exit;
}

require_once __DIR__ . "/../config/database.php";

$pdo = getDatabaseConnection();

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

$id = trim((string) ($input["id"] ?? ""));
$name = trim((string) ($input["name"] ?? ""));
$slug = trim((string) ($input["slug"] ?? ""));
$parentId = trim((string) ($input["parent_id"] ?? ""));
$icon = trim((string) ($input["icon"] ?? ""));

if ($id === "") {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Category ID is required."
    ]);
    exit;
}

if ($name === "") {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Category name is required."
    ]);
    exit;
}

if ($slug === "") {
    $slug = strtolower($name);
    $slug = preg_replace("/[^a-z0-9]+/i", "-", $slug);
    $slug = trim($slug, "-");
}

try {
    $exists = $pdo->prepare("
        SELECT id
        FROM categories
        WHERE id = :id
        LIMIT 1
    ");

    $exists->execute([
        "id" => $id
    ]);

    if (!$exists->fetch()) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Category not found."
        ]);
        exit;
    }

    $slugCheck = $pdo->prepare("
        SELECT id
        FROM categories
        WHERE slug = :slug
        AND id <> :id
        LIMIT 1
    ");

    $slugCheck->execute([
        "slug" => $slug,
        "id" => $id
    ]);

    if ($slugCheck->fetch()) {
        http_response_code(409);
        echo json_encode([
            "success" => false,
            "message" => "A category with this slug already exists."
        ]);
        exit;
    }

    $query = $pdo->prepare("
        UPDATE categories
        SET
            name = :name,
            slug = :slug,
            parent_id = :parent_id,
            icon = :icon
        WHERE id = :id
    ");

    $query->execute([
        "name" => $name,
        "slug" => $slug,
        "parent_id" => $parentId !== "" ? $parentId : null,
        "icon" => $icon !== "" ? $icon : null,
        "id" => $id
    ]);

    echo json_encode([
        "success" => true,
        "message" => "Category updated successfully."
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    error_log(
        "Arduino Store category update error: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to update category."
    ]);
}