<?php

date_default_timezone_set("Asia/Manila");

ini_set("display_errors", "0");
ini_set("log_errors", "1");
error_reporting(E_ALL);

header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json; charset=utf-8");

set_error_handler(function ($severity, $message, $file, $line) {
    if (!(error_reporting() & $severity)) {
        return false;
    }

    throw new ErrorException($message, 0, $severity, $file, $line);
});

register_shutdown_function(function () {
    $error = error_get_last();

    if (
        $error !== null &&
        in_array(
            $error["type"],
            [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR],
            true
        )
    ) {
        if (!headers_sent()) {
            http_response_code(500);
            header("Content-Type: application/json; charset=utf-8");
        }

        echo json_encode([
            "success" => false,
            "message" => $error["message"]
        ]);
    }
});

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
    "samesite" => "Lax",
    "secure" => false,
    "httponly" => true
]);

session_start();

require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../config/auth.php";

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
        "message" => "Invalid request."
    ]);
    exit;
}

$shippingAddress = $input["shipping_address"] ?? null;
$shippingMethod = trim((string) ($input["shipping_method"] ?? "standard"));
$paymentMethod = trim((string) ($input["payment_method"] ?? "cod"));
$notes = trim((string) ($input["notes"] ?? ""));
$promoCode = strtoupper(
    trim((string) ($input["promo_code"] ?? ""))
);

if (!is_array($shippingAddress)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Shipping address is required."
    ]);
    exit;
}

if ($shippingMethod === "") {
    $shippingMethod = "standard";
}

if ($paymentMethod === "") {
    $paymentMethod = "cod";
}

$userId = $_SESSION["user_id"];

$orderId = newUuid();

