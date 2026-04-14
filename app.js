// app.js
 
document.addEventListener("DOMContentLoaded", () => {
    // API CONFIG
    const API_URL = "api/router.php?action=";
 
    // Referensi DOM Login
    const loginScreen = document.getElementById("login-screen");
    const appScreen = document.getElementById("app-screen");
    const btnLogin = document.getElementById("btn-login");
    const lblError = document.getElementById("login-error");
    const btnLogout = document.getElementById("btn-logout");
 
    // Referensi DOM User Info
    const lblUsername = document.getElementById("lbl-username");
    const lblRole = document.getElementById("lbl-role");
 
    // Navigation Logic
    const menuBtns = document.querySelectorAll(".menu-btn");
    const pages = document.querySelectorAll(".page");
 
    // Global State
    let salesChart;
    let productsList = [];
    let customersList = [];
    let currentTransactions = [];
    let cart = []; // Keranjang belanja POS
    let discountSettings = { discount_member: 0, discount_umum: 0 }; // Diskon dari pengaturan
    let currentUser = JSON.parse(sessionStorage.getItem("currentUser") || "null");
 
    // TOAST NOTIFICATION FUNCTION (Modern Version)
    function showToast(message, type = "success") {
        const container = document.getElementById("toast-container");
        const toast = document.createElement("div");
        toast.className = `toast ${type}`;
        
        let icon = type === "success" ? "✨" : "🚫";
        toast.innerHTML = `<div class="toast-icon">${icon}</div> <div class="toast-message">${message}</div>`;
        
        container.appendChild(toast);
 
        // Auto Remove after 4 seconds
        setTimeout(() => {
            toast.style.animation = "fadeOutRight 0.5s ease-in forwards";
            setTimeout(() => {
                toast.remove();
            }, 500);
        }, 4000);
    }
 
    // PREMIUM CUSTOM DIALOG (Replace Native Confirm/Alert)
    const dialogModal = document.getElementById("dialog-modal");
    const dialogTitle = document.getElementById("dialog-title");
    const dialogMsg = document.getElementById("dialog-message");
    const dialogIcon = document.getElementById("dialog-icon");
    const dialogOk = document.getElementById("dialog-btn-ok");
    const dialogCancel = document.getElementById("dialog-btn-cancel");
 
    function customConfirm(message, title = "Konfirmasi", icon = "❓") {
        return new Promise((resolve) => {
            dialogTitle.innerText = title;
            dialogMsg.innerText = message;
            dialogIcon.innerText = icon;
            dialogModal.style.display = "flex";
            dialogCancel.style.display = "block";
 
            const handleOk = () => {
                cleanup();
                resolve(true);
            };
            const handleCancel = () => {
                cleanup();
                resolve(false);
            };
            const cleanup = () => {
                dialogModal.style.display = "none";
                dialogOk.removeEventListener("click", handleOk);
                dialogCancel.removeEventListener("click", handleCancel);
            };
 
            dialogOk.addEventListener("click", handleOk);
            dialogCancel.addEventListener("click", handleCancel);
        });
    }
 
    function customAlert(message, title = "Informasi", icon = "ℹ️") {
        dialogTitle.innerText = title;
        dialogMsg.innerText = message;
        dialogIcon.innerText = icon;
        dialogModal.style.display = "flex";
        dialogCancel.style.display = "none";
        
        const handleOk = () => {
            dialogModal.style.display = "none";
            dialogOk.removeEventListener("click", handleOk);
        };
        dialogOk.addEventListener("click", handleOk);
    }
 
    // 1. AUTHENTICATION LOGIC
    function checkAuth() {
        if (currentUser) {
            loginScreen.style.display = "none";
            appScreen.style.display = "flex";
            lblUsername.innerText = currentUser.username.toUpperCase();
            
            // Normalize role
            let role = (currentUser.role || "").trim().toLowerCase();
            const username = (currentUser.username || "").toLowerCase();

            // FAILSAFE: Jika role kosong tapi username ada kata 'gudang'
            // Kita paksa role-nya jadi gudang secara global di session
            if(!role && username.includes('gudang')) {
                role = 'gudang';
                currentUser.role = 'gudang'; 
            }

            // Map Role Label
            let roleLabel = "Staff (" + (currentUser.role || "No Role") + ")";
            if(role === 'superadmin') roleLabel = "Super Admin";
            else if(role === 'demo') roleLabel = "Demo (View Only)";
            else if(role === 'kasir') roleLabel = "Kasir";
            else if(role === 'gudang') roleLabel = "Bagian Gudang";
            
            lblRole.innerText = roleLabel;
            
            // ACL (Access Control List)
            const allMenuBtns = document.querySelectorAll('.menu-btn');
            let firstVisiblePage = 'page-dashboard';

            allMenuBtns.forEach(btn => {
                const target = btn.getAttribute('data-target');
                btn.style.display = "none";

                // Pengecekan per role
                if (role === 'superadmin' || role === 'demo' || role.includes('admin')) {
                    btn.style.display = "block";
                } else if (role === 'gudang' || role.includes('gudang')) {
                    // Gudang TIDAK BOLEH lihat Dasbor
                    if (target === 'page-stock') {
                        btn.style.display = "block";
                        firstVisiblePage = 'page-stock'; // Set default page ke stok
                    }
                } else if (role === 'kasir') {
                    if (btn.classList.contains('role-kasir')) btn.style.display = "block";
                    // Dashboard tetap boleh untuk kasir? (Sesuai settingan awal)
                    if (target === 'page-dashboard') btn.style.display = "block";
                }
            });

            // Auto-Switch Page jika halaman aktif sekarang (Dasbor) dilarang
            const activePageId = document.querySelector('.page[style*="display: block"]')?.id || 'page-dashboard';
            if (role === 'gudang' || role.includes('gudang')) {
                // Sembunyikan semua halaman lalu buka stok
                pages.forEach(p => p.style.display = "none");
                document.getElementById('page-stock').style.display = "block";
                
                // Set sidebar active state
                allMenuBtns.forEach(b => b.classList.remove('active'));
                const stockBtn = document.querySelector('[data-target="page-stock"]');
                if(stockBtn) stockBtn.classList.add('active');
            } else {
                // Admin & Kasir default normal (Dashboard)
            }

            // Global accessibility (Edit/Delete Buttons in Stock)
            const adminOnlyEls = document.querySelectorAll('.admin-only');
            adminOnlyEls.forEach(el => {
                if(role === 'superadmin' || role === 'demo' || role.includes('gudang')) el.classList.remove('hidden-for-kasir');
                else el.classList.add('hidden-for-kasir');
            });

            fetchDataFromServer();
        } else {
            loginScreen.style.display = "flex";
            appScreen.style.display = "none";
        }
    }
 
    // Login trigger function
    function doLogin() {
        const u = document.getElementById("login-username").value;
        const p = document.getElementById("login-password").value;
        
        fetch(API_URL + 'login', {
            method: 'POST',
            body: JSON.stringify({username: u, password: p})
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === "success") {
                currentUser = data.user;
                sessionStorage.setItem("currentUser", JSON.stringify(currentUser));
                lblError.innerText = "";
                checkAuth();
            } else {
                lblError.innerText = "Username atau password salah!";
            }
        })
        .catch(err => {
            lblError.innerText = "Koneksi ke server gagal. Pastikan XAMPP menyala!";
        });
    }

    btnLogin.addEventListener("click", doLogin);

    // Enter Key Support for Login
    const loginInputs = [document.getElementById("login-username"), document.getElementById("login-password")];
    loginInputs.forEach(input => {
        if(input) {
            input.addEventListener("keyup", (e) => {
                if (e.key === "Enter") doLogin();
            });
        }
    });
 
    btnLogout.addEventListener("click", () => {
        currentUser = null;
        sessionStorage.removeItem("currentUser");
        checkAuth();
    });
 
    // 2. DATA FETCHING (Master Function)
    function fetchDataFromServer(from = null, to = null, productId = null, customerId = null, nota = null) {
        let url = API_URL + 'dashboard_data';
        if (from && to) url += `&from=${from}&to=${to}`;
        if (productId) url += `&product_id=${productId}`;
        if (customerId) url += `&customer_id=${customerId}`;
        if (nota) url += `&nota=${nota}`;
 
        fetch(url)
        .then(res => res.json())
        .then(data => {
            if(data.status === "success") {
                productsList = data.products;
                customersList = data.customers;
                
                loadDashboard(data.transactions, data.stock_masuk, data.debt_payments);
                loadInventory();
                loadCustomers();
                loadReports(data.transactions);
                loadStaff();
                initPOSForm();
            }
        });

        // Load discount settings secara paralel
        fetch(API_URL + 'get_discount_settings')
        .then(res => res.json())
        .then(data => {
            if(data.status === 'success') {
                discountSettings = data.settings;
                loadDiscountPage();
                updatePosDiscountDisplay();
            }
        }).catch(() => {});
    }
 
    // 2b. NAVIGATION LOGIC
    const sidebar = document.getElementById("main-sidebar");
    const toggleBtn = document.getElementById("btn-toggle-sidebar");
    const closeBtn = document.getElementById("btn-close-sidebar");

    if(toggleBtn) toggleBtn.addEventListener("click", () => sidebar.classList.add("open"));
    if(closeBtn) closeBtn.addEventListener("click", () => sidebar.classList.remove("open"));

    menuBtns.forEach(btn => {
        btn.addEventListener("click", (e) => {
            menuBtns.forEach(b => b.classList.remove("active"));
            e.currentTarget.classList.add("active");
            
            const targetId = e.currentTarget.getAttribute("data-target");
            pages.forEach(p => {
                p.style.display = p.id === targetId ? "block" : "none";
            });

            // Auto close sidebar on mobile after clicking menu
            if(window.innerWidth <= 900) {
                sidebar.classList.remove("open");
            }

            // Refresh data every page change just to be safe
            fetchDataFromServer();
        });
    });

    // === STAFF MANAGEMENT LOGIC ===
    const staffModal = document.getElementById("staff-modal");

    function loadStaff() {
        if(!document.getElementById("table-staff")) return;
        fetch(API_URL + 'get_users')
        .then(res => res.json())
        .then(data => {
            if(data.status === "success") {
                const tbody = document.getElementById("table-staff");
                tbody.innerHTML = "";
                data.users.forEach(u => {
                    const tr = document.createElement("tr");
                    
                    // Logic Warna & Label Badge
                    let rawRole = (u.role || "").toLowerCase();
                    const uname = (u.username || "").toLowerCase();
                    
                    // FAILSAFE DISPLAY: Jika di DB kosong, tebak dari username
                    if(!rawRole || rawRole === "") {
                        if(uname.includes("gudang")) rawRole = "gudang";
                        else if(uname === "admin") rawRole = "superadmin";
                        else rawRole = "kasir";
                    }

                    let bCol = 'var(--primary)';
                    let bLab = rawRole.toUpperCase();
                    
                    if(rawRole === 'superadmin') bCol = 'var(--accent)';
                    else if(rawRole === 'demo') bCol = '#06b6d4'; // Cyan 500
                    else if(rawRole === 'gudang') bCol = '#f59e0b'; // Amber 500

                    // Demo role: hanya lihat, tidak bisa edit/hapus staff
                    const isDemo = (currentUser.role || '').toLowerCase() === 'demo';
                    
                    tr.innerHTML = `
                        <td style="padding-left: 20px;">${u.id}</td>
                        <td><strong>${u.username}</strong></td>
                        <td><span class="role-badge" style="background:${bCol}">${bLab}</span></td>
                        <td style="text-align: right; padding-right: 20px;">
                            ${isDemo ? '<span style="color:var(--text-muted); font-size:0.8em;">🔒 View Only</span>' : `<div style="display:flex; gap:8px; justify-content: flex-end;">
                                <button class="btn-primary" style="padding: 6px 15px; font-size: 0.85em; border-radius: 8px; background:rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);" onclick="editUser(${u.id})">Edit</button>
                                ${currentUser.id != u.id ? `<button class="btn-danger" style="padding: 6px 15px; font-size: 0.85em; border-radius: 8px;" onclick="deleteUser(${u.id})">Hapus</button>` : ''}
                            </div>`}
                        </td>
                    `;
                    tbody.appendChild(tr);
                });

                // UPDATE QUICK STATS
                if(document.getElementById("stat-staff-total")) {
                    const users = data.users;
                    document.getElementById("stat-staff-total").innerText = users.length;
                    document.getElementById("stat-staff-gudang").innerText = users.filter(usr => {
                        const r = (usr.role || "").toLowerCase();
                        return r === "gudang" || (!r && usr.username.toLowerCase().includes("gudang"));
                    }).length;
                    document.getElementById("stat-staff-kasir").innerText = users.filter(usr => {
                        const r = (usr.role || "").toLowerCase();
                        return r === "kasir" || (!r && !usr.username.toLowerCase().includes("gudang") && usr.username.toLowerCase() !== "admin");
                    }).length;
                }
            }
        });
    }

    if(document.getElementById("btn-add-staff")) {
        const isDemoRole = (currentUser.role || '').toLowerCase() === 'demo';
        if(isDemoRole) {
            document.getElementById("btn-add-staff").style.display = "none";
        }
        document.getElementById("btn-add-staff").addEventListener("click", () => openStaffModal());
    }

    if(document.getElementById("btn-close-staff-modal")) {
        document.getElementById("btn-close-staff-modal").addEventListener("click", () => staffModal.style.display = "none");
    }

    window.openStaffModal = function(user = null) {
        if(user) {
            document.getElementById("modal-staff-title").innerText = "Edit Staff";
            document.getElementById("modal-staff-id").value = user.id;
            document.getElementById("modal-staff-username").value = user.username;
            document.getElementById("modal-staff-jabatan").value = user.role || "kasir";
            document.getElementById("modal-staff-password").value = ""; 
        } else {
            document.getElementById("modal-staff-title").innerText = "Tambah Staff Baru";
            document.getElementById("modal-staff-id").value = "";
            document.getElementById("modal-staff-username").value = "";
            document.getElementById("modal-staff-jabatan").value = "kasir";
            document.getElementById("modal-staff-password").value = "";
        }
        staffModal.style.display = "flex";
    };

    window.editUser = function(id) {
        fetch(API_URL + 'get_users') 
        .then(res => res.json())
        .then(data => {
            const u = data.users.find(x => x.id == id);
            if(u) openStaffModal(u);
        });
    };

    window.deleteUser = async function(id) {
        if(await customConfirm("Hapus akun staff ini secara permanen?", "Hapus Staff", "👥")) {
            fetch(API_URL + 'delete_user', {
                method: 'POST',
                body: JSON.stringify({id})
            })
            .then(res => res.json())
            .then(data => {
                if(data.status === "success") {
                    showToast("Staff berhasil dihapus!");
                    fetchDataFromServer();
                }
            });
        }
    };

    if(document.getElementById("btn-save-staff")) {
        document.getElementById("btn-save-staff").addEventListener("click", () => {
            const id = document.getElementById("modal-staff-id").value;
            const u = document.getElementById("modal-staff-username").value;
            const p = document.getElementById("modal-staff-password").value;
            const r = document.getElementById("modal-staff-jabatan").value;

            // VALIDASI TOTAL
            if(!u || u.trim() === "") return showToast("Username wajib diisi!", "error");
            if(!r || r === "") return showToast("Role / Akses wajib dipilih!", "error");
            
            // Password wajib hanya untuk USER BARU (id kosong)
            if(!id && (!p || p.trim() === "")) {
                return showToast("Password wajib diisi untuk staff baru!", "error");
            }

            const btn = document.getElementById("btn-save-staff");
            btn.disabled = true;
            btn.innerText = "Menyimpan...";

            fetch(API_URL + 'save_user', {
                method: 'POST',
                body: JSON.stringify({id, username: u, password: p, role: r})
            })
            .then(res => res.json())
            .then(data => {
                btn.disabled = false;
                btn.innerText = "Simpan Staff";
                
                if(data.status === "success") {
                    showToast(`Berhasil menyimpan staff: ${u}`);
                    staffModal.style.display = "none";
                    fetchDataFromServer(); // Refresh otomatis
                } else {
                    showToast("Gagal simpan: " + data.message, "error");
                }
            })
            .catch(err => {
                btn.disabled = false;
                btn.innerText = "Simpan Staff";
                showToast("Koneksi server terputus!", "error");
            });
        });
    }
 
    const formatRp = (angka) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits:0 }).format(angka);
    }
 
    // 3. DASHBOARD LOGIC
    function loadDashboard(transactions, stockMasuk = [], debtPayments = []) {
        currentTransactions = transactions; // Sync
        let totalOmzet = 0;      // Semua Nota (Lunas + Hutang)
        let totalCashIn = 0;     // Uang Masuk (Lunas + Bayar Hutang)
        let totalNewDebt = 0;    // Nilai Hutang Baru
        let totalExpense = 0;    // Modal (Stok Masuk)
        let totalStockIn = 0;
        let totalStockOut = 0;
        let totalStockRem = 0;

        // 1. Hitung Penjualan & Hutang Baru
        transactions.forEach(tx => {
            const price = parseFloat(tx.total_price) || 0;
            const kgOut = parseFloat(tx.total_kg_keluar || tx.qty) || 0;
            totalOmzet += price;
            totalStockOut += kgOut;

            if (tx.payment_type === 'lunas') {
                totalCashIn += price;
            } else {
                totalNewDebt += price;
            }
        });

        // 2. Hitung Pembayaran Hutang (Debt Payments) -> Menambah Cash In
        debtPayments.forEach(dp => {
            totalCashIn += parseFloat(dp.amount) || 0;
        });

        // 3. Hitung Modal (Stock Masuk)
        stockMasuk.forEach(sm => {
            totalExpense += parseFloat(sm.total_biaya || 0);
            totalStockIn += parseFloat(sm.total_kg || 0);
        });

        // 4. Hitung Sisa Stok & TOTAL PIUTANG SEMUA PELANGGAN (Outstanding)
        let totalDebtOutstanding = 0;
        customersList.forEach(c => {
            totalDebtOutstanding += parseFloat(c.hutang || 0);
        });

        productsList.forEach(p => {
            totalStockRem += parseFloat(p.stok_kg);
        });

        const profit = totalOmzet - totalExpense;

        // Update UI Cards
        if(document.getElementById("stat-revenue")) {
            document.getElementById("stat-revenue").innerText = formatRp(totalOmzet);
            document.getElementById("stat-cash-in").innerText = formatRp(totalCashIn);
            document.getElementById("stat-new-debt").innerText = formatRp(totalNewDebt);
            if(document.getElementById("stat-total-debt-active")) {
                document.getElementById("stat-total-debt-active").innerText = formatRp(totalDebtOutstanding);
            }
            document.getElementById("stat-expense").innerText = formatRp(totalExpense);
            document.getElementById("stat-profit").innerText = formatRp(profit);
            
            document.getElementById("stat-stock-in").innerText = totalStockIn.toLocaleString('id-ID') + " Kg";
            document.getElementById("stat-stock-out").innerText = totalStockOut.toLocaleString('id-ID') + " Kg";
            document.getElementById("stat-stock-rem").innerText = totalStockRem.toLocaleString('id-ID') + " Kg";
        }
 
        // Stock Alerts
        const alerts = document.getElementById("alert-list");
        if(alerts) {
            alerts.innerHTML = "";
            productsList.forEach(p => {
                if (parseFloat(p.stok_kg) < 50) { 
                    const li = document.createElement("li");
                    li.style.color = "#fbbf24";
                    li.innerHTML = `⚠️ <strong>${p.nama}</strong>: Stok Kritis (${parseFloat(p.stok_kg)} Kg)`;
                    alerts.appendChild(li);
                }
            });
        }
 
        renderChart(transactions, stockMasuk, debtPayments);
    }
 
    function renderChart(transactions, stockMasuk = [], debtPayments = []) {
        const ctx = document.getElementById('salesChart')?.getContext('2d');
        if (!ctx) return;
        if (salesChart) salesChart.destroy();
 
        const filterType = document.getElementById("dash-filter").value;
        let labels = [];
        let stats = {};

        // Helper to init stats object
        const initStat = () => ({ omzet: 0, cash: 0, piutang: 0, modal: 0 });

        if (filterType === 'yearly') {
            const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
            labels = months;
            months.forEach((m, idx) => stats[idx + 1] = initStat());

            transactions.forEach(tx => {
                const m = new Date(tx.created_at).getMonth() + 1;
                if (stats[m]) {
                    const price = parseFloat(tx.total_price) || 0;
                    stats[m].omzet += price;
                    if ((tx.payment_type || "").toLowerCase() === 'lunas') stats[m].cash += price;
                    else stats[m].piutang += price;
                }
            });
            // Hutang yang dibayar (cicilan) di tahun ini masuk ke Cash
            (debtPayments || []).forEach(dp => {
                const m = new Date(dp.payment_date).getMonth() + 1;
                if(stats[m]) stats[m].cash += parseFloat(dp.amount) || 0;
            });
            stockMasuk.forEach(sm => {
                const m = new Date(sm.tanggal_masuk).getMonth() + 1;
                if (stats[m]) stats[m].modal += parseFloat(sm.total_biaya || 0);
            });
        } else if (filterType === 'monthly') {
            const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
            for (let i = 1; i <= daysInMonth; i++) {
                labels.push(i);
                stats[i] = initStat();
            }
            transactions.forEach(tx => {
                const d = new Date(tx.created_at).getDate();
                if (stats[d]) {
                    const price = parseFloat(tx.total_price) || 0;
                    stats[d].omzet += price;
                    if ((tx.payment_type || "").toLowerCase() === 'lunas') stats[d].cash += price;
                    else stats[d].piutang += price;
                }
            });
            (debtPayments || []).forEach(dp => {
                const d = new Date(dp.payment_date).getDate();
                if(stats[d]) stats[d].cash += parseFloat(dp.amount) || 0;
            });
            stockMasuk.forEach(sm => {
                const d = new Date(sm.tanggal_masuk).getDate();
                if (stats[d]) stats[d].modal += parseFloat(sm.total_biaya || 0);
            });
        } else {
            const trendDays = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const ds = d.toISOString().split('T')[0];
                trendDays.push(ds);
                stats[ds] = initStat();
                labels.push(ds.split("-")[2] + "/" + ds.split("-")[1]);
            }
            transactions.forEach(tx => {
                const d = tx.created_at.split(" ")[0];
                if (stats[d]) {
                    const price = parseFloat(tx.total_price) || 0;
                    stats[d].omzet += price;
                    if ((tx.payment_type || "").toLowerCase() === 'lunas') stats[d].cash += price;
                    else stats[d].piutang += price;
                }
            });
            (debtPayments || []).forEach(dp => {
                const d = (dp.payment_date || "").split(" ")[0];
                if(stats[d]) stats[d].cash += parseFloat(dp.amount) || 0;
            });
            stockMasuk.forEach(sm => {
                const d = (sm.tanggal_masuk || "").split(" ")[0];
                if (stats[d]) stats[d].modal += parseFloat(sm.total_biaya || 0);
            });
        }

        const omzetData = Object.values(stats).map(s => s.omzet);
        const cashData = Object.values(stats).map(s => s.cash);
        const piutangData = Object.values(stats).map(s => s.piutang);
        const modalData = Object.values(stats).map(s => s.modal);
 
        salesChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Omzet',
                        data: omzetData,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        fill: true, tension: 0.4, borderWidth: 3
                    },
                    {
                        label: 'Tunai (Kas)',
                        data: cashData,
                        borderColor: '#fbbf24',
                        backgroundColor: 'rgba(251, 191, 36, 0.1)',
                        fill: true, tension: 0.4, borderWidth: 2
                    },
                    {
                        label: 'Piutang',
                        data: piutangData,
                        borderColor: '#c026d3', // Ungu
                        backgroundColor: 'rgba(192, 38, 211, 0.1)',
                        fill: true, tension: 0.4, borderWidth: 2
                    },
                    {
                        label: 'Modal',
                        data: modalData,
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.05)',
                        fill: true, tension: 0.4, borderDash: [5, 5]
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
                    y: { 
                        ticks: { color: '#94a3b8', callback: (v) => formatRp(v) },
                        grid: { color: 'rgba(255,255,255,0.05)' } 
                    }
                },
                plugins: {
                    legend: { labels: { color: '#94a3b8' } }
                }
            }
        });
    }
 
    // 3b. REPORTS LOGIC
    function loadReports(transactions) {
        const tbody = document.getElementById("table-reports");
        if(!tbody) return;
        tbody.innerHTML = "";

        // Re-populate Dropdowns with Latest Data
        const filterProduct = document.getElementById("report-filter-product");
        const filterCustomer = document.getElementById("report-filter-customer");
        
        if(filterProduct) {
            const currentVal = filterProduct.value;
            filterProduct.innerHTML = '<option value="">-- Semua Produk --</option>';
            productsList.forEach(p => {
                const opt = new Option(p.nama, p.id);
                filterProduct.appendChild(opt);
            });
            filterProduct.value = currentVal;
        }

        if(filterCustomer) {
            const currentVal = filterCustomer.value;
            filterCustomer.innerHTML = '<option value="">-- Semua Pelanggan --</option><option value="UMUM">Pelanggan Umum (Tanpa Nama)</option>';
            customersList.forEach(c => {
                const opt = new Option(c.nama, c.id);
                filterCustomer.appendChild(opt);
            });
            filterCustomer.value = currentVal;
        }

        let omzet = 0;
        let piutang = 0;
        let items = 0;

        transactions.forEach(tx => {
            const tr = document.createElement("tr");
            const rawStatus = (tx.payment_type || "lunas").toLowerCase();
            const badgeColor = rawStatus === 'lunas' ? 'var(--success)' : 'var(--danger)';
            const badgeText = rawStatus === 'lunas' ? 'LUNAS' : 'PIUTANG';

            // Stats update
            if(rawStatus === 'lunas') omzet += parseFloat(tx.total_price);
            else piutang += parseFloat(tx.total_price);
            items += parseFloat(tx.qty);

            tr.innerHTML = `
                <td style="padding-left: 20px;"><small>${tx.created_at}</small></td>
                <td><code style="color:var(--accent); font-weight:bold;">${tx.nota_number || '-'}</code></td>
                <td><strong>${tx.product_name}</strong></td>
                <td style="text-align: center;">${tx.qty} ${tx.unit}</td>
                <td style="font-weight:bold; color:var(--text-main);">${formatRp(tx.total_price)}</td>
                <td>${tx.customer_name || '<small style="color:var(--text-muted);">Umum</small>'}</td>
                <td><span class="role-badge" style="background:${badgeColor}; font-size:0.75em; border-radius:6px; padding:4px 10px;">${badgeText}</span></td>
                <td style="text-align: right; padding-right: 20px;">
                    <div style="display:flex; gap:5px; justify-content: flex-end;">
                        <button class="btn-primary" style="padding: 5px 12px; font-size: 0.75em; border-radius: 6px; background:rgba(255,255,255,0.05);" onclick="openEditTxModal(${tx.id})">Edit</button>
                        <button class="btn-danger" style="padding: 5px 12px; font-size: 0.75em; border-radius: 6px;" onclick="deleteTransaction(${tx.id})">Hapus</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Update Summary Cards
        if(document.getElementById("report-stat-omzet")) {
            document.getElementById("report-stat-omzet").innerText = formatRp(omzet);
            document.getElementById("report-stat-piutang").innerText = formatRp(piutang);
            document.getElementById("report-stat-items").innerText = items.toLocaleString('id-ID') + " Item";
        }
    }
 
    if(document.getElementById("btn-filter-report")) {
        document.getElementById("btn-filter-report").addEventListener("click", () => {
            const from = document.getElementById("report-date-from").value;
            const to = document.getElementById("report-date-to").value;
            const productId = document.getElementById("report-filter-product").value;
            const customerId = document.getElementById("report-filter-customer").value;
            const nota = document.getElementById("report-filter-nota").value;
            
            showToast("Mencari data laporan...");
            fetchDataFromServer(from, to, productId, customerId, nota);
        });
    }
 
    // 4. INVENTORY LOGIC
    function loadInventory() {
        const tbody = document.getElementById("table-stok");
        tbody.innerHTML = "";
        productsList.forEach(p => {
            let variantHtml = p.variants && p.variants.length > 0 
                ? p.variants.map(v => {
                    return `<div style="display:flex; justify-content:space-between; margin-bottom:5px; border-bottom:1px dashed rgba(255,255,255,0.1); padding-bottom:3px;">
                              <small style="color:var(--text-muted);">${v.label}</small>
                              <small>
                                <strong style="color:var(--accent); margin-right: 15px;">Tersisa: ${v.stok_sak} Sak</strong>
                                <strong style="color:white;">${formatRp(v.harga_sak)}</strong>
                              </small>
                            </div>`;
                }).join('') 
                : '<small style="color:var(--text-muted);">Tidak ada varian</small>';
 
            const tr = document.createElement("tr");
            const userRole = (currentUser.role || "").toLowerCase();
            const isPowerUser = userRole === 'superadmin' || userRole.includes('gudang');

            tr.innerHTML = `
                <td>${p.kode}</td>
                <td><strong>${p.nama}</strong></td>
                <td style="font-size: 1.1em; font-weight: bold; color: var(--primary);">${parseFloat(p.stok_kg).toLocaleString('id-ID')} Kg</td>
                <td>${formatRp(p.harga_kg)}</td>
                <td>${variantHtml}</td>
                <td class="admin-only ${!isPowerUser ? 'hidden-for-kasir' : ''}">
                    <div style="display: flex; gap: 8px; justify-content: flex-start;">
                        <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8em; background: #00bcd4;" onclick="showHistory(${p.id}, '${p.nama}')">Info</button>
                        <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8em; background: rgba(255,255,255,0.1);" onclick="editProduct(${p.id})">Edit</button>
                        ${isPowerUser ? `<button class="btn-danger" style="padding: 5px 10px; font-size: 0.8em;" onclick="deleteProduct(${p.id})">Hapus</button>` : ''}
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
 
    // 5. CUSTOMER LOGIC
    const customerSearchInput = document.getElementById("search-customer");
    if(customerSearchInput) {
        customerSearchInput.addEventListener("input", () => loadCustomers());
    }

    function loadCustomers() {
        const tbody = document.getElementById("table-customer");
        if(!tbody) return;
        tbody.innerHTML = "";
        
        const searchTerm = (customerSearchInput?.value || "").toLowerCase();

        customersList.forEach(c => {
            const hp = c.hp || '';
            if (searchTerm && !c.nama.toLowerCase().includes(searchTerm) && !hp.toLowerCase().includes(searchTerm)) {
                return;
            }

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${c.id}</td>
                <td><strong>${c.nama}</strong></td>
                <td>${hp || '-'}</td>
                <td style="color: ${c.hutang > 0 ? 'var(--danger)' : 'var(--success)'}; font-weight: bold; font-size: 1.1em;">
                    ${formatRp(c.hutang)}
                </td>
                <td>
                    <div style="display:flex; gap:8px;">
                        <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8em; background:#00bcd4;" onclick="showCustomerHistory(${c.id}, '${c.nama}')">Info</button>
                        <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8em; background:#4caf50;" onclick="openPaymentModal(${c.id}, '${c.nama}', ${c.hutang})">💸 Bayar</button>
                        <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8em; background:rgba(255,255,255,0.1);" onclick="editCustomer(${c.id})">Edit</button>
                        <button class="btn-danger" style="padding: 5px 10px; font-size: 0.8em;" onclick="deleteCustomer(${c.id})">Hapus</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
 
    // 6. SMART POS FORM LOGIC (REWRITTEN FOR MULTI-ITEM)
    const posProductSelect = document.getElementById("pos-product-select");
    const posUnitSelect = document.getElementById("pos-unit-select");
    const posSakVariant = document.getElementById("pos-sak-variant");
    const posSakGroup = document.getElementById("pos-sak-variant-group");
    const posQtyInput = document.getElementById("pos-qty");
    const posPriceDisplay = document.getElementById("pos-price-display");
    const posDateInput = document.getElementById("pos-date");
 
    function initPOSForm() {
        if(!posProductSelect) return;
        
        // Set Tanggal Hari Ini & Lock
        const today = new Date().toISOString().split('T')[0];
        if(posDateInput) posDateInput.value = today;
 
        // Populate Products
        posProductSelect.innerHTML = '<option value="">-- Cari / Pilih Beras --</option>';
        productsList.forEach(p => {
            const opt = document.createElement("option");
            opt.value = p.id;
            opt.textContent = `${p.kode} - ${p.nama}`;
            posProductSelect.appendChild(opt);
        });
 
        // Populate Customers
        const posCustomerSelect = document.getElementById("pos-customer-select");
        if(posCustomerSelect) {
            posCustomerSelect.innerHTML = '<option value="">-- Pelanggan Umum --</option>';
            customersList.forEach(c => {
                const opt = document.createElement("option");
                opt.value = c.id;
                opt.textContent = c.nama;
                posCustomerSelect.appendChild(opt);
            });
        }
 
        // Toggle Unit Sak/Kg
        posUnitSelect.addEventListener("change", () => {
            if(posUnitSelect.value === 'sak') {
                posSakGroup.style.display = 'block';
                updateSakVariants();
            } else {
                posSakGroup.style.display = 'none';
                updatePrice();
            }
        });
 
        posProductSelect.addEventListener("change", () => {
            if(posUnitSelect.value === 'sak') updateSakVariants();
            updatePrice();
        });
 
        posSakVariant.addEventListener("change", updatePrice);
        posQtyInput.addEventListener("input", updatePrice);
    }
 
    function updateSakVariants() {
        const pid = posProductSelect.value;
        const product = productsList.find(p => p.id == pid);
        posSakVariant.innerHTML = '<option value="">-- Pilih --</option>';
        if(product && product.variants) {
            product.variants.forEach(v => {
                const opt = document.createElement("option");
                opt.value = v.id;
                opt.textContent = `${v.label} (Stok: ${v.stok_sak})`;
                posSakVariant.appendChild(opt);
            });
        }
    }
 
    function updatePrice() {
        const pid = posProductSelect.value;
        const product = productsList.find(p => p.id == pid);
        let price = 0;
 
        if(product) {
            if(posUnitSelect.value === 'kg') {
                price = product.stok_kg > 0 ? parseFloat(product.harga_kg) : 0;
            } else {
                const vid = posSakVariant.value;
                const variant = product.variants.find(v => v.id == vid);
                if(variant) price = parseFloat(variant.harga_sak);
            }
        }
        posPriceDisplay.innerText = formatRp(price);
    }
 
    // CART LOGIC
    const btnAddToCart = document.getElementById("btn-add-to-cart");
    const tableCart = document.getElementById("table-cart");
    const posGrandTotal = document.getElementById("pos-grand-total");
    const posItemCount = document.getElementById("pos-item-count");
 
    if(btnAddToCart) {
        btnAddToCart.addEventListener("click", () => {
            const pid = posProductSelect.value;
            const product = productsList.find(p => p.id == pid);
            const unit = posUnitSelect.value;
            const qty = parseFloat(posQtyInput.value);
 
            if(!product) return showToast("Pilih produk terlebih dahulu!", "error");
            if(qty <= 0 || isNaN(qty)) return showToast("Jumlah tidak valid!", "error");
 
            let variantId = null;
            let label = "Eceran (Kg)";
            let price = parseFloat(product.harga_kg);
 
            // CEK STOK CLIENT-SIDE
            if(unit === 'kg') {
                if(qty > parseFloat(product.stok_kg)) {
                    return showToast(`Stok tidak cukup! (Sisa: ${product.stok_kg} Kg)`, "error");
                }
            } else {
                variantId = posSakVariant.value;
                const variant = product.variants.find(v => v.id == variantId);
                if(!variant) return showToast("Pilih ukuran sak!", "error");
                
                if(qty > parseFloat(variant.stok_sak)) {
                    return showToast(`Stok tidak cukup! (Sisa: ${variant.stok_sak} Sak)`, "error");
                }
                
                price = parseFloat(variant.harga_sak);
                label = variant.label;
            }
 
            const item = {
                product_id: product.id,
                product_name: product.nama,
                variant_id: variantId,
                label: label,
                unit: unit,
                qty: qty,
                price: price,
                subtotal: price * qty
            };
 
            cart.push(item);
            renderCart();
            showToast(`Ditambahkan: ${product.nama} (${label})`);
        });
    }
 
    function renderCart() {
        if(!tableCart) return;
        tableCart.innerHTML = "";
        if(cart.length === 0) {
            tableCart.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:50px;">Keranjang Kosong</td></tr>';
            posGrandTotal.innerText = "Rp 0";
            posItemCount.innerText = "0 Item";
            // Hapus info diskon
            const discInfo = document.getElementById("pos-discount-info");
            if(discInfo) discInfo.innerHTML = "";
            return;
        }
 
        let subtotal = 0;
        cart.forEach((item, index) => {
            subtotal += item.subtotal;
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${item.product_name}</strong><br><small style="color:var(--text-muted)">${item.label}</small></td>
                <td>${item.qty} ${item.unit}</td>
                <td style="text-align:right; font-weight:600;">${formatRp(item.subtotal)}</td>
                <td style="text-align:center;"><button class="btn-danger" style="padding:2px 8px; font-size:0.8em; width:auto;" onclick="removeFromCart(${index})">✕</button></td>
            `;
            tableCart.appendChild(tr);
        });

        // Hitung Diskon
        const customerSelect = document.getElementById("pos-customer-select");
        const customerId = customerSelect ? customerSelect.value : "";
        let discPct = 0;
        let discLabel = "";
        if(customerId) {
            discPct = discountSettings.discount_member || 0;
            discLabel = "Member";
        } else {
            discPct = discountSettings.discount_umum || 0;
            discLabel = "Umum";
        }

        const discAmount = subtotal * (discPct / 100);
        const grandTotal = subtotal - discAmount;

        // Tampilkan info diskon di bawah tabel
        let discInfo = document.getElementById("pos-discount-info");
        if(!discInfo) {
            discInfo = document.createElement("div");
            discInfo.id = "pos-discount-info";
            tableCart.parentElement.parentElement.insertBefore(discInfo, tableCart.parentElement.nextSibling);
        }
        
        if(discPct > 0) {
            discInfo.innerHTML = `
                <div style="padding:10px 15px; margin-top:8px; border-radius:8px; background:rgba(139,92,246,0.1); border:1px solid rgba(139,92,246,0.2);">
                    <div style="display:flex; justify-content:space-between; color:var(--text-muted); font-size:0.85em;">
                        <span>Subtotal</span><span>${formatRp(subtotal)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; color:var(--success); font-size:0.85em; margin-top:4px;">
                        <span>🏷️ Diskon ${discLabel} (${discPct}%)</span><span>- ${formatRp(discAmount)}</span>
                    </div>
                </div>`;
        } else {
            discInfo.innerHTML = "";
        }

        posGrandTotal.innerText = formatRp(grandTotal);
        posItemCount.innerText = `${cart.length} Item`;
    }
 
    window.removeFromCart = function(index) {
        cart.splice(index, 1);
        renderCart();
    };
 
    const btnClearCart = document.getElementById("btn-clear-cart");
    if(btnClearCart) btnClearCart.addEventListener("click", async () => {
        if(await customConfirm("Kosongkan semua item di keranjang?", "Hapus Keranjang", "🗑️")) {
            cart = [];
            renderCart();
        }
    });
 
    const btnProcessPos = document.getElementById("btn-process-pos");
    if(btnProcessPos) {
        btnProcessPos.addEventListener("click", async () => {
            if(cart.length === 0) return showToast("Keranjang masih kosong!", "error");
 
            const customerSelect = document.getElementById("pos-customer-select");
            const customerId = customerSelect ? customerSelect.value : null;
            const paymentType = document.getElementById("pos-payment-status").value;
 
            if(paymentType === 'hutang' && !customerId) {
                return showToast("Pelanggan wajib dipilih untuk transaksi hutang!", "error");
            }
 
            if(!(await customConfirm(`Selesaikan transaksi total ${posGrandTotal.innerText}?`, "Konfirmasi Pembayaran", "💰"))) return;
 
            btnProcessPos.disabled = true;
            btnProcessPos.innerText = "Memproses...";
 
            // Hitung diskon yang berlaku
            let discPct = 0;
            if(customerId) {
                discPct = discountSettings.discount_member || 0;
            } else {
                discPct = discountSettings.discount_umum || 0;
            }
            const discMultiplier = 1 - (discPct / 100);

            // Terapkan diskon ke subtotal setiap item
            const discountedItems = cart.map(item => ({
                ...item,
                subtotal: Math.round(item.subtotal * discMultiplier)
            }));

            fetch(API_URL + 'transaction_bulk_process', {
                method: 'POST',
                body: JSON.stringify({
                    kasirId: currentUser.id,
                    customerId: customerId,
                    paymentType: paymentType,
                    discount_pct: discPct,
                    items: discountedItems
                })
            })
            .then(res => res.json())
            .then(data => {
                btnProcessPos.disabled = false;
                btnProcessPos.innerText = "🚀 Proses & Selesaikan Transaksi";
                
                if(data.status === "success") {
                    let msg = `Transaksi Berhasil Selesai!\nNota: ${data.nota}`;
                    if(discPct > 0) msg += `\nDiskon: ${discPct}%`;
                    customAlert(msg, "Transaksi Sukses", "🎉");
                    cart = [];
                    renderCart();
                    fetchDataFromServer(); // Refresh stok
                } else {
                    showToast("Gagal: " + data.message, "error");
                }
            });
        });
    }
 
    // Run Initial Auth Check
    checkAuth();
 
    // === 6. CRUD INVENTORY (STOCK MANAGEMENT) ===
    const productModal = document.getElementById("product-modal");
    const btnAddProduct = document.getElementById("btn-add-product");
    const btnCloseProductModal = document.getElementById("btn-close-product-modal");
    const btnSaveProduct = document.getElementById("btn-save-product");
    const btnAddVariantRow = document.getElementById("btn-add-variant-row");
    const variantsContainer = document.getElementById("variants-container");
 
    function getLocalDateTimeStr() {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        return new Date(now - offset).toISOString().slice(0, 16);
    }
 
    const inputProductDateNow = document.getElementById("modal-product-date-now");
    const inputProductDate = document.getElementById("modal-product-date");
 
    function syncProductDateNow() {
        if(inputProductDateNow.checked) {
            inputProductDate.value = getLocalDateTimeStr();
            inputProductDate.disabled = true;
            inputProductDate.style.opacity = "0.5";
        } else {
            inputProductDate.disabled = false;
            inputProductDate.style.opacity = "1";
        }
    }
    if(inputProductDateNow) inputProductDateNow.addEventListener("change", syncProductDateNow);
 
    function openProductModal(product = null) {
        variantsContainer.innerHTML = "";
 
        if (product) {
            document.getElementById("modal-product-title").innerText = "Edit Beras";
            document.getElementById("modal-product-id").value = product.id;
            document.getElementById("modal-product-kode").value = product.kode;
            document.getElementById("modal-product-nama").value = product.nama;
            document.getElementById("modal-product-stok").value = product.stok_kg;
            
            // Financials Masuk
            document.getElementById("modal-product-harga-beli").value = product.harga_beli_kg || 0;
            document.getElementById("modal-product-harga-jual").value = product.harga_kg || 0;
            
            inputProductDateNow.checked = true;
            syncProductDateNow();
 
            if(product.variants && product.variants.length > 0) {
                product.variants.forEach(v => appendVariantRow(v.label, v.kg_per_sak, v.harga_sak, v.stok_sak, v.harga_kg, v.harga_beli_sak));
            }
        } else {
            document.getElementById("modal-product-title").innerText = "Tambah Beras Baru";
            document.getElementById("modal-product-id").value = "";
            document.getElementById("modal-product-harga-beli").value = "";
            document.getElementById("modal-product-harga-jual").value = "";
            
            // Auto-Generate Kode Beras
            let nextId = 1;
            if(productsList.length > 0) {
                const codes = productsList.map(p => {
                    const match = p.kode.match(/BRS-(\d+)/);
                    return match ? parseInt(match[1]) : 0;
                });
                nextId = Math.max(...codes) + 1;
            }
            const autoKode = "BRS-" + String(nextId).padStart(2, '0');
            document.getElementById("modal-product-kode").value = autoKode;
 
            document.getElementById("modal-product-nama").value = "";
            document.getElementById("modal-product-stok").value = "0";
            
            inputProductDateNow.checked = true;
            syncProductDateNow();
            
            appendVariantRow();
        }
        productModal.style.display = "flex";
    }
 
    function appendVariantRow(label = "", kg = "", harga = "", stok = "", hargaKgSaved = "", hargaBeli = "") {
        let hargaKg = hargaKgSaved;
        if(!hargaKg && kg && harga && parseFloat(kg) > 0) {
            hargaKg = Math.round(parseFloat(harga) / parseFloat(kg));
        }
 
        const row = document.createElement("div");
        row.className = "variant-row";
        row.innerHTML = `
            <div class="input-group">
                <label>Kg</label>
                <input type="number" step="0.01" class="var-kg" placeholder="Cth: 5" value="${kg}">
            </div>
            <div class="input-group">
                <label style="color:var(--accent);">Stok Sak</label>
                <input type="number" class="var-stok" placeholder="10" value="${stok}">
            </div>
            <div class="input-group">
                <label style="color:#ef4444;">Beli (/Sak)</label>
                <input type="number" class="var-harga-beli" placeholder="Modal" value="${hargaBeli}">
            </div>
            <div class="input-group">
                <label style="color:#10b981;">Jual (/Sak)</label>
                <input type="number" class="var-harga" placeholder="Jual" value="${harga}">
            </div>
            <button class="btn-danger" style="padding: 12px; margin-bottom: 0;" onclick="this.parentElement.remove(); window.calcMagicStock();">X</button>
        `;
        
        const kgInput = row.querySelector('.var-kg');
        const hrgBeliInput = row.querySelector('.var-harga-beli');
        const hrgSakInput = row.querySelector('.var-harga');
        const stokInput = row.querySelector('.var-stok');
 
        kgInput.addEventListener("input", () => {
             updateMasterPricesFromVariant(row);
             window.calcMagicStock();
        });
 
        if(hrgBeliInput) {
            hrgBeliInput.addEventListener("input", () => {
                updateMasterPricesFromVariant(row);
            });
        }
        if(hrgSakInput) {
            hrgSakInput.addEventListener("input", () => {
                updateMasterPricesFromVariant(row);
            });
        }
        stokInput.addEventListener("input", window.calcMagicStock);
        
        variantsContainer.appendChild(row);
    }

    function updateMasterPricesFromVariant(row) {
        const kg = parseFloat(row.querySelector(".var-kg").value) || 0;
        const hBeliSak = parseFloat(row.querySelector(".var-harga-beli").value) || 0;
        const hJualSak = parseFloat(row.querySelector(".var-harga").value) || 0;

        if (kg > 0) {
            const hBeliKg = Math.round(hBeliSak / kg);
            const hJualKg = Math.round(hJualSak / kg);

            document.getElementById("modal-product-harga-beli").value = hBeliKg;
            document.getElementById("modal-product-harga-jual").value = hJualKg;
        }
    }
 
    window.calcMagicStock = function() {
        const variantRows = document.querySelectorAll(".variant-row");
        let addedKg = 0;
        let isEditingMagicBox = false;
 
        variantRows.forEach(row => {
            const kg = parseFloat(row.querySelector(".var-kg").value) || 0;
            const sak = parseFloat(row.querySelector(".var-stok").value) || 0;
            if (sak > 0) isEditingMagicBox = true;
            addedKg += Math.max(0, kg * sak);
        });
        
        const stokField = document.getElementById("modal-product-stok");
        if(isEditingMagicBox) {
             stokField.value = addedKg; 
             stokField.style.border = "2px solid var(--accent)";
        } else {
             stokField.style.border = "1px solid rgba(255, 255, 255, 0.1)";
        }
    };
 
    if (btnAddProduct) btnAddProduct.addEventListener("click", () => openProductModal());
    if (btnCloseProductModal) btnCloseProductModal.addEventListener("click", () => productModal.style.display = "none");
    if (btnAddVariantRow) btnAddVariantRow.addEventListener("click", () => appendVariantRow());
 
    if (btnSaveProduct) {
        btnSaveProduct.addEventListener("click", () => {
            const id = document.getElementById("modal-product-id").value;
            const kode = document.getElementById("modal-product-kode").value;
            const nama = document.getElementById("modal-product-nama").value;
            const stok_kg = document.getElementById("modal-product-stok").value;
            const tanggal_masuk = document.getElementById("modal-product-date").value;
            const harga_beli_kg = document.getElementById("modal-product-harga-beli").value;
            const harga_kg = document.getElementById("modal-product-harga-jual").value;

            const variantRows = document.querySelectorAll(".variant-row");
            const variants = [];
            variantRows.forEach((row) => {
                const k = row.querySelector(".var-kg").value;
                const hBeli = row.querySelector(".var-harga-beli").value;
                const hSak = row.querySelector(".var-harga").value;
                const s = row.querySelector(".var-stok").value || 0;
 
                if(k && hSak) {
                    const l = `Sak ${k} Kg`;
                    // Calculate harga_kg variant automatically
                    const hKgVar = (k > 0) ? (hSak / k) : 0;
                    variants.push({
                        label: l, 
                        kg_per_sak: k, 
                        harga_sak: hSak, 
                        harga_beli_sak: hBeli, // New field
                        harga_kg: hKgVar, 
                        stok_sak: s
                    });
                }
            });
 
            if(!kode || !nama) return showToast("Kode dan Nama wajib diisi!", "error");
            if(!tanggal_masuk) return showToast("Tanggal masuk wajib diisi!", "error");
 
            btnSaveProduct.disabled = true;
            btnSaveProduct.innerText = "Menyimpan...";
 
            fetch(API_URL + 'save_product', {
                method: 'POST',
                body: JSON.stringify({
                    id, 
                    kode, 
                    nama, 
                    stok_kg, 
                    harga_kg, 
                    harga_beli_kg, 
                    variants, 
                    tanggal_masuk, 
                    user_id: currentUser.id
                })
            })
            .then(res => res.json())
            .then(data => {
                btnSaveProduct.disabled = false;
                btnSaveProduct.innerText = "Simpan Beras";
                if(data.status === "success") {
                    showToast("Beras berhasil disimpan!");
                    productModal.style.display = "none";
                    fetchDataFromServer();
                } else {
                    showToast("Gagal: " + data.message, "error");
                }
            });
        });
    }
 
    // Expose functions globally for inline onclick in innerHTML
    window.editProduct = function(id) {
        const product = productsList.find(p => p.id == id);
        if(product) openProductModal(product);
    };
 
    window.deleteProduct = async function(id) {
        if(await customConfirm("HAPUS PERMANEN BERAS INI?\nWarning: Data transaksi lama mungkin akan terpengaruh.", "Hapus Produk", "⚠️")) {
            fetch(API_URL + 'delete_product', {
                method: 'POST',
                body: JSON.stringify({id})
            })
            .then(res => res.json())
            .then(data => {
                if(data.status === "success") {
                    showToast("Data Berhasil Dihapus!");
                    fetchDataFromServer();
                } else {
                    showToast("Gagal: " + data.message, "error");
                }
            });
        }
    };
 
    window.showHistory = function(id, name) {
        document.getElementById("history-product-name").innerText = name;
        const tbody = document.getElementById("table-history");
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Memuat riwayat...</td></tr>';
        document.getElementById("history-modal").style.display = "flex";
 
        fetch(API_URL + 'get_product_history&id=' + id)
        .then(res => res.json())
        .then(data => {
            if(data.status === "success" && data.history) {
                tbody.innerHTML = "";
                if(data.history.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Belum ada riwayat aktivitas.</td></tr>';
                    return;
                }
                data.history.forEach(h => {
                    const tr = document.createElement("tr");
                    tr.innerHTML = `
                        <td><small>${h.tgl_sistem}</small></td>
                        <td style="color:var(--accent); font-weight:500;"><small>${h.tgl_fisik}</small></td>
                        <td>${h.petugas || 'System'}</td>
                        <td><span class="role-badge" style="font-size:0.7em; background:rgba(255,255,255,0.1);">${h.tipe}</span></td>
                        <td>${h.detail}</td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--danger);">Gagal memuat riwayat.</td></tr>';
            }
        });
    };
 
    // === 7. CUSTOMER & DEBT LOGIC ===
    const customerModal = document.getElementById("customer-modal");
    const paymentModal = document.getElementById("payment-modal");
 
    window.openCustomerModal = function(customer = null) {
        if(customer) {
            document.getElementById("modal-customer-title").innerText = "Edit Pelanggan";
            document.getElementById("modal-customer-id").value = customer.id;
            document.getElementById("modal-customer-nama").value = customer.nama;
            document.getElementById("modal-customer-phone").value = customer.hp || '';
        } else {
            document.getElementById("modal-customer-title").innerText = "Tambah Pelanggan Baru";
            document.getElementById("modal-customer-id").value = "";
            document.getElementById("modal-customer-nama").value = "";
            document.getElementById("modal-customer-phone").value = "";
        }
        customerModal.style.display = "flex";
    };
 
    document.getElementById("btn-add-customer").addEventListener("click", () => openCustomerModal());
    document.getElementById("btn-close-customer-modal").addEventListener("click", () => customerModal.style.display = "none");
    
    document.getElementById("btn-save-customer").addEventListener("click", () => {
        const id = document.getElementById("modal-customer-id").value;
        const nama = document.getElementById("modal-customer-nama").value;
        const no_hp = document.getElementById("modal-customer-phone").value.trim();
 
        if(!nama) return showToast("Nama wajib diisi!", "error");

        // Validasi Nomor HP: harus angka, dimulai 08, max 13 digit
        if(no_hp) {
            if(!/^08\d{8,11}$/.test(no_hp)) {
                return showToast("No HP harus diawali 08 dan berisi 10-13 angka!", "error");
            }
        }
 
        fetch(API_URL + 'save_customer', {
            method: 'POST',
            body: JSON.stringify({id, nama, no_hp})
        })
        .then(res => res.json())
        .then(data => {
            if(data.status === "success") {
                showToast("Pelanggan berhasil disimpan!");
                if(customerModal) customerModal.style.display = "none";
                fetchDataFromServer();
            }
        });
    });
 
    window.editCustomer = function(id) {
        const c = customersList.find(cust => cust.id == id);
        if(c) openCustomerModal(c);
    };
 
    window.deleteCustomer = async function(id) {
        if(await customConfirm("Hapus data pelanggan ini dari sistem?", "Hapus Pelanggan", "👤")) {
            fetch(API_URL + 'delete_customer', {
                method: 'POST',
                body: JSON.stringify({id})
            })
            .then(res => res.json())
            .then(data => {
                if(data.status === "success") {
                    showToast("Pelanggan dihapus!");
                    fetchDataFromServer();
                }
            });
        }
    };
 
    // DEBT PAYMENT LOGIC
    const paymentDateNow = document.getElementById("payment-date-now");
    const paymentDateInput = document.getElementById("payment-date");
 
    function syncPaymentDate() {
        if(paymentDateNow.checked) {
            paymentDateInput.value = getLocalDateTimeStr();
            paymentDateInput.disabled = true;
            paymentDateInput.style.opacity = "0.5";
        } else {
            paymentDateInput.disabled = false;
            paymentDateInput.style.opacity = "1";
        }
    }
    if(paymentDateNow) paymentDateNow.addEventListener("change", syncPaymentDate);
 
    window.openPaymentModal = function(id, name, debt) {
        document.getElementById("payment-customer-id").value = id;
        document.getElementById("payment-current-debt").innerText = formatRp(debt);
        document.getElementById("payment-amount").value = "";
        document.getElementById("payment-notes").value = "";
        
        paymentDateNow.checked = true;
        syncPaymentDate();
        
        paymentModal.style.display = "flex";
    };
 
    document.getElementById("btn-close-payment-modal").addEventListener("click", () => paymentModal.style.display = "none");
 
    document.getElementById("btn-save-payment").addEventListener("click", () => {
        const customer_id = document.getElementById("payment-customer-id").value;
        const amount = document.getElementById("payment-amount").value;
        const method = document.getElementById("payment-method").value;
        const notes = document.getElementById("payment-notes").value;
        const payment_date = paymentDateInput.value;
 
        if(!amount || amount <= 0) return showToast("Jumlah bayar tidak valid!", "error");
 
        fetch(API_URL + 'process_debt_payment', {
            method: 'POST',
            body: JSON.stringify({customer_id, amount, method, notes, user_id: currentUser.id, payment_date})
        })
        .then(res => res.json())
        .then(data => {
            if(data.status === "success") {
                showToast("Pembayaran berhasil dicatat!");
                if(paymentModal) paymentModal.style.display = "none";
                fetchDataFromServer();
            }
        });
    });
 
    window.showCustomerHistory = function(id, name) {
        document.getElementById("customer-history-name").innerText = name;
        const tbody = document.getElementById("table-customer-history");
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Memuat riwayat pembayaran...</td></tr>';
        document.getElementById("customer-history-modal").style.display = "flex";
 
        fetch(API_URL + 'get_customer_payment_history&id=' + id)
        .then(res => res.json())
        .then(data => {
            if(data.status === "success" && data.history) {
                tbody.innerHTML = "";
                if(data.history.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Belum ada riwayat pembayaran.</td></tr>';
                    return;
                }
                data.history.forEach(h => {
                    const tr = document.createElement("tr");
                    tr.innerHTML = `
                        <td><small>${h.payment_date}</small></td>
                        <td>${h.petugas || 'System'}</td>
                        <td style="color:var(--text-muted);">${formatRp(h.debt_before)}</td>
                        <td style="color:var(--success); font-weight:bold;">${formatRp(h.amount)}</td>
                        <td style="color:var(--accent); font-weight:bold;">${formatRp(h.debt_after)}</td>
                        <td><small>${h.notes || '-'}</small></td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--danger);">Gagal memuat data.</td></tr>';
            }
        });
    }
 
    window.deleteTransaction = async function(id) {
        if(await customConfirm("HAPUS TRANSAKSI INI?\n\nPeringatan: Menghapus transaksi akan otomatis mengembalikan stok & mengurangi hutang pelanggan (jika ada).", "Hapus Transaksi", "🗑️")) {
            fetch(API_URL + 'delete_transaction', {
                method: 'POST',
                body: JSON.stringify({id})
            })
            .then(res => res.json())
            .then(data => {
                if(data.status === "success") {
                    showToast("Transaksi dihapus dan stok telah dikembalikan!");
                    fetchDataFromServer();
                } else {
                    showToast("Gagal: " + data.message, "error");
                }
            });
        }
    };
 
    // EDIT TRANSACTION LOGIC
    const editTxModal = document.getElementById("edit-tx-modal");
    
    window.openEditTxModal = function(id) {
        const tx = currentTransactions.find(t => t.id == id);
        if(!tx) return;
 
        document.getElementById("edit-tx-id").value = tx.id;
        document.getElementById("edit-tx-product-name").innerText = tx.product_name;
        document.getElementById("edit-tx-unit-text").innerText = `Satuan: ${tx.unit.toUpperCase()} ${tx.unit==='sak' ? '@'+tx.kg_per_sak+'kg' : ''}`;
        document.getElementById("edit-tx-qty").value = tx.qty;
        document.getElementById("edit-tx-payment").value = tx.payment_type;
 
        editTxModal.style.display = "flex";
    };
 
    document.getElementById("btn-close-edit-tx").addEventListener("click", () => editTxModal.style.display = "none");
 
    document.getElementById("btn-save-edit-tx").addEventListener("click", () => {
        const id = document.getElementById("edit-tx-id").value;
        const qty = document.getElementById("edit-tx-qty").value;
        const payment_type = document.getElementById("edit-tx-payment").value;
 
        if(!qty || qty <= 0) return showToast("Jumlah tidak valid", "error");
 
        fetch(API_URL + 'update_transaction', {
            method: 'POST',
            body: JSON.stringify({id, qty, payment_type})
        })
        .then(res => res.json())
        .then(data => {
            if(data.status === "success") {
                showToast("Transaksi berhasil diperbarui!");
                editTxModal.style.display = "none";
                fetchDataFromServer();
            } else {
                showToast("Gagal: " + data.message, "error");
            }
        });
        });
    });

    // ====================================================
    // DISCOUNT PAGE LOGIC
    // ====================================================
    const discountMemberInput = document.getElementById("discount-member");
    const discountUmumInput = document.getElementById("discount-umum");

    function loadDiscountPage() {
        if(discountMemberInput) discountMemberInput.value = discountSettings.discount_member || 0;
        if(discountUmumInput) discountUmumInput.value = discountSettings.discount_umum || 0;
        updateDiscountPreview();
    }

    function updateDiscountPreview() {
        const samplePrice = 100000;
        const memberPct = parseFloat(discountMemberInput?.value || 0);
        const umumPct = parseFloat(discountUmumInput?.value || 0);
        const memberSave = samplePrice * (memberPct / 100);
        const umumSave = samplePrice * (umumPct / 100);

        const memberPreview = document.getElementById("discount-member-preview");
        if(memberPreview) {
            memberPreview.innerHTML = `<small style="color:var(--text-muted);">Preview: Beli ${formatRp(samplePrice)}</small>
                <div style="font-size:1.2em; font-weight:700; color:var(--accent); margin-top:5px;">Bayar: ${formatRp(samplePrice - memberSave)} <span style="font-size:0.7em; color:var(--success);">(hemat ${formatRp(memberSave)})</span></div>`;
        }
        const umumPreview = document.getElementById("discount-umum-preview");
        if(umumPreview) {
            umumPreview.innerHTML = `<small style="color:var(--text-muted);">Preview: Beli ${formatRp(samplePrice)}</small>
                <div style="font-size:1.2em; font-weight:700; color:#f59e0b; margin-top:5px;">Bayar: ${formatRp(samplePrice - umumSave)} <span style="font-size:0.7em; color:var(--success);">(hemat ${formatRp(umumSave)})</span></div>`;
        }
    }

    if(discountMemberInput) discountMemberInput.addEventListener("input", updateDiscountPreview);
    if(discountUmumInput) discountUmumInput.addEventListener("input", updateDiscountPreview);

    const btnSaveDiscount = document.getElementById("btn-save-discount");
    if(btnSaveDiscount) {
        btnSaveDiscount.addEventListener("click", () => {
            const member = parseFloat(discountMemberInput.value) || 0;
            const umum = parseFloat(discountUmumInput.value) || 0;
            if(member < 0 || member > 100 || umum < 0 || umum > 100) return showToast("Diskon harus antara 0% - 100%!", "error");

            fetch(API_URL + 'save_discount_settings', {
                method: 'POST',
                body: JSON.stringify({ discount_member: member, discount_umum: umum })
            }).then(res => res.json()).then(data => {
                if(data.status === 'success') {
                    discountSettings.discount_member = member;
                    discountSettings.discount_umum = umum;
                    showToast("Pengaturan diskon berhasil disimpan!");
                    const status = document.getElementById("discount-save-status");
                    if(status) { status.innerText = "✅ Tersimpan " + new Date().toLocaleTimeString('id-ID'); setTimeout(() => status.innerText = "", 5000); }
                } else { showToast("Gagal: " + data.message, "error"); }
            });
        });
    }

    function updatePosDiscountDisplay() { /* placeholder, renderCart handles it */ }

    // Listen to customer select change to recalc discount in cart
    const posCustomerSelect2 = document.getElementById("pos-customer-select");
    if(posCustomerSelect2) posCustomerSelect2.addEventListener("change", () => renderCart());
});
