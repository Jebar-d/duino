<?php

declare(strict_types=1);

session_start();

header('Access-Control-Allow-Origin: http://localhost:3000');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';

try {
    $pdo = getDatabaseConnection();
    requireAdmin($pdo);

    $summary = $pdo->query("SELECT
        COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','refunded') THEN total_cents ELSE 0 END), 0) AS total_revenue_cents,
        COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','refunded') AND created_at >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01') THEN total_cents ELSE 0 END), 0) AS month_revenue_cents,
        COUNT(*) AS total_orders,
        SUM(status IN ('paid','processing','shipped','delivered','completed')) AS paid_orders,
        SUM(status = 'pending') AS pending_orders,
        SUM(status = 'cancelled') AS cancelled_orders
        FROM orders")->fetch(PDO::FETCH_ASSOC);

    $monthly = $pdo->query("SELECT DATE_FORMAT(created_at, '%Y-%m') AS month,
        SUM(total_cents) AS revenue_cents,
        COUNT(*) AS order_count
        FROM orders
        WHERE status NOT IN ('cancelled','refunded')
          AND created_at >= DATE_FORMAT(CURRENT_DATE - INTERVAL 5 MONTH, '%Y-%m-01')
        GROUP BY DATE_FORMAT(created_at, '%Y-%m')
        ORDER BY month")->fetchAll(PDO::FETCH_ASSOC);

    $monthlyByMonth = [];
    foreach ($monthly as $row) {
        $monthlyByMonth[$row['month']] = [
            'revenue_cents' => (int) $row['revenue_cents'],
            'order_count' => (int) $row['order_count'],
        ];
    }
    $monthly = [];
    for ($offset = 5; $offset >= 0; $offset--) {
        $month = date('Y-m', strtotime(date('Y-m-01') . ' -' . $offset . ' months'));
        $monthly[] = [
            'month' => $month,
            'label' => date('M Y', strtotime($month . '-01')),
            'revenue_cents' => $monthlyByMonth[$month]['revenue_cents'] ?? 0,
            'order_count' => $monthlyByMonth[$month]['order_count'] ?? 0,
        ];
    }

    $payments = $pdo->query('SELECT payment_method AS method, COUNT(*) AS count FROM orders GROUP BY payment_method ORDER BY payment_method')->fetchAll(PDO::FETCH_ASSOC);
    $statuses = $pdo->query('SELECT status, COUNT(*) AS count FROM orders GROUP BY status ORDER BY status')->fetchAll(PDO::FETCH_ASSOC);
    $topProducts = $pdo->query("SELECT oi.product_name,
        oi.product_name AS name,
        MAX(oi.product_img) AS img_url,
        SUM(oi.qty) AS qty,
        SUM(oi.qty) AS units_sold,
        SUM(oi.qty * oi.price_cents) AS revenue_cents
        FROM order_items oi
        INNER JOIN orders o ON o.id = oi.order_id
        WHERE o.status NOT IN ('cancelled','refunded')
        GROUP BY oi.product_name
        ORDER BY units_sold DESC
        LIMIT 5")->fetchAll(PDO::FETCH_ASSOC);
    $lowStock = $pdo->query('SELECT id, name, stock FROM products WHERE stock <= 10 ORDER BY stock ASC')->fetchAll(PDO::FETCH_ASSOC);

    foreach (['total_revenue_cents', 'month_revenue_cents', 'total_orders', 'paid_orders', 'pending_orders', 'cancelled_orders'] as $key) {
        $summary[$key] = (int) ($summary[$key] ?? 0);
    }
    foreach ($payments as &$row) {
        $row['count'] = (int) $row['count'];
    }
    unset($row);
    foreach ($statuses as &$row) {
        $row['count'] = (int) $row['count'];
    }
    unset($row);
    foreach ($topProducts as &$row) {
        $row['units_sold'] = (int) $row['units_sold'];
        $row['qty'] = (int) $row['qty'];
        $row['revenue_cents'] = (int) $row['revenue_cents'];
    }
    unset($row);
    foreach ($lowStock as &$row) {
        $row['stock'] = (int) $row['stock'];
    }
    unset($row);

    echo json_encode([
        'success' => true,
        'analytics' => $summary + [
            'monthly_revenue' => $monthly,
            'payment_methods' => $payments,
            'order_statuses' => $statuses,
            'top_products' => $topProducts,
            'low_stock_products' => $lowStock,
        ],
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    error_log('Analytics endpoint error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to load analytics.']);
}
