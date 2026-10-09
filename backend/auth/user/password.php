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

require_once __DIR__ . "/../../config/database.php";

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

$currentPassword = (string) ($input["current_password"] ?? "");
$newPassword = (string) ($input["new_password"] ?? "");
$confirmPassword = (string) ($input["confirm_password"] ?? "");

if ($currentPassword === "") {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Current password is required."
    ]);
    exit;
}

if ($newPassword === "") {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "New password is required."
    ]);
    exit;
}

if (strlen($newPassword) < 8) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "New password must be at least 8 characters."
    ]);
    exit;
}

if ($newPassword !== $confirmPassword) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "New passwords do not match."
    ]);
    exit;
}

try {
    $query = $pdo->prepare("
        SELECT password_hash
        FROM profiles
        WHERE id = :user_id
        LIMIT 1
    ");

    $query->execute([
        "user_id" => $_SESSION["user_id"]
    ]);

    $user = $query->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "User profile not found."
        ]);
        exit;
    }

    if (empty($user["password_hash"])) {
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "message" => "Password information is not available."
        ]);
        exit;
    }

    if (!password_verify($currentPassword, $user["password_hash"])) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "Current password is incorrect."
        ]);
        exit;
    }

    if (password_verify($newPassword, $user["password_hash"])) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "New password must be different from your current password."
        ]);
        exit;
    }

    $newPasswordHash = password_hash(
        $newPassword,
        PASSWORD_DEFAULT
    );

    $update = $pdo->prepare("
        UPDATE profiles
        SET password_hash = :password_hash
        WHERE id = :user_id
    ");

    $update->execute([
        "password_hash" => $newPasswordHash,
        "user_id" => $_SESSION["user_id"]
    ]);

    if ($update->rowCount() !== 1) {
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "message" => "Password could not be updated."
        ]);
        exit;
    }

    echo json_encode([
        "success" => true,
        "message" => "Password changed successfully."
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    error_log(
        "Arduino Store password change error: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to change password."
    ]);
}