<?php

ini_set("display_errors", "0");
ini_set("log_errors", "1");
error_reporting(E_ALL);

header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json; charset=utf-8");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
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
    "samesite" => "Lax",
    "secure" => false,
    "httponly" => true
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

$input = json_decode(file_get_contents("php://input"), true);

if (!is_array($input)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Invalid request data."
    ]);
    exit;
}

$userId = $_SESSION["user_id"];

$username = trim((string) ($input["username"] ?? ""));
$firstName = trim((string) ($input["first_name"] ?? ""));
$middleName = trim((string) ($input["middle_name"] ?? ""));
$lastName = trim((string) ($input["last_name"] ?? ""));
$suffix = trim((string) ($input["suffix"] ?? ""));
$contactNumber = trim((string) ($input["contact_number"] ?? ""));
$address = trim((string) ($input["address"] ?? ""));

if ($firstName === "") {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "First name is required."
    ]);
    exit;
}

if ($lastName === "") {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Last name is required."
    ]);
    exit;
}

try {
    $query = $pdo->prepare("
        UPDATE profiles
        SET
            username = :username,
            first_name = :first_name,
            middle_name = :middle_name,
            last_name = :last_name,
            suffix = :suffix,
            contact_number = :contact_number,
            address = :address
        WHERE id = :user_id
    ");

    $query->execute([
        "username" => $username !== "" ? $username : null,
        "first_name" => $firstName,
        "middle_name" => $middleName !== "" ? $middleName : null,
        "last_name" => $lastName,
        "suffix" => $suffix !== "" ? $suffix : null,
        "contact_number" => $contactNumber !== "" ? $contactNumber : null,
        "address" => $address !== "" ? $address : null,
        "user_id" => $userId
    ]);

    $userQuery = $pdo->prepare("
        SELECT
            id,
            email,
            username,
            first_name,
            middle_name,
            last_name,
            suffix,
            contact_number,
            address,
            terms_accepted,
            rules_accepted,
            created_at
        FROM profiles
        WHERE id = :user_id
        LIMIT 1
    ");

    $userQuery->execute([
        "user_id" => $userId
    ]);

    $user = $userQuery->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "User profile not found."
        ]);
        exit;
    }

    $user["terms_accepted"] = (bool) $user["terms_accepted"];
    $user["rules_accepted"] = (bool) $user["rules_accepted"];

    echo json_encode([
        "success" => true,
        "message" => "Profile updated successfully.",
        "user" => $user
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}