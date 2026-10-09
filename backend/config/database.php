<?php

declare(strict_types=1);

const DB_HOST = '127.0.0.1';
const DB_PORT = '3306';
const DB_NAME = 'arduino_store';
const DB_USER = 'root';
const DB_PASS = '';

function getDatabaseConnection(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
        DB_HOST,
        DB_PORT,
        DB_NAME
    );

    try {
        $pdo = new PDO(
            $dsn,
            DB_USER,
            DB_PASS,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,

                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                
                PDO::ATTR_EMULATE_PREPARES => false,
                
                PDO::ATTR_PERSISTENT => false,
            ]
        );

        return $pdo;
    } catch (PDOException $e) {
        error_log(
            'Arduino Store database connection failed: ' .
            $e->getMessage()
        );

        http_response_code(500);

        header('Content-Type: application/json; charset=utf-8');

        echo json_encode(
            [
                'success' => false,
                'message' => 'Database connection failed.',
            ],
            JSON_UNESCAPED_UNICODE
        );

        exit;
    }
}