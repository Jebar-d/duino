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
require_once __DIR__ . '/../config/auth.php';

$input = json_decode(
    file_get_contents('php://input'),
    true
);

if (!is_array($input)) {
    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' => 'Invalid request data.'
    ]);

    exit;
}

$email = trim($input['email'] ?? '');
$password = (string) ($input['password'] ?? '');
$username = trim($input['username'] ?? '');
$firstName = trim($input['first_name'] ?? '');
$middleName = trim($input['middle_name'] ?? '');
$lastName = trim($input['last_name'] ?? '');
$suffix = trim($input['suffix'] ?? '');
$contactNumber = trim($input['contact_number'] ?? '');
$address = trim($input['address'] ?? '');
$structuredAddressFields = ['address_line', 'city', 'province', 'postal_code'];
$hasStructuredAddress = false;
$structuredAddress = [];
foreach ($structuredAddressFields as $field) {
    if (array_key_exists($field, $input)) {
        $hasStructuredAddress = true;
    }
    $value = $input[$field] ?? '';
    if (!is_string($value)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Address fields must be strings.']);
        exit;
    }
    $structuredAddress[$field] = trim(strip_tags($value));
}
$termsAccepted = !empty($input['terms_accepted']);
$rulesAccepted = !empty($input['rules_accepted']);

if (
    $email === '' ||
    $password === '' ||
    $username === '' ||
    $firstName === '' ||
    $lastName === ''
) {
    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' => 'Email, password, username, first name, and last name are required.'
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

if (strlen($password) < 8) {
    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' => 'Password must be at least 8 characters.'
    ]);

    exit;
}

if (strlen($username) < 3 || strlen($username) > 100) {
    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' => 'Username must be between 3 and 100 characters.'
    ]);

    exit;
}

if (!$termsAccepted || !$rulesAccepted) {
    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' => 'You must accept the terms and rules.'
    ]);

    exit;
}

$extraAddresses = [];
if ($hasStructuredAddress) {
    if ($structuredAddress['address_line'] === '' || !preg_match('/^\d{4}$/', $structuredAddress['postal_code'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'address_line is required and postal_code must contain 4 digits.']);
        exit;
    }
    if (!preg_match('/^\d{11,13}$/', $contactNumber)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'contact_number must contain 11 to 13 digits when saving an address.']);
        exit;
    }
    $addressEntry = [
        'first_name' => trim(strip_tags($firstName)),
        'middle_name' => trim(strip_tags($middleName)),
        'last_name' => trim(strip_tags($lastName)),
        'suffix' => trim(strip_tags($suffix)),
        'address_line' => $structuredAddress['address_line'],
        'city' => $structuredAddress['city'],
        'province' => $structuredAddress['province'],
        'postal_code' => $structuredAddress['postal_code'],
        'contact_number' => $contactNumber,
    ];
    if (!in_array($addressEntry, $extraAddresses, true)) {
        array_unshift($extraAddresses, $addressEntry);
    }
    $address = implode(', ', array_values(array_filter([
        $structuredAddress['address_line'],
        $structuredAddress['city'],
        $structuredAddress['province'],
        $structuredAddress['postal_code'],
    ], static fn(string $part): bool => $part !== '')));
}

try {
    $db = getDatabaseConnection();

    $emailCheck = $db->prepare(
        'SELECT id FROM users WHERE LOWER(email) = LOWER(:email) LIMIT 1'
    );

    $emailCheck->execute([
        ':email' => $email
    ]);

    if ($emailCheck->fetch()) {
        http_response_code(409);

        echo json_encode([
            'success' => false,
            'message' => 'An account with this email already exists.'
        ]);

        exit;
    }

    $usernameCheck = $db->prepare(
        'SELECT id FROM profiles WHERE username = :username LIMIT 1'
    );

    $usernameCheck->execute([
        ':username' => $username
    ]);

    if ($usernameCheck->fetch()) {
        http_response_code(409);

        echo json_encode([
            'success' => false,
            'message' => 'This username is already taken.'
        ]);

        exit;
    }

    $id = newUuid();

    $passwordHash = password_hash(
        $password,
        PASSWORD_DEFAULT
    );

    $db->beginTransaction();

    $userStatement = $db->prepare(
        'INSERT INTO users (
            id,
            email,
            password_hash
        ) VALUES (
            :id,
            :email,
            :password_hash
        )'
    );

    $userStatement->execute([
        ':id' => $id,
        ':email' => $email,
        ':password_hash' => $passwordHash
    ]);

    $profileStatement = $db->prepare(
        'INSERT INTO profiles (
            id,
            email,
            password_hash,
            username,
            first_name,
            middle_name,
            last_name,
            suffix,
            contact_number,
            address,
            extra_addresses,
            terms_accepted,
            rules_accepted
        ) VALUES (
            :id,
            :email,
            :password_hash,
            :username,
            :first_name,
            :middle_name,
            :last_name,
            :suffix,
            :contact_number,
            :address,
            :extra_addresses,
            :terms_accepted,
            :rules_accepted
        )'
    );

    $profileStatement->execute([
        ':id' => $id,
        ':email' => $email,
        ':password_hash' => $passwordHash,
        ':username' => $username,
        ':first_name' => $firstName,
        ':middle_name' => $middleName !== '' ? $middleName : null,
        ':last_name' => $lastName,
        ':suffix' => $suffix !== '' ? $suffix : null,
        ':contact_number' => $contactNumber !== '' ? $contactNumber : null,
        ':address' => $address !== '' ? $address : null,
        ':extra_addresses' => json_encode($extraAddresses, JSON_UNESCAPED_UNICODE),
        ':terms_accepted' => $termsAccepted ? 1 : 0,
        ':rules_accepted' => $rulesAccepted ? 1 : 0
    ]);

    $verificationToken = bin2hex(random_bytes(32));
    $tokenInsert = $db->prepare('INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at) VALUES (:id, :user_id, :token_hash, DATE_ADD(NOW(), INTERVAL 24 HOUR))');
    $tokenInsert->execute([
        'id' => newUuid(),
        'user_id' => $id,
        'token_hash' => hash('sha256', $verificationToken),
    ]);

    $db->commit();

    $verificationLink = 'http://localhost:3000/verify-email?token=' . rawurlencode($verificationToken);
    $mailSent = @mail($email, 'Verify your Arduino Store email', "Verify your email address using this link:\n\n" . $verificationLink);
    if (!$mailSent) {
        $logDirectory = __DIR__ . '/../logs';
        if (!is_dir($logDirectory)) {
            mkdir($logDirectory, 0755, true);
        }
        file_put_contents($logDirectory . '/mail.log', date('c') . ' ' . $email . ' ' . $verificationLink . PHP_EOL, FILE_APPEND | LOCK_EX);
    }

    echo json_encode([
        'success' => true,
        'message' => 'Account created successfully.',
        'user' => [
            'id' => $id,
            'email' => $email,
            'username' => $username,
            'first_name' => $firstName,
            'middle_name' => $middleName !== '' ? $middleName : null,
            'last_name' => $lastName,
            'suffix' => $suffix !== '' ? $suffix : null,
            'contact_number' => $contactNumber !== '' ? $contactNumber : null,
            'address' => $address !== '' ? $address : null
        ]
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }

    error_log(
        'Arduino Store registration error: ' .
        $e->getMessage()
    );

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
