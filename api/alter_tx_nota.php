<?php
require_once 'config.php';
try {
    $pdo->exec("ALTER TABLE transactions ADD COLUMN nota_number VARCHAR(50) DEFAULT NULL");
    echo "Sukses: kolom nota_number ditambahkan ke transactions";
} catch (Exception $e) {
    echo "Info: " . $e->getMessage();
}
?>
