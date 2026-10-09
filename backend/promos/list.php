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

try {
    $query = $pdo->query("
        SELECT
            id,
            code,
            discount_percent,
            valid_from,
            valid_until,
            max_uses,
            used_count,
            is_free_shipping,
            min_order_cents,
            description
        FROM promos
        WHERE valid_until >= NOW()
        ORDER BY valid_until ASC
    ");

    $promos = $query->fetchAll(PDO::FETCH_ASSOC);

    $formattedPromos = array_map(
        static function (array $promo): array {
            return [
                "id" => $promo["id"],
                "code" => $promo["code"],
                "discount_percent" => (int) ($promo["discount_percent"] ?? 0),
                "valid_from" => $promo["valid_from"],
                "valid_until" => $promo["valid_until"],
                "max_uses" => $promo["max_uses"] !== null
                    ? (int) $promo["max_uses"]
                    : null,
                "used_count" => (int) ($promo["used_count"] ?? 0),
                "is_free_shipping" => (int) ($promo["is_free_shipping"] ?? 0) === 1,
                "min_order_cents" => (int) ($promo["min_order_cents"] ?? 0),
                "description" => $promo["description"]
            ];
        },
        $promos
    );

    echo json_encode([
        "success" => true,
        "promos" => $formattedPromos
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    error_log(
        "Arduino Store promo list error: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to load promos."
    ]);
}