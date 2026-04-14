<?php
require_once 'config.php';
try {
    $pdo->exec("ALTER TABLE sak_pricing ADD COLUMN harga_kg DECIMAL(15,2) DEFAULT 0");
    echo "Sukses";
} catch (Exception $e) {
    if (strpos($e->getMessage(), 'Duplicate column name') !== false) {
        echo "Kolom sudah ada";
    } else {
        echo "Error: " . $e->getMessage();
    }
}
?>
