<?php
// api/router.php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, GET");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

require_once 'config.php';

// AUTO FIX DATABASE (FINAL CLEANUP)
try {
    $res = $pdo->query("DESCRIBE `users`")->fetchAll(PDO::FETCH_COLUMN);
    
    // Hapus kolom 'role' lama jika masih ada
    if (in_array('role', $res)) {
        $pdo->exec("ALTER TABLE `users` DROP COLUMN `role`"); 
    }
    
    // Pastikan akses_level ada (failsafe)
    if (!in_array('akses_level', $res)) {
        $pdo->exec("ALTER TABLE `users` ADD COLUMN `akses_level` VARCHAR(50) DEFAULT 'kasir'");
    }

    // Pastikan data penting terisi
    $pdo->exec("UPDATE `users` SET `akses_level` = 'gudang' WHERE `username` = 'gudang' AND (`akses_level` IS NULL OR `akses_level` = '')");
    $pdo->exec("UPDATE `users` SET `akses_level` = 'superadmin' WHERE `username` = 'admin' AND (`akses_level` IS NULL OR `akses_level` = '')");
    
    $pdo->exec("ALTER TABLE `users` AUTO_INCREMENT = 1");
    $pdo->exec("ALTER TABLE `customers` AUTO_INCREMENT = 1");
} catch(Exception $e) { }

$action = isset($_GET['action']) ? $_GET['action'] : '';

