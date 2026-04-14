<?php
require_once 'config.php';
try {
    // 1. Tambah user_id ke stok_masuk
    $pdo->exec("ALTER TABLE stok_masuk ADD COLUMN user_id INT DEFAULT NULL");
    
    // 2. Buat tabel log aktivitas produk yang lebih umum
    $pdo->exec("CREATE TABLE IF NOT EXISTS product_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT,
        user_id INT,
        action_type VARCHAR(50), -- CREATE, EDIT, STOK_IN
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )");
    
    echo "Sukses: Database siap untuk fitur riwayat";
} catch (Exception $e) {
    echo "Info: " . $e->getMessage();
}
?>
