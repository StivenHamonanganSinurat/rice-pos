<?php
require_once 'config.php';
try {
    $pdo->exec("ALTER TABLE stok_masuk ADD COLUMN tanggal_masuk DATETIME DEFAULT NULL");
    echo "Sukses: kolom tanggal_masuk ditambahkan";
} catch (Exception $e) {
    if (strpos($e->getMessage(), 'Duplicate column name') !== false) {
        echo "Kolom sudah ada, tidak perlu update";
    } else {
        echo "Error: " . $e->getMessage();
    }
}
?>
