<?php

declare(strict_types=1);

date_default_timezone_set("Asia/Manila");

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
require_once __DIR__ . "/../config/promos.php";

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

$code = strtoupper(
    trim((string) ($input["code"] ?? ""))
);

$totalCents = (int) ($input["total_cents"] ?? 0);

if ($code === "") {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Promo code is required."
    ]);
    exit;
}

if ($totalCents < 0) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Invalid order total."
    ]);
    exit;
}

try {
    $query = $pdo->prepare("
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
        WHERE UPPER(code) = :code
        LIMIT 1
    ");

    $query->execute([
        "code" => $code
    ]);

    $promo = $query->fetch(PDO::FETCH_ASSOC);

    if (!$promo) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Promo code not found."
        ]);
        exit;
    }

    $timezone = new DateTimeZone("Asia/Manila");
    $now = new DateTimeImmutable("now", $timezone);

    if (promoExpirationStatus($promo, $now) === "expired") {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "This promo code has expired.",
            "error_code" => "PROMO_EXPIRED",
            "is_expired" => true
        ]);
        exit;
    }

    if (!empty($promo["valid_from"])) {
        $validFrom = new DateTimeImmutable(
            (string) $promo["valid_from"],
            $timezone
        );

        if ($now < $validFrom) {
            http_response_code(400);
            echo json_encode([
                "success" => false,
                "message" => "This promo code is not active yet."
            ]);
            exit;
        }
    }

    if (!empty($promo["valid_until"])) {
        $validUntil = new DateTimeImmutable(
            (string) $promo["valid_until"],
            $timezone
        );

        if ($now >= $validUntil) {
            http_response_code(400);
            echo json_encode([
                "success" => false,
                "message" => "This promo code has expired.",
                "error_code" => "PROMO_EXPIRED",
                "is_expired" => true
            ]);
            exit;
        }
    }

    $maxUses = $promo["max_uses"] !== null
        ? (int) $promo["max_uses"]
        : null;

    $usedCount = (int) ($promo["used_count"] ?? 0);

    if (
        $maxUses !== null &&
        $maxUses > 0 &&
        $usedCount >= $maxUses
    ) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "This promo code has reached its usage limit."
        ]);
        exit;
    }

    $minOrderCents = (int) (
        $promo["min_order_cents"] ?? 0
    );

    if ($totalCents < $minOrderCents) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "Your order does not meet the minimum amount for this promo.",
            "min_order_cents" => $minOrderCents
        ]);
        exit;
    }

    $discountPercent = (int) (
        $promo["discount_percent"] ?? 0
    );

    if ($discountPercent < 0) {
        $discountPercent = 0;
    }

    if ($discountPercent > 100) {
        $discountPercent = 100;
    }

    $discountCents = (int) round(
        $totalCents *
        ($discountPercent / 100)
    );

    if ($discountCents > $totalCents) {
        $discountCents = $totalCents;
    }

    $discountedTotalCents =
        $totalCents - $discountCents;

    $freeShipping =
        (int) ($promo["is_free_shipping"] ?? 0) === 1;

    echo json_encode([
        "success" => true,
        "message" => "Promo code applied successfully.",
        "promo" => [
            "id" => $promo["id"],
            "code" => $promo["code"],
            "discount_percent" => $discountPercent,
            "discount_cents" => $discountCents,
            "is_free_shipping" => $freeShipping,
            "min_order_cents" => $minOrderCents,
            "description" => $promo["description"],
            "valid_from" => $promo["valid_from"],
            "valid_until" => $promo["valid_until"],
            "expiration_at" => promoDateTimeForResponse($promo["valid_until"]),
            "status" => promoExpirationStatus($promo),
            "is_expired" => promoExpirationStatus($promo) === "expired"
        ],
        "original_total_cents" => $totalCents,
        "discount_cents" => $discountCents,
        "discounted_total_cents" => $discountedTotalCents,
        "is_free_shipping" => $freeShipping
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    error_log(
        "Arduino Store promo apply error: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to apply promo code."
    ]);
}