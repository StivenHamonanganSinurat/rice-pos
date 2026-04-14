<?php
require_once 'config.php';
try {
    $pdo->exec("ALTER TABLE products ADD COLUMN harga_beli_kg DECIMAL(15,2) DEFAULT 0 AFTER nama");
} catch(Exception $e) {}
try {
    $pdo->exec("ALTER TABLE sak_pricing ADD COLUMN harga_beli_sak DECIMAL(15,2) DEFAULT 0 AFTER label");
} catch(Exception $e) {}
try {
    $pdo->exec("ALTER TABLE stok_masuk ADD COLUMN harga_beli DECIMAL(15,2) DEFAULT 0");
} catch(Exception $e) {}
try {
    $pdo->exec("ALTER TABLE stok_masuk ADD COLUMN total_biaya DECIMAL(15,2) DEFAULT 0");
} catch(Exception $e) {}

echo "Migration Complete!";
?>
