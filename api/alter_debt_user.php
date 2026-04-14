<?php
require_once 'config.php';
try {
    $pdo->exec("ALTER TABLE debt_payments ADD COLUMN user_id INT DEFAULT NULL");
    echo "Sukses: kolom user_id ditambahkan ke debt_payments";
} catch (Exception $e) {
    echo "Info: " . $e->getMessage();
}
?>
