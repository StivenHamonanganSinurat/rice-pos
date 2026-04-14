<?php
require_once 'config.php';
try {
    // 1. Tabel Riwayat Cicilan / Pembayaran Hutang
    $pdo->exec("CREATE TABLE IF NOT EXISTS debt_payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT,
        amount DECIMAL(15,2),
        payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        payment_method VARCHAR(50), -- Cash, Transfer, Cicilan
        notes TEXT,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    )");
    
    echo "Sukses: Database siap untuk manajemen pelanggan dan hutang";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