switch ($action) {
    case 'login':
        $data = json_decode(file_get_contents("php://input"), true);
        $user = $data['username'];
        $pass = $data['password'];
        
        $stmt = $pdo->prepare("SELECT id, username, `akses_level` AS `role` FROM users WHERE username = ? AND password = ?");
        $stmt->execute([$user, $pass]);
        $result = $stmt->fetch();
        
        if ($result) {
            echo json_encode(["status" => "success", "user" => $result]);
        } else {
            echo json_encode(["status" => "error", "message" => "Invalid credentials"]);
        }
        break;

    case 'dashboard_data':
        $from = isset($_GET['from']) ? $_GET['from'] : null;
        $to = isset($_GET['to']) ? $_GET['to'] : null;
        $productId = isset($_GET['product_id']) ? $_GET['product_id'] : null;
        $customerIdFilter = isset($_GET['customer_id']) ? $_GET['customer_id'] : null;

        // 1. Ambil data produk master (untuk sisa stok)
        $stmtProduct = $pdo->query("SELECT * FROM products");
        $products = $stmtProduct->fetchAll();
        
        // 2. Transaksi (Beras Keluar & Uang Masuk)
        $sqlTx = "SELECT t.*, t.tanggal as created_at, p.nama as product_name, c.nama as customer_name 
                  FROM transactions t 
                  JOIN products p ON t.product_id = p.id 
                  LEFT JOIN customers c ON t.customer_id = c.id 
                  WHERE 1=1";
        
        $paramsTx = [];
        if ($from && $to) {
            $sqlTx .= " AND DATE(t.tanggal) BETWEEN ? AND ?";
            $paramsTx[] = $from;
            $paramsTx[] = $to;
        }
        if ($productId) {
            $sqlTx .= " AND t.product_id = ?";
            $paramsTx[] = $productId;
        }
        if ($customerIdFilter) {
            if ($customerIdFilter === 'UMUM') {
                $sqlTx .= " AND (t.customer_id IS NULL OR t.customer_id = 0)";
            } else {
                $sqlTx .= " AND t.customer_id = ?";
                $paramsTx[] = $customerIdFilter;
            }
        }
        
        $nota = isset($_GET['nota']) ? $_GET['nota'] : null;
        if ($nota) {
            $sqlTx .= " AND t.nota_number LIKE ?";
            $paramsTx[] = "%$nota%";
        }

        $sqlTx .= " ORDER BY t.tanggal DESC";
        $stmtTx = $pdo->prepare($sqlTx);
        $stmtTx->execute($paramsTx);
        $transactions = $stmtTx->fetchAll();

        // 3. Stok Masuk (Beras Masuk & Uang Keluar/Modal)
        $sqlSm = "SELECT sm.*, p.nama as product_name 
                  FROM stok_masuk sm 
                  JOIN products p ON sm.product_id = p.id 
                  WHERE 1=1";
        $paramsSm = [];
        if ($from && $to) {
            $sqlSm .= " AND DATE(sm.tanggal_masuk) BETWEEN ? AND ?";
            $paramsSm[] = $from;
            $paramsSm[] = $to;
        }
        $stmtSm = $pdo->prepare($sqlSm);
        $stmtSm->execute($paramsSm);
        $stockMasuk = $stmtSm->fetchAll();

        // 4. Varian Harga Sak
        $stmtVarian = $pdo->query("SELECT * FROM sak_pricing");
        $varians = $stmtVarian->fetchAll();
        
        foreach ($products as &$p) {
            $p['variants'] = array_values(array_filter($varians, function($v) use ($p) {
                return $v['product_id'] == $p['id'];
            }));
        }
        
        // 5. Daftar Pelanggan (Untuk POS & Laporan)
        $stmtCustomer = $pdo->query("SELECT * FROM customers");
        $customers = $stmtCustomer->fetchAll();

        // 6. Pembayaran Hutang (Debt Payments) -> Menambah Cash In
        $sqlDp = "SELECT dp.*, c.nama as customer_name 
                  FROM debt_payments dp 
                  JOIN customers c ON dp.customer_id = c.id 
                  WHERE 1=1";
        $paramsDp = [];
        if ($from && $to) {
            $sqlDp .= " AND DATE(dp.payment_date) BETWEEN ? AND ?";
            $paramsDp[] = $from;
            $paramsDp[] = $to;
        }
        $stmtDp = $pdo->prepare($sqlDp);
        $stmtDp->execute($paramsDp);
        $debtPayments = $stmtDp->fetchAll();

        echo json_encode([
            "status" => "success",
            "products" => $products,
            "customers" => $customers,
            "transactions" => $transactions,
            "stock_masuk" => $stockMasuk,
            "debt_payments" => $debtPayments
        ]);
        break;

    case 'transaction_bulk_process':
        $data = json_decode(file_get_contents("php://input"), true);
        $kasirId = $data['kasirId'];
        $customerId = $data['customerId'] ? $data['customerId'] : null;
        $paymentType = $data['paymentType']; // lunas / hutang
        $items = $data['items']; // array of items
        $nota = "BRS" . date('dmy') . (date('His')); // Temporarily using His for uniqueness, or stick to user BRS + date + counter logic

        // REFINED NOTA LOGIC (Reset daily)
        $datePrefix = date('dmy');
        $stmtCount = $pdo->prepare("SELECT COUNT(DISTINCT nota_number) FROM transactions WHERE DATE(tanggal) = CURDATE()");
        $stmtCount->execute();
        $counter = $stmtCount->fetchColumn() + 1;
        $nota = "BRS" . $datePrefix . $counter;

        try {
            $pdo->beginTransaction();

            $grandTotal = 0;
            foreach ($items as $item) {
                $productId = $item['product_id'];
                $variantId = $item['variant_id'];
                $unit = $item['unit'];
                $qty = floatval($item['qty']);
                $totalPrice = floatval($item['subtotal']);
                $grandTotal += $totalPrice;

                // VALIDASI STOK SERVER-SIDE
                if ($unit === 'sak') {
                    $stmtV = $pdo->prepare("SELECT stok_sak, kg_per_sak, label FROM sak_pricing WHERE id = ?");
                    $stmtV->execute([$variantId]);
                    $vData = $stmtV->fetch();
                    if ($vData['stok_sak'] < $qty) {
                        throw new Exception("Stok tidak cukup untuk varian: " . $vData['label'] . " (Sisa: " . $vData['stok_sak'] . " Sak)");
                    }
                    $kgPerSak = $vData['kg_per_sak'];
                    $totalKgKeluar = $kgPerSak * $qty;
                    
                    // Potong Stok Sak
                    $pdo->prepare("UPDATE sak_pricing SET stok_sak = stok_sak - ? WHERE id = ?")->execute([$qty, $variantId]);
                } else {
                    $stmtP = $pdo->prepare("SELECT stok_kg, nama FROM products WHERE id = ?");
                    $stmtP->execute([$productId]);
                    $pData = $stmtP->fetch();
                    if ($pData['stok_kg'] < $qty) {
                        throw new Exception("Stok tidak cukup untuk: " . $pData['nama'] . " (Sisa: " . $pData['stok_kg'] . " Kg)");
                    }
                    $totalKgKeluar = $qty;
                    // Potong Stok KG
                    $pdo->prepare("UPDATE products SET stok_kg = stok_kg - ? WHERE id = ?")->execute([$qty, $productId]);
                }

                // Insert Transaction
                $stmt = $pdo->prepare("INSERT INTO transactions (kasir_id, customer_id, product_id, variant_id, unit, kg_per_sak, qty, total_kg_keluar, total_price, payment_type, nota_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                $stmt->execute([$kasirId, $customerId, $productId, $variantId, $unit, ($unit === 'sak' ? $kgPerSak : null), $qty, $totalKgKeluar, $totalPrice, $paymentType, $nota]);
            }

            // Jika status HUTANG, tambah ke saldo hutang pelanggan
            if ($paymentType === 'hutang' && $customerId) {
                $stmtCust = $pdo->prepare("UPDATE customers SET hutang = hutang + ? WHERE id = ?");
                $stmtCust->execute([$grandTotal, $customerId]);
            }

            $pdo->commit();
            echo json_encode(["status" => "success", "nota" => $nota]);
        } catch (Exception $e) {
            $pdo->rollBack();
            echo json_encode(["status" => "error", "message" => $e->getMessage()]);
        }
        break;

    case 'transaction_process':
        $data = json_decode(file_get_contents("php://input"), true);
        
        $kasirId = $data['kasirId'];
        $customerId = $data['customerId'] ? $data['customerId'] : null;
        $productId = $data['productId'];
        $variantId = isset($data['variantId']) ? $data['variantId'] : null;
        $unit = $data['unit'];
        $qty = $data['qty']; // Berapa sak ATAU berapa kg
        $kgPerSak = isset($data['kgPerSak']) ? $data['kgPerSak'] : null;
        $totalPrice = $data['totalPrice'];
        $paymentType = $data['paymentType'];

        try {
            $pdo->beginTransaction();

            $totalKgKeluar = 0;
            if ($unit === 'sak') {
                $totalKgKeluar = floatval($qty) * floatval($kgPerSak);
            } else {
                $totalKgKeluar = floatval($qty); // karena unitnya sudah kg
            }

            // Insert Transaction
            $stmt = $pdo->prepare("INSERT INTO transactions (kasir_id, customer_id, product_id, variant_id, unit, kg_per_sak, qty, total_kg_keluar, total_price, payment_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([$kasirId, $customerId, $productId, $variantId, $unit, $kgPerSak, $qty, $totalKgKeluar, $totalPrice, $paymentType]);

            // Potong Stok secara Mandiri (Sak vs Eceran)
            if ($unit === 'sak') {
                $stmtStock = $pdo->prepare("UPDATE sak_pricing SET stok_sak = stok_sak - ? WHERE id = ?");
                $stmtStock->execute([$qty, $variantId]);
            } else {
                $stmtStock = $pdo->prepare("UPDATE products SET stok_kg = stok_kg - ? WHERE id = ?");
                $stmtStock->execute([$totalKgKeluar, $productId]);
            }

            // Tambah Hutang jika hutang
            if ($paymentType === 'hutang' && $customerId) {
                $stmtDebt = $pdo->prepare("UPDATE customers SET hutang = hutang + ? WHERE id = ?");
                $stmtDebt->execute([$totalPrice, $customerId]);
            }

            $pdo->commit();
            echo json_encode(["status" => "success"]);
        } catch (Exception $e) {
            $pdo->rollBack();
            echo json_encode(["status" => "error", "message" => $e->getMessage()]);
        }
        break;

    case 'save_product':
        $data = json_decode(file_get_contents("php://input"), true);
        $id = $data['id'];
        $kode = $data['kode'];
        $nama = $data['nama'];
        $stok_kg = $data['stok_kg'];
        $harga_kg = $data['harga_kg'];
        $harga_beli_kg = isset($data['harga_beli_kg']) ? $data['harga_beli_kg'] : 0;
        $variants = $data['variants'];
        $user_id = isset($data['user_id']) ? $data['user_id'] : null;
        $tanggal_masuk = isset($data['tanggal_masuk']) ? $data['tanggal_masuk'] : date('Y-m-d H:i:s');

        try {
            $pdo->beginTransaction();

            if ($id) {
                // Update
                $stmt = $pdo->prepare("UPDATE products SET kode = ?, nama = ?, harga_beli_kg = ?, stok_kg = ?, harga_kg = ? WHERE id = ?");
                $stmt->execute([$kode, $nama, $harga_beli_kg, $stok_kg, $harga_kg, $id]);
                $product_id = $id;
                $action_type = "EDIT";
                // Delete old variants
                $pdo->prepare("DELETE FROM sak_pricing WHERE product_id = ?")->execute([$id]);
            } else {
                // Insert
                $stmt = $pdo->prepare("INSERT INTO products (kode, nama, harga_beli_kg, stok_kg, harga_kg) VALUES (?, ?, ?, ?, ?)");
                $stmt->execute([$kode, $nama, $harga_beli_kg, $stok_kg, $harga_kg]);
                $product_id = $pdo->lastInsertId();
                $action_type = "CREATE";
            }

            // Catat ke History Utama
            $stmtHist = $pdo->prepare("INSERT INTO product_history (product_id, user_id, action_type, details, tanggal_fisik) VALUES (?, ?, ?, ?, ?)");
            $details = ($action_type === "CREATE") ? "Pendaftaran barang baru" : "Pemutakhiran data/stok barang";
            $stmtHist->execute([$product_id, $user_id, $action_type, $details, $tanggal_masuk]);

            // Insert variants
            if (!empty($variants)) {
                $stmtVar = $pdo->prepare("INSERT INTO sak_pricing (product_id, label, kg_per_sak, harga_sak, harga_beli_sak, harga_kg, stok_sak) VALUES (?, ?, ?, ?, ?, ?, ?)");
                $stmtLog = $pdo->prepare("INSERT INTO stok_masuk (product_id, jumlah_sak, kg_per_sak, total_kg, tanggal_masuk, user_id, harga_beli, total_biaya) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");

                foreach ($variants as $v) {
                    $hBeliSak = isset($v['harga_beli_sak']) ? $v['harga_beli_sak'] : 0;
                    $stmtVar->execute([$product_id, $v['label'], $v['kg_per_sak'], $v['harga_sak'], $hBeliSak, $v['harga_kg'], $v['stok_sak']]);
                    
                    // Jika ada stok awal, catat di riwayat stok masuk
                    if ($v['stok_sak'] > 0) {
                        $total_kg_var = floatval($v['stok_sak']) * floatval($v['kg_per_sak']);
                        $total_biaya = floatval($v['stok_sak']) * floatval($hBeliSak);
                        $stmtLog->execute([$product_id, $v['stok_sak'], $v['kg_per_sak'], $total_kg_var, $tanggal_masuk, $user_id, $hBeliSak, $total_biaya]);
                    }
                }
            }

            $pdo->commit();
            echo json_encode(["status" => "success"]);
        } catch (Exception $e) {
            $pdo->rollBack();
            echo json_encode(["status" => "error", "message" => $e->getMessage()]);
        }
        break;

    case 'delete_product':
        $data = json_decode(file_get_contents("php://input"), true);
        $id = $data['id'];
        
        try {
            $pdo->beginTransaction();
            // Delete variants first
            $pdo->prepare("DELETE FROM sak_pricing WHERE product_id = ?")->execute([$id]);
            // Delete product
            $pdo->prepare("DELETE FROM products WHERE id = ?")->execute([$id]);

            $pdo->commit();
            echo json_encode(["status" => "success"]);
        } catch (Exception $e) {
            $pdo->rollBack();
            echo json_encode(["status" => "error", "message" => $e->getMessage()]);
        }
        break;

    case 'add_stock':
        $data = json_decode(file_get_contents("php://input"), true);
        $product_id = $data['product_id'];
        $unit_sak_id = isset($data['unit_sak_id']) ? $data['unit_sak_id'] : null;
        $jumlah_sak = $data['jumlah_sak'];
        $kg_per_sak = $data['kg_per_sak'];
        $tanggal_masuk = isset($data['tanggal_masuk']) ? $data['tanggal_masuk'] : date('Y-m-d H:i:s');
        $total_kg = floatval($jumlah_sak) * floatval($kg_per_sak);

        try {
            $pdo->beginTransaction();
            // Rekam log masuk dengan tanggal
            $stmt = $pdo->prepare("INSERT INTO stok_masuk (product_id, jumlah_sak, kg_per_sak, total_kg, tanggal_masuk) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$product_id, $jumlah_sak, $kg_per_sak, $total_kg, $tanggal_masuk]);
            
            // Tambahkan stok independen
            if ($unit_sak_id === 'kg') {
                $stmtUpdate = $pdo->prepare("UPDATE products SET stok_kg = stok_kg + ? WHERE id = ?");
                $stmtUpdate->execute([$jumlah_sak, $product_id]);
            } else {
                $stmtUpdate = $pdo->prepare("UPDATE sak_pricing SET stok_sak = stok_sak + ? WHERE id = ?");
                $stmtUpdate->execute([$jumlah_sak, $unit_sak_id]);
            }

            $pdo->commit();
            echo json_encode(["status" => "success"]);
        } catch (Exception $e) {
            $pdo->rollBack();
            echo json_encode(["status" => "error", "message" => $e->getMessage()]);
        }
        break;
        
    case 'get_users':
        try {
            // PAKSA UPDATE DI SINI (Saat data dipanggil)
            $pdo->exec("UPDATE `users` SET `akses_level` = 'gudang' WHERE `username` = 'gudang'");
            $pdo->exec("UPDATE `users` SET `akses_level` = 'superadmin' WHERE `username` = 'admin'");
        } catch(Exception $e) {}
        
        $stmt = $pdo->query("SELECT id, username, `akses_level` AS `role` FROM users");
        echo json_encode(["status" => "success", "users" => $stmt->fetchAll()]);
        break;

    case 'save_user':
        $data = json_decode(file_get_contents("php://input"), true);
        $id = isset($data['id']) ? $data['id'] : null;
        $username = isset($data['username']) ? $data['username'] : '';
        $password = isset($data['password']) ? $data['password'] : '';
        $role = (isset($data['role']) && trim($data['role']) !== '') ? $data['role'] : 'kasir';

        if ($id) {
            // Update
            if ($password && trim($password) !== "") {
                $stmt = $pdo->prepare("UPDATE `users` SET `username` = ?, `password` = ?, `akses_level` = ? WHERE `id` = ?");
                $stmt->execute([$username, $password, $role, $id]);
            } else {
                $stmt = $pdo->prepare("UPDATE `users` SET `username` = ?, `akses_level` = ? WHERE `id` = ?");
                $stmt->execute([$username, $role, $id]);
            }
        } else {
            // Insert
            $stmt = $pdo->prepare("INSERT INTO `users` (`username`, `password`, `akses_level`) VALUES (?, ?, ?)");
            $stmt->execute([$username, $password, $role]);
        }
        echo json_encode(["status" => "success", "message" => "User saved successfully"]);
        break;

    case 'delete_user':
        $data = json_decode(file_get_contents("php://input"), true);
        $id = $data['id'];
        
        // Prevent deleting the last superadmin or self? 
        // For now simple delete.
        $stmt = $pdo->prepare("DELETE FROM users WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(["status" => "success"]);
        break;

    case 'get_product_history':
        $pid = $_GET['id'];
        try {
            $sql = "(SELECT h.created_at as tgl_sistem, h.tanggal_fisik as tgl_fisik, u.username as petugas, h.action_type as tipe, h.details as detail 
                     FROM product_history h 
                     LEFT JOIN users u ON h.user_id = u.id 
                     WHERE h.product_id = ?)
                    UNION ALL
                    (SELECT s.tanggal_masuk as tgl_sistem, s.tanggal_masuk as tgl_fisik, u.username as petugas, 'STOK_IN' as tipe, 
                     CONCAT('Masuk ', s.jumlah_sak, ' Sak @', s.kg_per_sak, 'kg (Total: ', s.total_kg, 'kg)') as detail
                     FROM stok_masuk s
                     LEFT JOIN users u ON s.user_id = u.id
                     WHERE s.product_id = ?)
                    ORDER BY tgl_sistem DESC";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$pid, $pid]);
            echo json_encode(['status' => 'success', 'history' => $stmt->fetchAll()]);
        } catch (Exception $e) {
            echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
        }
        break;

    case 'save_customer':
        $data = json_decode(file_get_contents("php://input"), true);
        $id = isset($data['id']) ? $data['id'] : null;
        $nama = $data['nama'];
        $no_hp = $data['no_hp'];

        if($id) {
            $stmt = $pdo->prepare("UPDATE customers SET nama = ?, hp = ? WHERE id = ?");
            $stmt->execute([$nama, $no_hp, $id]);
        } else {
            $stmt = $pdo->prepare("INSERT INTO customers (nama, hp, hutang) VALUES (?, ?, 0)");
            $stmt->execute([$nama, $no_hp]);
        }
        echo json_encode(["status" => "success"]);
        break;

    case 'delete_customer':
        $data = json_decode(file_get_contents("php://input"), true);
        $id = $data['id'];
        try {
            $pdo->beginTransaction();
            $pdo->prepare("DELETE FROM customers WHERE id = ?")->execute([$id]);
            
            // Renumber IDs agar berurutan mulai dari 1
            $pdo->exec("SET @count = 0");
            $pdo->exec("UPDATE customers SET id = (@count := @count + 1) ORDER BY id");
            $pdo->exec("ALTER TABLE customers AUTO_INCREMENT = 1");
            
            $pdo->commit();
            echo json_encode(["status" => "success"]);
        } catch (Exception $e) {
            $pdo->rollBack();
            echo json_encode(["status" => "error", "message" => $e->getMessage()]);
        }
        break;

    case 'process_debt_payment':
        $data = json_decode(file_get_contents("php://input"), true);
        $customer_id = $data['customer_id'];
        $amount = floatval($data['amount']);
        $method = $data['method'];
        $notes = $data['notes'];
        $user_id = isset($data['user_id']) ? $data['user_id'] : null;
        $date = isset($data['payment_date']) ? $data['payment_date'] : date('Y-m-d H:i:s');

        try {
            $pdo->beginTransaction();
            
            // 0. Ambil Hutang Saat Ini (Sebelum Bayar)
            $stmtC = $pdo->prepare("SELECT hutang FROM customers WHERE id = ?");
            $stmtC->execute([$customer_id]);
            $debt_before = floatval($stmtC->fetchColumn());
            $debt_after = $debt_before - $amount;

            // 1. Rekam Pembayaran
            $stmt = $pdo->prepare("INSERT INTO debt_payments (customer_id, amount, payment_method, notes, user_id, payment_date, debt_before, debt_after) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([$customer_id, $amount, $method, $notes, $user_id, $date, $debt_before, $debt_after]);

            // 2. Potong Hutang di Tabel Customer
            $stmtUpdate = $pdo->prepare("UPDATE customers SET hutang = ? WHERE id = ?");
            $stmtUpdate->execute([$debt_after, $customer_id]);

            $pdo->commit();
            echo json_encode(["status" => "success"]);
        } catch (Exception $e) {
            $pdo->rollBack();
            echo json_encode(["status" => "error", "message" => $e->getMessage()]);
        }
        break;

    case 'get_customer_payment_history':
        $cid = $_GET['id'];
        // Ambil riwayat bayar hutang saja
        $stmt = $pdo->prepare("SELECT dp.*, u.username as petugas 
                               FROM debt_payments dp 
                               LEFT JOIN users u ON dp.user_id = u.id 
                               WHERE dp.customer_id = ? 
                               ORDER BY dp.payment_date DESC");
        $stmt->execute([$cid]);
        echo json_encode(['status' => 'success', 'history' => $stmt->fetchAll()]);
        break;

    case 'delete_transaction':
        $data = json_decode(file_get_contents("php://input"), true);
        $id = $data['id'];

        try {
            $pdo->beginTransaction();

            // 1. Ambil Detail Transaksi sebelum dihapus
            $stmt = $pdo->prepare("SELECT * FROM transactions WHERE id = ?");
            $stmt->execute([$id]);
            $tx = $stmt->fetch();

            if (!$tx) throw new Exception("Transaksi tidak ditemukan");

            // 2. Kembalikan Stok
            if ($tx['unit'] === 'sak') {
                if ($tx['variant_id']) {
                    $stmtS = $pdo->prepare("UPDATE sak_pricing SET stok_sak = stok_sak + ? WHERE id = ?");
                    $stmtS->execute([$tx['qty'], $tx['variant_id']]);
                }
            } else {
                $stmtP = $pdo->prepare("UPDATE products SET stok_kg = stok_kg + ? WHERE id = ?");
                $stmtP->execute([$tx['qty'], $tx['product_id']]);
            }

            // 3. Kembalikan Hutang jika ada
            if ($tx['payment_type'] === 'hutang' && $tx['customer_id']) {
                $stmtC = $pdo->prepare("UPDATE customers SET hutang = hutang - ? WHERE id = ?");
                $stmtC->execute([$tx['total_price'], $tx['customer_id']]);
            }

            // 4. Hapus Transaksi
            $stmtD = $pdo->prepare("DELETE FROM transactions WHERE id = ?");
            $stmtD->execute([$id]);

            $pdo->commit();
            echo json_encode(["status" => "success"]);
        } catch (Exception $e) {
            $pdo->rollBack();
            echo json_encode(["status" => "error", "message" => $e->getMessage()]);
        }
        break;

    case 'update_transaction':
        $data = json_decode(file_get_contents("php://input"), true);
        $id = $data['id'];
        $new_qty = floatval($data['qty']);
        $new_payment = $data['payment_type'];

        try {
            $pdo->beginTransaction();

            // Ambil data transaksi lama
            $stmt = $pdo->prepare("SELECT * FROM transactions WHERE id = ?");
            $stmt->execute([$id]);
            $old = $stmt->fetch();
            if (!$old) throw new Exception("Transaksi tidak ditemukan");

            $old_qty = floatval($old['qty']);
            $qty_diff = $new_qty - $old_qty; // positif = tambah jual, negatif = kurangi jual

            $price_per_unit = $old['total_price'] / $old['qty'];
            $new_total_price = $price_per_unit * $new_qty;
            $new_total_kg = ($old['unit'] === 'sak') ? (floatval($old['kg_per_sak']) * $new_qty) : $new_qty;

            // Sinkronisasi Stok: jika qty berubah, sesuaikan stok
            if ($qty_diff != 0) {
                if ($old['unit'] === 'sak' && $old['variant_id']) {
                    // Validasi stok cukup jika qty bertambah
                    if ($qty_diff > 0) {
                        $stmtChk = $pdo->prepare("SELECT stok_sak FROM sak_pricing WHERE id = ?");
                        $stmtChk->execute([$old['variant_id']]);
                        $currentStock = floatval($stmtChk->fetchColumn());
                        if ($currentStock < $qty_diff) {
                            throw new Exception("Stok Sak tidak cukup! Sisa: " . $currentStock . " Sak");
                        }
                    }
                    // Potong/tambah stok sak (qty_diff positif = kurangi stok, negatif = tambah stok)
                    $stmtStock = $pdo->prepare("UPDATE sak_pricing SET stok_sak = stok_sak - ? WHERE id = ?");
                    $stmtStock->execute([$qty_diff, $old['variant_id']]);
                } else {
                    // Unit KG
                    if ($qty_diff > 0) {
                        $stmtChk = $pdo->prepare("SELECT stok_kg FROM products WHERE id = ?");
                        $stmtChk->execute([$old['product_id']]);
                        $currentStock = floatval($stmtChk->fetchColumn());
                        if ($currentStock < $qty_diff) {
                            throw new Exception("Stok KG tidak cukup! Sisa: " . $currentStock . " Kg");
                        }
                    }
                    $stmtStock = $pdo->prepare("UPDATE products SET stok_kg = stok_kg - ? WHERE id = ?");
                    $stmtStock->execute([$qty_diff, $old['product_id']]);
                }
            }

            // Sinkronisasi Hutang: jika tipe pembayaran berubah
            if ($old['payment_type'] !== $new_payment && $old['customer_id']) {
                if ($old['payment_type'] === 'hutang' && $new_payment === 'lunas') {
                    // Dari hutang ke lunas: kurangi hutang pelanggan
                    $pdo->prepare("UPDATE customers SET hutang = hutang - ? WHERE id = ?")->execute([$old['total_price'], $old['customer_id']]);
                } else if ($old['payment_type'] === 'lunas' && $new_payment === 'hutang') {
                    // Dari lunas ke hutang: tambah hutang pelanggan
                    $pdo->prepare("UPDATE customers SET hutang = hutang + ? WHERE id = ?")->execute([$new_total_price, $old['customer_id']]);
                }
            }
            // Jika tetap hutang tapi qty berubah
            if ($old['payment_type'] === 'hutang' && $new_payment === 'hutang' && $qty_diff != 0 && $old['customer_id']) {
                $price_diff = $new_total_price - floatval($old['total_price']);
                $pdo->prepare("UPDATE customers SET hutang = hutang + ? WHERE id = ?")->execute([$price_diff, $old['customer_id']]);
            }

            // Update record transaksi
            $stmtUpd = $pdo->prepare("UPDATE transactions SET qty = ?, total_kg_keluar = ?, total_price = ?, payment_type = ? WHERE id = ?");
            $stmtUpd->execute([$new_qty, $new_total_kg, $new_total_price, $new_payment, $id]);

            $pdo->commit();
            echo json_encode(["status" => "success"]);
        } catch (Exception $e) {
            $pdo->rollBack();
            echo json_encode(["status" => "error", "message" => $e->getMessage()]);
        }
        break;

    default:
        echo json_encode(["status" => "error", "message" => "Endpoint not found"]);
        break;
}
?>
