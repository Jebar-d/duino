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

    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed.'
    ]);

    exit;
}

require_once __DIR__ . '/../../config/database.php';

session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => false,
    'httponly' => true,
    'samesite' => 'Lax'
]);

session_start();

if (empty($_SESSION['user_id'])) {
    http_response_code(401);

    echo json_encode([
        'success' => false,
        'message' => 'Not authenticated.',
        'user' => null
    ]);

    exit;
}

try {
    $db = getDatabaseConnection();

    $statement = $db->prepare(
        'SELECT
            id,
            email,
            username,
            first_name,
            middle_name,
            last_name,
            suffix,
            contact_number,
            address,
            terms_accepted,
            rules_accepted,
            extra_addresses,
            created_at
         FROM profiles
         WHERE id = :id
         LIMIT 1'
    );

    $statement->execute([
        ':id' => $_SESSION['user_id']
    ]);

    $user = $statement->fetch();

    if (!$user) {
        session_unset();
        session_destroy();

        http_response_code(401);

        echo json_encode([
            'success' => false,
            'message' => 'User account no longer exists.',
            'user' => null
        ]);

        exit;
    }

    $verification = $db->prepare('SELECT email_verified, role, is_disabled FROM users WHERE id = :id LIMIT 1');
    $verification->execute(['id' => $_SESSION['user_id']]);
    $accountRow = $verification->fetch(PDO::FETCH_ASSOC) ?: [];
    if ((bool) ($accountRow['is_disabled'] ?? false)) {
        session_unset();
        session_destroy();
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'This account is disabled.',
            'user' => null
        ]);
        exit;
    }
    $user['email_verified'] = (bool) ($accountRow['email_verified'] ?? false);
    $user['role'] = (string) ($accountRow['role'] ?? 'user');
    $decodedAddresses = $user['extra_addresses'] !== null
        ? json_decode((string) $user['extra_addresses'], true)
        : [];
    $user['extra_addresses'] = is_array($decodedAddresses) ? $decodedAddresses : [];

    echo json_encode([
        'success' => true,
        'authenticated' => true,
        'user' => $user
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {

    error_log(
        'Arduino Store user/me error: ' .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to retrieve user information.'
    ]);
}
