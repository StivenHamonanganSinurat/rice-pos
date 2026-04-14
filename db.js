// db.js
// Fungsi Pendukung Simulasi Database menggunakan LocalStorage

const DB_KEY = "RICE_POS_DATA";

// Inisialisasi Data Kosong jika belum ada
function initDB() {
    const data = localStorage.getItem(DB_KEY);
    if (!data) {
        const defaultData = {
            users: [
                { id: 1, username: "admin", password: "123", role: "superadmin" } // Pass sederhana 123 untuk tester
            ],
            products: [
                // Contoh Data Awal Beras
                { id: 1, kode: "BRS-01", nama: "Beras Rojolele Super", harga_sak: 300000, harga_kg: 13000, stok_sak: 50, stok_kg: 10 },
                { id: 2, kode: "BRS-02", nama: "Beras Pandan Wangi", harga_sak: 350000, harga_kg: 15000, stok_sak: 30, stok_kg: 5 }
            ],
            customers: [
                { id: 1, nama: "Bapak Budi", no_hp: "08123456789", hutang: 0 }
            ],
            transactions: []
        };
        localStorage.setItem(DB_KEY, JSON.stringify(defaultData));
    }
}

// Global DB Object Setup
const db = {
    read: function() {
        return JSON.parse(localStorage.getItem(DB_KEY));
    },
    save: function(data) {
        localStorage.setItem(DB_KEY, JSON.stringify(data));
    },
    
    // Auth Setters / Getters
    login: function(username, password) {
        const data = this.read();
        const user = data.users.find(u => u.username === username && u.password === password);
        if (user) {
            sessionStorage.setItem("currentUser", JSON.stringify(user));
            return user;
        }
        return null;
    },
    logout: function() {
        sessionStorage.removeItem("currentUser");
    },
    getCurrentUser: function() {
        const user = sessionStorage.getItem("currentUser");
        return user ? JSON.parse(user) : null;
    },

    // Transaction & POS Methods
    addTransaction: function(kasirId, customerId, productId, unit, qty, totalPrice, paymentType) {
        const data = this.read();
        const newTx = {
            id: Date.now(),
            date: new Date().toISOString(),
            kasirId,
            customerId,
            productId,
            unit,    // 'sak' atau 'kg'
            qty,
            totalPrice,
            paymentType // 'lunas' atau 'hutang'
        };
        
        // Pengurangan Stok
        const productIndex = data.products.findIndex(p => p.id == productId);
        if(unit === 'sak') {
            data.products[productIndex].stok_sak -= qty;
        } else {
            data.products[productIndex].stok_kg -= qty;
        }

        // Penambahan Hutang
        if(paymentType === 'hutang' && customerId) {
            const custIndex = data.customers.findIndex(c => c.id == customerId);
            if(custIndex !== -1) {
                data.customers[custIndex].hutang += totalPrice;
            }
        }

        data.transactions.push(newTx);
        this.save(data);
        return newTx;
    }
};

// Panggil saat aplikasi Load
initDB();
