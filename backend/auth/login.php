<?php

declare(strict_types=1);

header('Access-Control-Allow-Origin: http://localhost:3000');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);

    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed.'
    ]);

    exit;
}

require_once __DIR__ . '/../config/database.php';

session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => false,
    'httponly' => true,
    'samesite' => 'Lax'
]);

session_start();

$input = json_decode(
    file_get_contents('php://input'),
    true
);

$email = trim($input['email'] ?? '');
$password = (string) ($input['password'] ?? '');

if ($email === '' || $password === '') {
    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' => 'Email and password are required.'
    ]);

    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' => 'Please enter a valid email address.'
    ]);

    exit;
}

try {
    $db = getDatabaseConnection();

    $statement = $db->prepare(
        'SELECT id, email, password_hash, username, first_name, middle_name, last_name, suffix, contact_number, address, terms_accepted, rules_accepted, created_at
         FROM profiles
         WHERE LOWER(email) = LOWER(:email)
         LIMIT 1'
    );

    $statement->execute([
        ':email' => $email
    ]);

    $user = $statement->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        http_response_code(401);

        echo json_encode([
            'success' => false,
            'message' => 'Invalid email or password.'
        ]);

        exit;
    }

    session_regenerate_id(true);

    $_SESSION['user_id'] = $user['id'];
    $_SESSION['user_email'] = $user['email'];

    $roleStatement = $db->prepare('SELECT role, is_disabled FROM users WHERE id = :id LIMIT 1');
    $roleStatement->execute([':id' => $user['id']]);
    $account = $roleStatement->fetch(PDO::FETCH_ASSOC);
    if (!$account) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid email or password.'
        ]);
        exit;
    }
    if ((bool) $account['is_disabled']) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'This account is disabled.'
        ]);
        exit;
    }
    $user['role'] = (string) $account['role'];

    unset($user['password_hash']);

    echo json_encode([
        'success' => true,
        'message' => 'Login successful.',
        'user' => $user
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    error_log(
        'Arduino Store login error: ' .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to process login.'
    ]);
}