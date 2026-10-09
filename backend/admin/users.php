<?php

declare(strict_types=1);

session_start();

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: http://localhost:3000');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed.'
    ]);
    exit;
}

if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'Authentication required.'
    ]);
    exit;
}

require_once __DIR__ . '/../config/database.php';

try {
    $pdo = getDatabaseConnection();
    $adminQuery = $pdo->prepare(
        'SELECT role FROM users WHERE id = :id LIMIT 1'
    );
    $adminQuery->execute(['id' => $_SESSION['user_id']]);
    $admin = $adminQuery->fetch();

    if (!$admin || $admin['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'Administrator access required.'
        ]);
        exit;
    }

    $query = $pdo->query(
        'SELECT id, email, role, email_verified, created_at
         FROM users
         ORDER BY created_at DESC'
    );

    echo json_encode([
        'success' => true,
        'users' => $query->fetchAll(PDO::FETCH_ASSOC)
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    error_log('Arduino Store admin users error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Unable to load users.'
    ]);
}