try {
    $pdo->beginTransaction();

    $cartQuery = $pdo->prepare("
        SELECT
            ci.id,
            ci.product_id,
            ci.variant_id,
            ci.qty,
            p.name,
            p.price_cents,
            COALESCE(v.stock, p.stock) AS stock,
            p.stock AS product_stock,
            v.price_adjustment,
            p.img_url,
            p.sku
        FROM cart_items ci
        INNER JOIN products p ON p.id = ci.product_id
        LEFT JOIN variants v ON v.id = ci.variant_id AND v.product_id = p.id
        WHERE ci.user_id = :user_id
        FOR UPDATE
    ");

    $cartQuery->execute([
        "user_id" => $userId
    ]);

    $cartItems = $cartQuery->fetchAll(PDO::FETCH_ASSOC);

    if (!$cartItems) {
        throw new Exception("Your cart is empty.");
    }

    $subtotalCents = 0;

    foreach ($cartItems as $item) {
        $quantity = (int) $item["qty"];
        $stock = (int) $item["stock"];
        $price = (int) $item["price_cents"] + (int) ($item["price_adjustment"] ?? 0);
        $item["price_cents"] = $price;

        if ($quantity < 1) {
            throw new Exception(
                "Invalid quantity for " . $item["name"] . "."
            );
        }

        if ($stock < $quantity) {
            throw new Exception(
                "Only " .
                $stock .
                " item(s) of " .
                $item["name"] .
                " are available."
            );
        }

        $subtotalCents += $price * $quantity;
    }

    $discountCents = 0;
    $promoIsFreeShipping = false;
    $appliedPromoCode = null;

    if ($promoCode !== "") {
        $promoQuery = $pdo->prepare("
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
            FOR UPDATE
        ");

        $promoQuery->execute([
            "code" => $promoCode
        ]);

        $promo = $promoQuery->fetch(PDO::FETCH_ASSOC);

        if (!$promo) {
            throw new Exception("Promo code not found.");
        }

        $timezone = new DateTimeZone("Asia/Manila");
        $now = new DateTimeImmutable("now", $timezone);

        if (!empty($promo["valid_from"])) {
            $validFrom = new DateTimeImmutable(
                (string) $promo["valid_from"],
                $timezone
            );

            if ($now < $validFrom) {
                throw new Exception(
                    "This promo code is not active yet."
                );
            }
        }

        if (!empty($promo["valid_until"])) {
            $validUntil = new DateTimeImmutable(
                (string) $promo["valid_until"],
                $timezone
            );

            if ($now > $validUntil) {
                throw new Exception(
                    "This promo code has expired."
                );
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
            throw new Exception(
                "This promo code has reached its usage limit."
            );
        }

        $minOrderCents = (int) (
            $promo["min_order_cents"] ?? 0
        );

        if ($subtotalCents < $minOrderCents) {
            throw new Exception(
                "Your order does not meet the minimum amount for this promo."
            );
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
            $subtotalCents *
            ($discountPercent / 100)
        );

        if ($discountCents > $subtotalCents) {
            $discountCents = $subtotalCents;
        }

        $promoIsFreeShipping =
            (int) ($promo["is_free_shipping"] ?? 0) === 1;

        $appliedPromoCode = $promo["code"];
    }

    $shippingCents =
        $subtotalCents >= 150000
            ? 0
            : 9900;

    if ($promoIsFreeShipping) {
        $shippingCents = 0;
    }

    $discountedSubtotalCents =
        max(0, $subtotalCents - $discountCents);

    $totalCents =
        $discountedSubtotalCents + $shippingCents;

    $orderQuery = $pdo->prepare("
        INSERT INTO orders (
            id,
            user_id,
            total_cents,
            promo_code,
            status,
            shipping_address,
            shipping_method,
            payment_method,
            payment_status,
            tracking_status,
            notes,
            email_confirmed
        )
        VALUES (
            :id,
            :user_id,
            :total_cents,
            :promo_code,
            'pending',
            :shipping_address,
            :shipping_method,
            :payment_method,
            'unpaid',
            'processing',
            :notes,
            0
        )
    ");

    $orderQuery->execute([
        "id" => $orderId,
        "user_id" => $userId,
        "total_cents" => $totalCents,
        "promo_code" => $appliedPromoCode,
        "shipping_address" => json_encode(
            $shippingAddress,
            JSON_UNESCAPED_UNICODE
        ),
        "shipping_method" => $shippingMethod,
        "payment_method" => $paymentMethod,
        "notes" => $notes !== "" ? $notes : null
    ]);

    $itemQuery = $pdo->prepare("
        INSERT INTO order_items (
            id,
            order_id,
            product_id,
            variant_id,
            qty,
            price_cents,
            product_name,
            product_img
        )
        VALUES (
            :id,
            :order_id,
            :product_id,
            :variant_id,
            :qty,
            :price_cents,
            :product_name,
            :product_img
        )
    ");

    $stockQuery = $pdo->prepare("
        UPDATE products
        SET stock = stock - :qty_decrement
        WHERE id = :product_id
        AND stock >= :qty_available
    ");
    $variantStockQuery = $pdo->prepare("UPDATE variants SET stock=stock-:qty WHERE id=:id AND stock>=:available");

    foreach ($cartItems as $item) {
        $itemId = newUuid();

        $quantity = (int) $item["qty"];

        $itemQuery->execute([
            "id" => $itemId,
            "order_id" => $orderId,
            "product_id" => $item["product_id"],
            "variant_id" => $item["variant_id"],
            "qty" => $quantity,
            "price_cents" => (int) $item["price_cents"],
            "product_name" => $item["name"],
            "product_img" => $item["img_url"]
        ]);

        if ($item["variant_id"] !== null) {
            $variantStockQuery->execute(["qty"=>$quantity,"id"=>$item["variant_id"],"available"=>$quantity]);
            $changed = $variantStockQuery->rowCount();
        } else {
            $stockQuery->execute(["qty_decrement"=>$quantity,"product_id"=>$item["product_id"],"qty_available"=>$quantity]);
            $changed = $stockQuery->rowCount();
        }

        if ($changed !== 1) {
            throw new Exception(
                "Unable to update stock for " .
                $item["name"] .
                "."
            );
        }
    }

    if ($appliedPromoCode !== null) {
        $promoUpdateQuery = $pdo->prepare("
            UPDATE promos
            SET used_count = used_count + 1
            WHERE UPPER(code) = :code
        ");

        $promoUpdateQuery->execute([
            "code" => $appliedPromoCode
        ]);

        if ($promoUpdateQuery->rowCount() !== 1) {
            throw new Exception(
                "Unable to update promo usage."
            );
        }
    }

    $clearCartQuery = $pdo->prepare("
        DELETE FROM cart_items
        WHERE user_id = :user_id
    ");

    $clearCartQuery->execute([
        "user_id" => $userId
    ]);

    $pdo->commit();

    try {
        $notification = $pdo->prepare("INSERT INTO notifications (user_id, order_id, type, title, message) VALUES (:user_id, :order_id, 'order_placed', :title, :message)");
        $notification->execute([
            'user_id' => $userId,
            'order_id' => $orderId,
            'title' => 'Order placed',
            'message' => 'Your order has been placed successfully.',
        ]);
    } catch (Throwable $notificationError) {
        error_log('Order placed notification failed: ' . $notificationError->getMessage());
    }

    echo json_encode([
        "success" => true,
        "message" => "Order created successfully.",
        "order" => [
            "id" => $orderId,
            "subtotal_cents" => $subtotalCents,
            "discount_cents" => $discountCents,
            "shipping_cents" => $shippingCents,
            "total_cents" => $totalCents,
            "promo_code" => $appliedPromoCode,
            "shipping_method" => $shippingMethod,
            "payment_method" => $paymentMethod
        ]
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
