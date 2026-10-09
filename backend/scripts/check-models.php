<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("CLI only.\n");
}

require_once __DIR__ . '/../config/database.php';

$modelsDirectory = __DIR__ . '/../uploads/models';
$pdo = getDatabaseConnection();
$query = $pdo->query(
    "SELECT id, name, model_url
     FROM products
     WHERE model_url IS NOT NULL AND model_url <> ''
     ORDER BY name"
);

$missing = [];
foreach ($query->fetchAll(PDO::FETCH_ASSOC) as $product) {
    $path = parse_url((string) $product['model_url'], PHP_URL_PATH);
    if (!is_string($path)) {
        continue;
    }

    if (preg_match('~(?:^|/)uploads/models/([^/]+)$~', $path, $matches) !== 1
        && preg_match('~^models/([^/]+)$~', ltrim($path, '/'), $matches) !== 1) {
        continue;
    }

    $fileName = rawurldecode($matches[1]);
    if (!is_file($modelsDirectory . DIRECTORY_SEPARATOR . $fileName)) {
        $missing[] = $product;
    }
}

if ($missing === []) {
    echo "All local model files exist.\n";
    exit(0);
}

foreach ($missing as $product) {
    printf(
        "id=%s\tname=%s\tmodel_url=%s\n",
        $product['id'],
        $product['name'],
        $product['model_url']
    );
}
