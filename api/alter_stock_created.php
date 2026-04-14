<?php
require_once 'config.php';
try {
    $pdo->exec("ALTER TABLE stok_masuk ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP");
    echo "Sukses: kolom created_at ditambahkan ke stok_masuk";
} catch (Exception $e) {
    echo "Info: " . $e->getMessage();
}
?>
