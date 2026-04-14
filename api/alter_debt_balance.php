<?php
require_once 'config.php';
try {
    $pdo->exec("ALTER TABLE debt_payments 
                ADD COLUMN debt_before DECIMAL(15,2) DEFAULT 0,
                ADD COLUMN debt_after DECIMAL(15,2) DEFAULT 0");
    echo "Sukses: kolom debt_before dan debt_after ditambahkan";
} catch (Exception $e) {
    echo "Info: " . $e->getMessage();
}
?>
