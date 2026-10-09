<?php

declare(strict_types=1);

session_start();
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

require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../config/auth.php";

$pdo = getDatabaseConnection();
requireAdmin($pdo);

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

$name = trim((string) ($input["name"] ?? ""));
$slug = trim((string) ($input["slug"] ?? ""));
$parentId = trim((string) ($input["parent_id"] ?? ""));
$icon = trim((string) ($input["icon"] ?? ""));

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
    $check = $pdo->prepare("
        SELECT id
        FROM categories
        WHERE slug = :slug
        LIMIT 1
    ");

    $check->execute([
        "slug" => $slug
    ]);

    if ($check->fetch()) {
        http_response_code(409);
        echo json_encode([
            "success" => false,
            "message" => "A category with this slug already exists."
        ]);
        exit;
    }

    $id = sprintf(
        "%s-%s-%s-%s-%s",
        bin2hex(random_bytes(4)),
        bin2hex(random_bytes(2)),
        bin2hex(random_bytes(2)),
        bin2hex(random_bytes(2)),
        bin2hex(random_bytes(6))
    );

    $query = $pdo->prepare("
        INSERT INTO categories (
            id,
            name,
            slug,
            parent_id,
            icon
        )
        VALUES (
            :id,
            :name,
            :slug,
            :parent_id,
            :icon
        )
    ");

    $query->execute([
        "id" => $id,
        "name" => $name,
        "slug" => $slug,
        "parent_id" => $parentId !== "" ? $parentId : null,
        "icon" => $icon !== "" ? $icon : null
    ]);

    echo json_encode([
        "success" => true,
        "message" => "Category created successfully.",
        "category" => [
            "id" => $id,
            "name" => $name,
            "slug" => $slug,
            "parent_id" => $parentId !== "" ? $parentId : null,
            "icon" => $icon !== "" ? $icon : null
        ]
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    error_log(
        "Arduino Store category create error: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to create category."
    ]);
}