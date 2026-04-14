<?php
// api/auto_repair.php
require_once 'config.php';
header("Content-Type: text/plain");

echo "=== RICE POS DATABASE AUTO-REPAIR ===\n\n";

function addColumn($pdo, $table, $column, $type) {
    try {
        $check = $pdo->query("SHOW COLUMNS FROM `$table` LIKE '$column'")->fetch();
        if (!$check) {
            $pdo->exec("ALTER TABLE `$table` ADD COLUMN `$column` $type");
            echo "[OK] Tabel '$table': Kolom '$column' ditambahkan.\n";
        } else {
            echo "[SKIP] Tabel '$table': Kolom '$column' sudah ada.\n";
        }
    } catch (Exception $e) {
        echo "[ERROR] Tabel '$table': " . $e->getMessage() . "\n";
    }
}

try {
    // 1. Perbaikan Tabel stok_masuk
    addColumn($pdo, 'stok_masuk', 'user_id', 'INT DEFAULT NULL');
    addColumn($pdo, 'stok_masuk', 'harga_beli', 'DECIMAL(15,2) DEFAULT 0');
    addColumn($pdo, 'stok_masuk', 'total_biaya', 'DECIMAL(15,2) DEFAULT 0');

    // 2. Perbaikan Tabel products
    addColumn($pdo, 'products', 'harga_beli_kg', 'DECIMAL(15,2) DEFAULT 0');

    // 3. Perbaikan Tabel sak_pricing
    addColumn($pdo, 'sak_pricing', 'harga_beli_sak', 'DECIMAL(15,2) DEFAULT 0');

    // 4. Perbaikan Tabel transactions
    addColumn($pdo, 'transactions', 'modal_per_item', 'DECIMAL(15,2) DEFAULT 0');
    addColumn($pdo, 'transactions', 'laba', 'DECIMAL(15,2) DEFAULT 0');

    // 5. Buat tabel product_history jika belum ada
    $pdo->exec("CREATE TABLE IF NOT EXISTS product_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT,
        user_id INT,
        action_type VARCHAR(50), 
        details TEXT,
        tanggal_fisik DATETIME DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");
    echo "[OK] Tabel 'product_history' diperiksa/dibuat.\n";

    echo "\n=== SEMUA PERBAIKAN SELESAI! SILAKAN TEST INPUT LAGI ===\n";

} catch (Exception $e) {
    echo "\n[CRITICAL ERROR] " . $e->getMessage();
}
