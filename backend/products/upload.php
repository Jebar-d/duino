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
require_once __DIR__ . '/../config/auth.php';
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

$pdo = getDatabaseConnection();

$userId = requireAdmin($pdo);

$kind = (string)($_POST['kind'] ?? 'image');
if (!in_array($kind, ['image', 'model'], true)) { http_response_code(422); respond(false, 'Invalid upload kind.'); }

if (!isset($_FILES['image'])) {
    http_response_code(400);
    respond(false, 'No image was uploaded.');
}

$file = $_FILES['image'];

if (!is_array($file) || !isset($file['error'], $file['tmp_name'], $file['size'])) {
    http_response_code(400);
    respond(false, 'Invalid image upload.');
}

if ($file['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    respond(false, 'Image upload failed.');
}

if (!is_uploaded_file($file['tmp_name'])) {
    http_response_code(400);
    respond(false, 'Invalid uploaded file.');
}

$maxSize = $kind === 'model' ? 25 * 1024 * 1024 : 5 * 1024 * 1024;

if ((int) $file['size'] > $maxSize) {
    http_response_code(400);
    respond(false, $kind === 'model' ? 'Model must be 25 MB or smaller.' : 'Image must be 5 MB or smaller.');
}

if ($kind === 'model') {
    $handle = fopen($file['tmp_name'], 'rb');
    $magic = $handle ? fread($handle, 4) : '';
    if ($handle) fclose($handle);
    if ($magic !== 'glTF') { http_response_code(400); respond(false, 'Only valid GLB models are allowed.'); }
    $uploadDirectory = __DIR__ . '/../uploads/models';
    if (!is_dir($uploadDirectory) && !mkdir($uploadDirectory, 0755, true) && !is_dir($uploadDirectory)) { http_response_code(500); respond(false, 'Unable to create model directory.'); }
    $fileName = bin2hex(random_bytes(16)) . '.glb';
    if (!move_uploaded_file($file['tmp_name'], $uploadDirectory . DIRECTORY_SEPARATOR . $fileName)) { http_response_code(500); respond(false, 'Unable to save uploaded model.'); }
    respond(true, 'Model uploaded successfully.', ['url' => rtrim(UPLOAD_BASE_URL, '/') . '/models/' . $fileName]);
}

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mimeType = $finfo->file($file['tmp_name']);

$allowedTypes = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
];

if (!isset($allowedTypes[$mimeType])) {
    http_response_code(400);
    respond(false, 'Only JPG, PNG, and WEBP images are allowed.');
}

$extension = $allowedTypes[$mimeType];

$uploadDirectory = __DIR__ . '/../uploads/products';

if (!is_dir($uploadDirectory)) {
    if (!mkdir($uploadDirectory, 0755, true) && !is_dir($uploadDirectory)) {
        http_response_code(500);
        respond(false, 'Unable to create image directory.');
    }
}

$fileName = bin2hex(random_bytes(16)) . '.' . $extension;
$destination = $uploadDirectory . DIRECTORY_SEPARATOR . $fileName;

if (!move_uploaded_file($file['tmp_name'], $destination)) {
    http_response_code(500);
    respond(false, 'Unable to save uploaded image.');
}

$url = rtrim(UPLOAD_BASE_URL, '/') . '/products/' . $fileName;

respond(
    true,
    'Image uploaded successfully.',
    [
        'url' => $url,
    ]
);
