<?php

declare(strict_types=1);

header('Access-Control-Allow-Origin: http://localhost:3000');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);

    echo json_encode(
        [
            'success' => false,
            'message' => 'Method not allowed.',
        ],
        JSON_UNESCAPED_UNICODE
    );

    exit;
}

require_once __DIR__ . '/../config/database.php';


try {

    $db = getDatabaseConnection();


    $sql = "
        SELECT
            id,
            name,
            slug,
            parent_id,
            icon
        FROM categories
        ORDER BY name ASC
    ";

    $statement = $db->prepare($sql);

    $statement->execute();

    $categories = $statement->fetchAll();

    echo json_encode(
        [
            'success' => true,
            'categories' => $categories,
            'count' => count($categories),
        ],
        JSON_UNESCAPED_UNICODE |
        JSON_UNESCAPED_SLASHES
    );

} catch (Throwable $e) {

    error_log(
        'Arduino Store categories API error: ' .
        $e->getMessage()
    );
    
    http_response_code(500);

    echo json_encode(
        [
            'success' => false,
            'message' => 'Unable to load categories.',
        ],
        JSON_UNESCAPED_UNICODE
    );
}