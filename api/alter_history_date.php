<?php
require_once 'config.php';
try {
    $pdo->exec("ALTER TABLE product_history ADD COLUMN tanggal_fisik DATETIME DEFAULT NULL");
    echo "Sukses: kolom tanggal_fisik ditambahkan";
} catch (Exception $e) {
    echo "Info: " . $e->getMessage();
}
?>
