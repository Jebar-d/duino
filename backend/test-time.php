<?php

date_default_timezone_set("Asia/Manila");

header("Content-Type: application/json; charset=utf-8");

echo json_encode([
    "php_time" => date("Y-m-d H:i:s"),
    "php_timezone" => date_default_timezone_get(),
    "php_datetime" => (new DateTimeImmutable())->format("Y-m-d H:i:s"),
    "php_utc" => (new DateTimeImmutable("now", new DateTimeZone("UTC")))->format("Y-m-d H:i:s")
]);