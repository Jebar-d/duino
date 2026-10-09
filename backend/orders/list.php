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
    http_response_code(200);
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

$pdo = getDatabaseConnection();

if (empty($_SESSION["user_id"])) {
    http_response_code(401);
    echo json_encode([
        "success" => false,
        "message" => "You must be logged in."
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
            o.id,
            o.total_cents,
            o.promo_code,
            o.status,
            o.shipping_address,
            o.created_at,
            o.shipping_method,
            o.payment_method,
            o.tracking_status,
            o.expected_delivery,
            o.cancelled_at,
            o.cancel_reason,
            o.notes,
            o.email_confirmed,
            u.email AS customer_email
        FROM orders o
        LEFT JOIN users u ON u.id = o.user_id
    ";

    if (!$isAdmin) {
        $sql .= " WHERE o.user_id = :user_id";
    }

    $sql .= "
        ORDER BY o.created_at DESC
    ";

    $orderQuery = $pdo->prepare($sql);

    if ($isAdmin) {
        $orderQuery->execute();
    } else {
        $orderQuery->execute([
            "user_id" => $userId
        ]);
    }

    $orders = $orderQuery->fetchAll(PDO::FETCH_ASSOC);

    foreach ($orders as &$order) {
        $order["items"] = [];
        $order["item_count"] = 0;

        $itemQuery = $pdo->prepare("
            SELECT
                oi.id,
                oi.product_id,
                oi.variant_id,
                oi.qty,
                oi.price_cents,
                oi.product_name,
                oi.product_img
            FROM order_items oi
            WHERE oi.order_id = :order_id
            ORDER BY oi.id ASC
        ");

        $itemQuery->execute([
            "order_id" => $order["id"]
        ]);

        $items = $itemQuery->fetchAll(PDO::FETCH_ASSOC);

        foreach ($items as &$item) {
            $item["qty"] = (int) $item["qty"];
            $item["price_cents"] = (int) $item["price_cents"];
            $item["subtotal_cents"] = $item["qty"] * $item["price_cents"];
        }

        unset($item);

        $order["items"] = $items;
        $order["item_count"] = array_sum(
            array_column($items, "qty")
        );
        $order["total_cents"] = (int) $order["total_cents"];
    }

    unset($order);

    echo json_encode([
        "success" => true,
        "orders" => $orders
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
