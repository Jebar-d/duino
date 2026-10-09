<?php

declare(strict_types=1);

session_start();

header('Access-Control-Allow-Origin: http://localhost:3000');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'POST'], true)) {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

require_once __DIR__ . '/../../config/database.php';

if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Authentication required.']);
    exit;
}

try {
    $pdo = getDatabaseConnection();
    $query = $pdo->prepare('SELECT extra_addresses FROM profiles WHERE id = :id LIMIT 1');
    $query->execute(['id' => $_SESSION['user_id']]);
    $profile = $query->fetch(PDO::FETCH_ASSOC);

    if (!$profile) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Profile not found.']);
        exit;
    }

    $addresses = [];
    if (!empty($profile['extra_addresses'])) {
        $decoded = json_decode($profile['extra_addresses'], true);
        if (is_array($decoded)) {
            $addresses = array_values($decoded);
        }
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        echo json_encode(['success' => true, 'addresses' => $addresses], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid request body.']);
        exit;
    }

    $action = $input['action'] ?? '';
    $index = filter_var($input['index'] ?? null, FILTER_VALIDATE_INT);

    if ($action === 'add' || $action === 'update') {
        $address = $input['address'] ?? null;
        if (!is_array($address)) {
            http_response_code(422);
            echo json_encode(['success' => false, 'message' => 'address must be an object.']);
            exit;
        }

        $fields = ['first_name', 'middle_name', 'last_name', 'suffix', 'address_line', 'city', 'province', 'postal_code', 'contact_number'];
        $cleanAddress = [];
        foreach ($fields as $field) {
            $value = $address[$field] ?? '';
            if (!is_string($value)) {
                http_response_code(422);
                echo json_encode(['success' => false, 'message' => 'Address fields must be strings.']);
                exit;
            }
            $cleanAddress[$field] = trim(strip_tags($value));
        }

        if ($cleanAddress['first_name'] === '' || $cleanAddress['last_name'] === '' || $cleanAddress['address_line'] === '') {
            http_response_code(422);
            echo json_encode(['success' => false, 'message' => 'first_name, last_name, and address_line are required.']);
            exit;
        }
        if (!preg_match('/^\d{4}$/', $cleanAddress['postal_code'])) {
            http_response_code(422);
            echo json_encode(['success' => false, 'message' => 'postal_code must contain 4 digits.']);
            exit;
        }
        if (!preg_match('/^\d{11,13}$/', $cleanAddress['contact_number'])) {
            http_response_code(422);
            echo json_encode(['success' => false, 'message' => 'contact_number must contain 11 to 13 digits.']);
            exit;
        }

        if ($action === 'add') {
            if (count($addresses) >= 10) {
                http_response_code(409);
                echo json_encode(['success' => false, 'message' => 'You may save up to 10 addresses.']);
                exit;
            }
            $addresses[] = $cleanAddress;
        } else {
            if ($index === false || $index < 0 || !array_key_exists($index, $addresses)) {
                http_response_code(422);
                echo json_encode(['success' => false, 'message' => 'A valid address index is required.']);
                exit;
            }
            $addresses[$index] = $cleanAddress;
        }
    } elseif ($action === 'delete') {
        if ($index === false || $index < 0 || !array_key_exists($index, $addresses)) {
            http_response_code(422);
            echo json_encode(['success' => false, 'message' => 'A valid address index is required.']);
            exit;
        }
        array_splice($addresses, $index, 1);
    } else {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'action must be add, update, or delete.']);
        exit;
    }

    $save = $pdo->prepare('UPDATE profiles SET extra_addresses = :addresses WHERE id = :id');
    $save->execute([
        'addresses' => json_encode($addresses, JSON_UNESCAPED_UNICODE),
        'id' => $_SESSION['user_id'],
    ]);

    echo json_encode(['success' => true, 'addresses' => $addresses], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    error_log('Saved addresses endpoint error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to update saved addresses.']);
}
