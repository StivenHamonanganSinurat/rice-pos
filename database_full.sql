-- ============================================================
-- RICE POS - DATABASE LENGKAP (FULL EXPORT)
-- Import file ini ke phpMyAdmin di InfinityFree
-- ============================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;

-- 1. Tabel Pengguna (Users)
CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `akses_level` varchar(50) NOT NULL DEFAULT 'kasir',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `users` (`id`, `username`, `password`, `akses_level`) VALUES
(1, 'admin', '123', 'superadmin')
ON DUPLICATE KEY UPDATE `username`=`username`;

-- 2. Tabel Produk (Products)
CREATE TABLE IF NOT EXISTS `products` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `kode` varchar(20) NOT NULL,
  `nama` varchar(100) NOT NULL,
  `harga_kg` decimal(15,2) NOT NULL DEFAULT 0.00,
  `harga_beli_kg` decimal(15,2) NOT NULL DEFAULT 0.00,
  `stok_kg` decimal(15,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  UNIQUE KEY `kode` (`kode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Tabel Harga Varian Sak (Sak Pricing)
CREATE TABLE IF NOT EXISTS `sak_pricing` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` int(11) NOT NULL,
  `label` varchar(50) NOT NULL,
  `kg_per_sak` decimal(10,2) NOT NULL,
  `harga_sak` decimal(15,2) NOT NULL,
  `harga_kg` decimal(15,2) NOT NULL DEFAULT 0.00,
  `harga_beli_sak` decimal(15,2) NOT NULL DEFAULT 0.00,
  `stok_sak` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `product_id` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Tabel Log Stok Masuk (Stock In History)
CREATE TABLE IF NOT EXISTS `stok_masuk` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` int(11) NOT NULL,
  `jumlah_sak` int(11) NOT NULL DEFAULT 0,
  `kg_per_sak` decimal(10,2) NOT NULL DEFAULT 0.00,
  `total_kg` decimal(15,2) NOT NULL,
  `total_biaya` decimal(15,2) NOT NULL DEFAULT 0.00,
  `tanggal_masuk` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `product_id` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Tabel Pelanggan (Customers)
CREATE TABLE IF NOT EXISTS `customers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nama` varchar(100) NOT NULL,
  `hp` varchar(20) DEFAULT NULL,
  `hutang` decimal(15,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Tabel Transaksi (Transactions)
CREATE TABLE IF NOT EXISTS `transactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nota_number` varchar(50) DEFAULT NULL,
  `tanggal` datetime NOT NULL DEFAULT current_timestamp(),
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `kasir_id` int(11) NOT NULL,
  `customer_id` int(11) DEFAULT NULL,
  `product_id` int(11) NOT NULL,
  `product_name` varchar(100) DEFAULT NULL,
  `customer_name` varchar(100) DEFAULT NULL,
  `unit` enum('sak','kg') NOT NULL,
  `kg_per_sak` decimal(10,2) DEFAULT NULL,
  `qty` decimal(10,2) NOT NULL,
  `total_kg_keluar` decimal(15,2) NOT NULL,
  `total_price` decimal(15,2) NOT NULL,
  `payment_type` enum('lunas','hutang') NOT NULL,
  PRIMARY KEY (`id`),
  KEY `kasir_id` (`kasir_id`),
  KEY `customer_id` (`customer_id`),
  KEY `product_id` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Tabel Pembayaran Hutang (Debt Payments)
CREATE TABLE IF NOT EXISTS `debt_payments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_id` int(11) NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `payment_date` datetime NOT NULL DEFAULT current_timestamp(),
  `note` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `customer_id` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

COMMIT;
