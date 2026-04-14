<?php
// api/config.php
// ============================================================
// CONFIG OTOMATIS: Deteksi apakah di XAMPP Lokal atau Online
// ============================================================

// Cek apakah ada file config lokal (untuk XAMPP di rumah)
if (file_exists(__DIR__ . '/config.local.php')) {
    require_once __DIR__ . '/config.local.php';
} else if (getenv('MYSQLHOST')) {
    // ============================================================
    // SETTING AUTOMATIC (RAILWAY / CLOUD)
    // ============================================================
    $host     = getenv('MYSQLHOST');
    $username = getenv('MYSQLUSER');
    $password = getenv('MYSQLPASSWORD');
    $database = getenv('MYSQLDATABASE');
    $port     = getenv('MYSQLPORT') ?: "3306";
} else {
    // ============================================================
    // SETTING INFINITYFREE ATAU HOSTING MANUAL
    // ============================================================
    $host     = "sql104.infinityfree.com";
    $username = "if0_41657666";
    $password = "Sinurat123";
    $database = "if0_41657666_beras_pos_db";
    $port     = "3306";
}

try {
    $dsn = "mysql:host=$host;port=$port;dbname=$database;charset=utf8";
    $pdo = new PDO($dsn, $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch(PDOException $e) {
    die(json_encode(["error" => "Koneksi Database Gagal: " . $e->getMessage()]));
}
?>
