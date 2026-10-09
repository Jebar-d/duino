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

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';

try {
    $pdo = getDatabaseConnection();
    $adminId = requireAdmin($pdo);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $query = $pdo->query(
            'SELECT
                u.id,
                u.email,
                u.role,
                u.is_disabled,
                u.email_verified,
                u.created_at,
                p.username,
                p.first_name,
                p.middle_name,
                p.last_name,
                p.suffix,
                p.contact_number,
                COUNT(o.id) AS order_count
             FROM users u
             LEFT JOIN profiles p ON p.id = u.id
             LEFT JOIN orders o ON o.user_id = u.id
             GROUP BY
                u.id, u.email, u.role, u.is_disabled, u.email_verified, u.created_at,
                p.username, p.first_name, p.middle_name, p.last_name, p.suffix, p.contact_number
             ORDER BY u.created_at DESC'
        );
        $users = $query->fetchAll(PDO::FETCH_ASSOC);
        foreach ($users as &$user) {
            $user['is_disabled'] = (bool) $user['is_disabled'];
            $user['email_verified'] = (bool) $user['email_verified'];
            $user['order_count'] = (int) $user['order_count'];
        }
        unset($user);

        echo json_encode(['success' => true, 'users' => $users], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid request body.']);
        exit;
    }

    $action = (string) ($input['action'] ?? '');
    $userId = trim((string) ($input['user_id'] ?? ''));
    if ($userId === '') {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'user_id is required.']);
        exit;
    }

    if ($action === 'update') {
        $allowedFields = [
            'first_name' => 100,
            'last_name' => 100,
            'contact_number' => 50,
        ];
        $sets = [];
        $params = ['id' => $userId];

        foreach ($allowedFields as $field => $maxLength) {
            if (!array_key_exists($field, $input)) {
                continue;
            }
            if (!is_string($input[$field])) {
                http_response_code(422);
                echo json_encode(['success' => false, 'message' => $field . ' must be a string.']);
                exit;
            }
            $value = trim($input[$field]);
            if (mb_strlen($value) > $maxLength) {
                http_response_code(422);
                echo json_encode(['success' => false, 'message' => $field . ' is too long.']);
                exit;
            }
            $sets[] = $field . ' = :' . $field;
            $params[$field] = $value !== '' ? $value : null;
        }

        if ($sets === []) {
            http_response_code(422);
            echo json_encode(['success' => false, 'message' => 'At least one profile field is required.']);
            exit;
        }

        $exists = $pdo->prepare('SELECT id FROM users WHERE id = :id LIMIT 1');
        $exists->execute(['id' => $userId]);
        if (!$exists->fetchColumn()) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'User not found.']);
            exit;
        }

        $update = $pdo->prepare('UPDATE profiles SET ' . implode(', ', $sets) . ' WHERE id = :id');
        $update->execute($params);
        echo json_encode(['success' => true, 'message' => 'User profile updated.']);
        exit;
    }

    if ($action === 'set_role') {
        $role = $input['role'] ?? null;
        if (!is_string($role) || !in_array($role, ['user', 'admin'], true)) {
            http_response_code(422);
            echo json_encode(['success' => false, 'message' => 'role must be user or admin.']);
            exit;
        }
        if ($userId === $adminId) {
            http_response_code(409);
            echo json_encode(['success' => false, 'message' => 'You cannot change your own role.']);
            exit;
        }

        $pdo->beginTransaction();
        $target = $pdo->prepare('SELECT role FROM users WHERE id = :id FOR UPDATE');
        $target->execute(['id' => $userId]);
        $current = $target->fetch(PDO::FETCH_ASSOC);
        if (!$current) {
            $pdo->rollBack();
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'User not found.']);
            exit;
        }

        if ($current['role'] === 'admin' && $role !== 'admin') {
            $pdo->query("SELECT id FROM users WHERE role = 'admin' FOR UPDATE")->fetchAll();
            $adminCount = (int) $pdo->query("SELECT COUNT(*) FROM users WHERE role = 'admin'")->fetchColumn();
            if ($adminCount <= 1) {
                $pdo->rollBack();
                http_response_code(409);
                echo json_encode(['success' => false, 'message' => 'The last administrator cannot be removed.']);
                exit;
            }
        }

        $update = $pdo->prepare('UPDATE users SET role = :role WHERE id = :id');
        $update->execute(['role' => $role, 'id' => $userId]);
        $pdo->commit();
        echo json_encode(['success' => true, 'message' => 'User role updated.']);
        exit;
    }

    if ($action === 'set_disabled') {
        if (!array_key_exists('disabled', $input) || !is_bool($input['disabled'])) {
            http_response_code(422);
            echo json_encode(['success' => false, 'message' => 'disabled must be a boolean.']);
            exit;
        }
        if ($userId === $adminId && $input['disabled']) {
            http_response_code(409);
            echo json_encode(['success' => false, 'message' => 'You cannot disable your own account.']);
            exit;
        }

        $update = $pdo->prepare('UPDATE users SET is_disabled = :disabled WHERE id = :id');
        $update->execute(['disabled' => (int) $input['disabled'], 'id' => $userId]);
        if ($update->rowCount() === 0) {
            $exists = $pdo->prepare('SELECT id FROM users WHERE id = :id LIMIT 1');
            $exists->execute(['id' => $userId]);
            if (!$exists->fetchColumn()) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'User not found.']);
                exit;
            }
        }
        echo json_encode(['success' => true, 'message' => 'User account updated.']);
        exit;
    }

    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Invalid action.']);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Arduino Store admin users error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Unable to process user management request.']);
}
