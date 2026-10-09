<?php
declare(strict_types=1);
header('Access-Control-Allow-Origin: http://localhost:3000'); header('Access-Control-Allow-Credentials: true'); header('Access-Control-Allow-Methods: GET, OPTIONS'); header('Access-Control-Allow-Headers: Content-Type'); header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
require_once __DIR__ . '/../config/database.php';
$pid = trim((string)($_GET['product_id'] ?? '')); if ($pid === '') { http_response_code(422); echo json_encode(['success'=>false,'message'=>'product_id is required.']); exit; }
$s=getDatabaseConnection()->prepare('SELECT id, product_id, variant_name, option_value, price_adjustment, stock, img_url FROM variants WHERE product_id=:pid ORDER BY variant_name, option_value'); $s->execute(['pid'=>$pid]); echo json_encode(['success'=>true,'variants'=>$s->fetchAll()], JSON_UNESCAPED_UNICODE);
