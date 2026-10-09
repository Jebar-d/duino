<?php

declare(strict_types=1);

session_start();
date_default_timezone_set('Asia/Manila');
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
require_once __DIR__ . "/../config/auth.php";
require_once __DIR__ . "/../config/promos.php";

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

$id = trim((string) ($input["id"] ?? ""));
$code = strtoupper(
    trim((string) ($input["code"] ?? ""))
);

$discountPercent = (int) (
    $input["discount_percent"] ?? 0
);

$minOrderCents = (int) (
    $input["min_order_cents"] ?? 0
);

$maxUses = $input["max_uses"] ?? null;

$validFrom = trim(
    (string) ($input["valid_from"] ?? "")
);

$validUntil = trim(
    (string) ($input["valid_until"] ?? "")
);

$description = trim(
    (string) ($input["description"] ?? "")
);

$isFreeShipping = !empty(
    $input["is_free_shipping"]
);

if ($id === "") {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Promo ID is required."
    ]);
    exit;
}

if ($code === "") {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Promo code is required."
    ]);
    exit;
}

if (!preg_match("/^[A-Z0-9_-]+$/", $code)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Promo code contains invalid characters."
    ]);
    exit;
}

if ($discountPercent < 0 || $discountPercent > 100) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Discount must be between 0 and 100 percent."
    ]);
    exit;
}

if ($minOrderCents < 0) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Minimum order cannot be negative."
    ]);
    exit;
}

if ($maxUses !== null && $maxUses !== "") {
    $maxUses = (int) $maxUses;

    if ($maxUses < 1) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "Maximum uses must be at least 1."
        ]);
        exit;
    }
} else {
    $maxUses = null;
}

if ($validUntil === "") {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Promo expiry is required."
    ]);
    exit;
}

if ($validFrom === "") {
    $validFrom = (new DateTimeImmutable("now", new DateTimeZone("Asia/Manila")))->format("Y-m-d H:i:s");
}

try {
    $validFromDate = parsePromoDateTime($validFrom);
    $validUntilDate = parsePromoDateTime($validUntil);
} catch (InvalidArgumentException $e) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => $e->getMessage()
    ]);
    exit;
}

if ($validUntilDate <= $validFromDate) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Expiry date must be after the start date."
    ]);
    exit;
}

try {
    $existing = $pdo->prepare("
        SELECT id, used_count
        FROM promos
        WHERE id = :id
        LIMIT 1
    ");

    $existing->execute([
        "id" => $id
    ]);

    $promo = $existing->fetch(PDO::FETCH_ASSOC);

    if (!$promo) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Promo not found."
        ]);
        exit;
    }

    $check = $pdo->prepare("
        SELECT id
        FROM promos
        WHERE UPPER(code) = :code
        AND id <> :id
        LIMIT 1
    ");

    $check->execute([
        "code" => $code,
        "id" => $id
    ]);

    if ($check->fetch()) {
        http_response_code(409);
        echo json_encode([
            "success" => false,
            "message" => "A promo with this code already exists."
        ]);
        exit;
    }

    $query = $pdo->prepare("
        UPDATE promos
        SET
            code = :code,
            discount_percent = :discount_percent,
            valid_from = :valid_from,
            valid_until = :valid_until,
            max_uses = :max_uses,
            is_free_shipping = :is_free_shipping,
            min_order_cents = :min_order_cents,
            description = :description
        WHERE id = :id
    ");

    $query->execute([
        "code" => $code,
        "discount_percent" => $discountPercent,
        "valid_from" => promoDateTimeForDatabase($validFromDate),
        "valid_until" => promoDateTimeForDatabase($validUntilDate),
        "max_uses" => $maxUses,
        "is_free_shipping" => $isFreeShipping ? 1 : 0,
        "min_order_cents" => $minOrderCents,
        "description" => $description !== ""
            ? $description
            : null,
        "id" => $id
    ]);

    $status = promoExpirationStatus([
        "valid_from" => promoDateTimeForDatabase($validFromDate),
        "valid_until" => promoDateTimeForDatabase($validUntilDate),
        "max_uses" => $maxUses,
        "used_count" => (int) $promo["used_count"],
    ]);
    echo json_encode([
        "success" => true,
        "message" => "Promo updated successfully.",
        "promo" => [
            "id" => $id,
            "code" => $code,
            "valid_from" => $validFromDate->format(DateTimeInterface::ATOM),
            "valid_until" => $validUntilDate->format(DateTimeInterface::ATOM),
            "expiration_at" => $validUntilDate->format(DateTimeInterface::ATOM),
            "status" => $status,
            "is_expired" => $status === "expired",
        ],
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    error_log(
        "Arduino Store promo update error: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to update promo."
    ]);
}