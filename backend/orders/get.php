<?php

ini_set("display_errors", "0");
ini_set("log_errors", "1");
error_reporting(E_ALL);

header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type");
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
    "samesite" => "Lax",
    "secure" => false,
    "httponly" => true
]);

session_start();

require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../config/order-response.php";

$pdo = getDatabaseConnection();

if (empty($_SESSION["user_id"])) {
    http_response_code(401);
    echo json_encode([
        "success" => false,
        "message" => "You must be logged in."
    ]);
    exit;
}

$orderId = trim($_GET["id"] ?? "");

if ($orderId === "") {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Order ID is required."
    ]);
    exit;
}

$userId = $_SESSION["user_id"];

try {
    $roleQuery = $pdo->prepare("
        SELECT role
        FROM users
        WHERE id = :id
        LIMIT 1
    ");

    $roleQuery->execute([
        "id" => $userId
    ]);

    $user = $roleQuery->fetch(PDO::FETCH_ASSOC);
    $isAdmin = $user && $user["role"] === "admin";

    $sql = "
        SELECT
            id,
            user_id,
            total_cents,
            promo_code,
            status,
            shipping_address,
            created_at,
            shipping_method,
            payment_method,
            payment_status,
            tracking_status,
            expected_delivery,
            cancelled_at,
            cancel_reason,
            notes,
            email_confirmed
        FROM orders
        WHERE id = :order_id
    ";

    if (!$isAdmin) {
        $sql .= " AND user_id = :user_id";
    }

    $sql .= " LIMIT 1";

    $orderQuery = $pdo->prepare($sql);

    $params = ["order_id" => $orderId];

    if (!$isAdmin) {
        $params["user_id"] = $userId;
    }

    $orderQuery->execute($params);

    $order = $orderQuery->fetch(PDO::FETCH_ASSOC);

    if (!$order) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Order not found."
        ]);
        exit;
    }

    $order = buildOrderResponse($pdo, $order);
    $order = addOrderRefundAndActions($pdo, $order);

    echo json_encode([
        "success" => true,
        "order" => $order
    ], JSON_UNESCAPED_UNICODE);

} catch (PDOException $e) {
    error_log("Order lookup database error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Unable to retrieve order."
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
