<?php

declare(strict_types=1);

header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: DELETE, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=utf-8");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

if (
    $_SERVER["REQUEST_METHOD"] !== "DELETE" &&
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
    $input = $_GET;
}

$id = trim((string) ($input["id"] ?? ""));

if ($id === "") {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Promo ID is required."
    ]);
    exit;
}

try {
    $query = $pdo->prepare("
        DELETE FROM promos
        WHERE id = :id
    ");

    $query->execute([
        "id" => $id
    ]);

    if ($query->rowCount() !== 1) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Promo not found."
        ]);
        exit;
    }

    echo json_encode([
        "success" => true,
        "message" => "Promo deleted successfully."
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    error_log(
        "Arduino Store promo delete error: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to delete promo."
    ]);
}