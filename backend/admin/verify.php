<?php

declare(strict_types=1);

session_start();

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: http://localhost:3000');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config.php';

function respond(bool $success, string $message = '', array $extra = []): never
{
    echo json_encode(
        array_merge(
            [
                'success' => $success,
                'message' => $message,
            ],
            $extra
        ),
        JSON_UNESCAPED_UNICODE
    );
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    respond(false, 'Method not allowed.');
}

$userId = $_SESSION['user_id'] ?? null;

if (!$userId) {
    http_response_code(401);
    respond(false, 'You must be logged in.');
}

$input = json_decode(file_get_contents('php://input'), true);

if (!is_array($input)) {
    http_response_code(400);
    respond(false, 'Invalid request.');
}

$code = trim((string) ($input['code'] ?? ''));

if ($code === '') {
    http_response_code(400);
    respond(false, 'Enter the admin code.');
}

$pdo = getDatabaseConnection();

$stmt = $pdo->prepare(
    'SELECT id, email, role
     FROM users
     WHERE id = :id
     LIMIT 1'
);

$stmt->execute([
    'id' => $userId,
]);

$user = $stmt->fetch();

if (!$user) {
    unset($_SESSION['user_id']);
    http_response_code(401);
    respond(false, 'User account not found.');
}

if (($user['role'] ?? '') !== 'admin') {
    http_response_code(403);
    respond(false, 'This account is not an administrator.');
}

if (!hash_equals(ARDUINO_ADMIN_CODE, $code)) {
    http_response_code(403);
    respond(false, 'Incorrect admin code.');
}

$_SESSION['admin_verified'] = true;
$_SESSION['admin_user_id'] = $user['id'];

respond(
    true,
    'Administrator access granted.',
    [
        'user' => [
            'id' => $user['id'],
            'email' => $user['email'],
            'role' => $user['role'],
            'is_admin' => true,
        ],
    ]
);
