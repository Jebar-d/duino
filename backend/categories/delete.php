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

$input = json_decode(file_get_contents("php://input"), true);

if (!is_array($input)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Invalid request data."
    ]);
    exit;
}

$id = trim((string) ($input["id"] ?? ""));

if ($id === "") {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Category ID is required."
    ]);
    exit;
}

try {
    $pdo = getDatabaseConnection();
    requireAdmin($pdo);
    $query = $pdo->prepare("DELETE FROM categories WHERE id = :id");
    $query->execute(["id" => $id]);

    if ($query->rowCount() === 0) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Category not found."
        ]);
        exit;
    }

    echo json_encode([
        "success" => true,
        "message" => "Category deleted successfully."
    ]);
} catch (Throwable $e) {
    error_log("Arduino Store category delete error: " . $e->getMessage());

    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Unable to delete category."
    ]);
}
