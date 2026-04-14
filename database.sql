-- database.sql
-- Silakan Import file ini menggunakan phpMyAdmin

CREATE DATABASE IF NOT EXISTS `beras_pos_db`;
USE `beras_pos_db`;

-- 1. Tabel Pengguna (Admin & Kasir)
CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('superadmin','kasir') NOT NULL DEFAULT 'kasir',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO `users` (`id`, `username`, `password`, `role`) VALUES
(1, 'admin', '123', 'superadmin');

-- 2. Tabel Produk (Stok Beras Sentral dalam KG)
-- Stok hanya dicatat dalam KG (1 Gudang)
CREATE TABLE IF NOT EXISTS `products` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `kode` varchar(20) NOT NULL,
  `nama` varchar(100) NOT NULL,
  `harga_kg` decimal(15,2) NOT NULL DEFAULT 0.00,
  `stok_kg` decimal(15,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  UNIQUE KEY `kode` (`kode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO `products` (`id`, `kode`, `nama`, `harga_kg`, `stok_kg`) VALUES
(1, 'BRS-01', 'Beras Rojolele Super', 13000.00, 1000.00),
(2, 'BRS-02', 'Beras Pandan Wangi', 15000.00, 500.50);

-- 3. Tabel Harga Varian Sak
-- Harga per karung bisa berbeda-beda untuk tiap beras (contoh: sak 5kg, 10kg, 25kg)
CREATE TABLE IF NOT EXISTS `sak_pricing` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` int(11) NOT NULL,
  `label` varchar(50) NOT NULL,
  `kg_per_sak` decimal(10,2) NOT NULL,
  `harga_sak` decimal(15,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `product_id` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO `sak_pricing` (`id`, `product_id`, `label`, `kg_per_sak`, `harga_sak`) VALUES
(1, 1, 'Sak Kecil (5 Kg)', 5.00, 65000.00),
(2, 1, 'Sak Sedang (10 Kg)', 10.00, 130000.00),
(3, 1, 'Sak Besar (25 Kg)', 25.00, 320000.00),
(4, 2, 'Sak Kecil (5 Kg)', 5.00, 75000.00),
(5, 2, 'Sak Besar (25 Kg)', 25.00, 370000.00);

-- 4. Tabel Log Stok Masuk (Opsi Masa Depan)
CREATE TABLE IF NOT EXISTS `stok_masuk` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` int(11) NOT NULL,
  `jumlah_sak` int(11) NOT NULL DEFAULT 0,
  `kg_per_sak` decimal(10,2) NOT NULL DEFAULT 0.00,
  `total_kg` decimal(15,2) NOT NULL,
  `tanggal` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `product_id` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Tabel Pelanggan
CREATE TABLE IF NOT EXISTS `customers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nama` varchar(100) NOT NULL,
  `no_hp` varchar(20) DEFAULT NULL,
  `hutang` decimal(15,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO `customers` (`id`, `nama`, `no_hp`, `hutang`) VALUES
(1, 'Bapak Budi', '08123456789', 0.00);

-- 6. Tabel Transaksi
CREATE TABLE IF NOT EXISTS `transactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tanggal` datetime NOT NULL DEFAULT current_timestamp(),
  `kasir_id` int(11) NOT NULL,
  `customer_id` int(11) DEFAULT NULL,
  `product_id` int(11) NOT NULL,
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
