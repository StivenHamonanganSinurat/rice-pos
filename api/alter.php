<?php
require_once 'config.php';
try {
    $pdo->exec("ALTER TABLE sak_pricing ADD COLUMN stok_sak INT NOT NULL DEFAULT 0");
    echo "Sukses";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
