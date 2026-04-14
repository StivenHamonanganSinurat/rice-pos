<?php
require_once 'config.php';
try {
    $pdo->exec("ALTER TABLE transactions ADD COLUMN variant_id INT DEFAULT NULL");
    echo "Sukses: kolom variant_id ditambahkan ke transactions";
} catch (Exception $e) {
    echo "Info: " . $e->getMessage();
}
?>
