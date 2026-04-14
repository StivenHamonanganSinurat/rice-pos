# 🚀 Panduan Deploy Rice POS ke InfinityFree (GRATIS)

## STEP 1: Daftar InfinityFree
1. Buka **[infinityfree.com](https://infinityfree.com)** → Klik **Sign Up**
2. Verifikasi email
3. Di **Client Area**, klik **Create Account**
4. Pilih subdomain gratis (misal: `ricepos`) atau gunakan domain sendiri
5. Klik **Create** → Tunggu sampai status **Active**

## STEP 2: Buat Database MySQL
1. Di **Control Panel InfinityFree**, cari menu **MySQL Databases**
2. Buat database baru → Catat info berikut:
   - **MySQL Host**: (contoh: `sql306.infinityfree.com`)
   - **MySQL Username**: (contoh: `if0_37854321`)
   - **MySQL Password**: (password yang Anda buat)
   - **Database Name**: (contoh: `if0_37854321_beras_pos_db`)
3. Klik **phpMyAdmin** → Login
4. Pilih database Anda → Tab **Import** → Upload file **`database_full.sql`**
5. Klik **Go** → Selesai! ✅

## STEP 3: Update Config
1. Buka file **`api/config.php`**
2. Ganti nilai berikut dengan info dari Step 2:
```php
$host     = "sql306.infinityfree.com";       // MySQL Host
$username = "if0_37854321";                  // MySQL Username  
$password = "password_anda";                 // MySQL Password
$database = "if0_37854321_beras_pos_db";     // Database Name
```

## STEP 4: Push ke GitHub
```bash
cd C:\xampp\htdocs\aplikasi-beras
git init
git add .
git commit -m "Rice POS v142 - Ready for deployment"
git branch -M main
git remote add origin https://github.com/USERNAME/rice-pos.git
git push -u origin main
```
> Ganti `USERNAME` dengan username GitHub Anda.

## STEP 5: Setup Auto-Deploy (Opsional)
Agar setiap kali push ke GitHub, file otomatis ter-upload ke InfinityFree:

1. Di GitHub → Buka repo → **Settings** → **Secrets and variables** → **Actions**
2. Tambahkan 3 secrets:
   - `FTP_HOST` → Host FTP dari InfinityFree (misal: `ftpupload.net`)
   - `FTP_USER` → Username FTP (misal: `if0_37854321`)
   - `FTP_PASS` → Password FTP
3. Selesai! Setiap kali `git push`, kode otomatis ter-upload! 🎉

## STEP 6: Upload Manual (Alternatif)
Jika tidak mau pakai auto-deploy:
1. Di **Control Panel InfinityFree**, buka **File Manager**
2. Masuk ke folder **`htdocs/`**
3. Upload semua file aplikasi ke sana
4. Akses via browser: `https://ricepos.epizy.com`

---

## ⚠️ Catatan Penting InfinityFree
- **Limit**: Request API dibatasi (~50.000/hari)
- **PHP Version**: Pastikan PHP 7.4+ aktif di Control Panel
- **SSL**: Otomatis tersedia (https)
- **Sleep Mode**: Jika tidak diakses 24 jam, situs bisa "tertidur" sebentar

## 🔐 Keamanan
- File `config.local.php` (password XAMPP lokal) **TIDAK** di-upload ke GitHub
- Password InfinityFree ada di `config.php` yang di-push ke GitHub (repository harus **Private**)
- Atau simpan via **GitHub Secrets** untuk keamanan maksimal
