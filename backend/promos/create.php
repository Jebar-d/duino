<?php

declare(strict_types=1);

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
    $validFrom = date("Y-m-d H:i:s");
}

$validFromTimestamp = strtotime($validFrom);
$validUntilTimestamp = strtotime($validUntil);

if ($validFromTimestamp === false) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Invalid start date."
    ]);
    exit;
}

if ($validUntilTimestamp === false) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Invalid expiry date."
    ]);
    exit;
}

if ($validUntilTimestamp <= $validFromTimestamp) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Expiry date must be after the start date."
    ]);
    exit;
}

try {
    $check = $pdo->prepare("
        SELECT id
        FROM promos
        WHERE UPPER(code) = :code
        LIMIT 1
    ");

    $check->execute([
        "code" => $code
    ]);

    if ($check->fetch()) {
        http_response_code(409);
        echo json_encode([
            "success" => false,
            "message" => "A promo code with this code already exists."
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
        INSERT INTO promos (
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
        )
        VALUES (
            :id,
            :code,
            :discount_percent,
            :valid_from,
            :valid_until,
            :max_uses,
            0,
            :is_free_shipping,
            :min_order_cents,
            :description
        )
    ");

    $query->execute([
        "id" => $id,
        "code" => $code,
        "discount_percent" => $discountPercent,
        "valid_from" => date(
            "Y-m-d H:i:s",
            $validFromTimestamp
        ),
        "valid_until" => date(
            "Y-m-d H:i:s",
            $validUntilTimestamp
        ),
        "max_uses" => $maxUses,
        "is_free_shipping" => $isFreeShipping ? 1 : 0,
        "min_order_cents" => $minOrderCents,
        "description" => $description !== ""
            ? $description
            : null
    ]);

    echo json_encode([
        "success" => true,
        "message" => "Promo created successfully.",
        "promo" => [
            "id" => $id,
            "code" => $code,
            "discount_percent" => $discountPercent,
            "valid_from" => date(
                "Y-m-d H:i:s",
                $validFromTimestamp
            ),
            "valid_until" => date(
                "Y-m-d H:i:s",
                $validUntilTimestamp
            ),
            "max_uses" => $maxUses,
            "used_count" => 0,
            "is_free_shipping" => $isFreeShipping,
            "min_order_cents" => $minOrderCents,
            "description" => $description !== ""
                ? $description
                : null
        ]
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    error_log(
        "Arduino Store promo create error: " .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Unable to create promo."
    ]);
}