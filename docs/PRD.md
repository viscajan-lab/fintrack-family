# 📋 Product Requirements Document (PRD)
# FinTrack Family

**Versi:** 1.0  
**Tanggal:** Juli 2025  
**Status:** Draft  
**Author:** Ardi  

---

## 1. Overview

### 1.1 Ringkasan Produk

FinTrack Family adalah aplikasi pencatatan keuangan keluarga berbasis **Telegram Bot + Web Dashboard**. Produk ini menyelesaikan masalah nyata: kebanyakan orang malas mencatat keuangan karena ribetnya membuka aplikasi terpisah. Dengan FinTrack, cukup kirim pesan di Telegram seperti biasa — sistem yang bekerja di belakangnya.

### 1.2 Problem Statement

| Masalah | Dampak |
|---|---|
| Mencatat keuangan manual di spreadsheet = lambat & tidak konsisten | Keluarga tidak punya gambaran keuangan yang jelas |
| Aplikasi keuangan existing (Money Lover, dll) = perlu buka app, banyak klik | Tingkat penggunaan rendah setelah 1-2 minggu |
| Tidak ada tool yang support multi-user dalam 1 keluarga dengan mudah | Hanya 1 orang yang catat, data tidak lengkap |
| Anggota keluarga punya akses berbeda (anak vs orang tua) | Tidak ada role management yang simple |

### 1.3 Solusi

Buat pencatatan semudah chat. Kirim pesan ke bot Telegram → langsung tercatat → lihat rekap di web dashboard kapan saja.

---

## 2. Target Pengguna

### 2.1 Primary User: Kepala Keluarga

- **Siapa:** Pria/wanita 25-45 tahun, sudah berkeluarga
- **Pain point:** Ingin tahu kondisi keuangan keluarga tapi malas buka-buka aplikasi
- **Kebutuhan:** Bisa lihat semua pengeluaran keluarga di satu tempat
- **Tech savviness:** Pakai Telegram setiap hari, familiar dengan smartphone

### 2.2 Secondary User: Anggota Keluarga

- **Siapa:** Pasangan, anak remaja/dewasa yang ikut mencatat
- **Pain point:** Tidak tahu caranya dan males install app baru
- **Kebutuhan:** Cara input yang semudah chat biasa
- **Behavior:** Lebih sering pakai mobile daripada desktop

### 2.3 Tertiary User: SaaS Buyer (B2B)

- **Siapa:** Developer/entrepreneur yang mau deploy ke keluarga/komunitas sendiri
- **Kebutuhan:** Source code yang bisa di-self-host atau white-label

---

## 3. Goals & Success Metrics

### 3.1 Business Goals

| Goal | Metric | Target (3 bulan) |
|---|---|---|
| Pengguna aktif | MAU (Monthly Active Users) | 100 keluarga |
| Retensi | 30-day retention rate | >60% |
| Monetisasi | MRR (Monthly Recurring Revenue) | Rp 5.000.000 |
| Kepuasan | Rating / NPS | >4.5/5 |

### 3.2 Product Goals

- Onboarding < 2 menit (dari /start sampai transaksi pertama dicatat)
- Latency parsing input < 3 detik
- Uptime bot > 99.5%
- Dashboard load time < 2 detik

---

## 4. Fitur & Requirements

### 4.1 Telegram Bot

#### F-01: Registrasi & Onboarding
- **Deskripsi:** User ketik `/start` → bot tanya nama keluarga → buat workspace → kirim link dashboard
- **Priority:** P0 (must have)
- **Acceptance Criteria:**
  - User bisa daftar tanpa perlu buka website sama sekali
  - Workspace terbuat otomatis di Supabase
  - Link dashboard dikirim via bot setelah registrasi

#### F-02: Input Natural Language
- **Deskripsi:** User kirim pesan bebas, bot parse dan simpan ke database
- **Priority:** P0 (must have)
- **Contoh input yang harus bisa diparsing:**
  ```
  "Makan siang 35000"           → expense, 35000, kategori: Makanan
  "Bensin 50rb"                 → expense, 50000, kategori: Transportasi
  "Gaji Juli 8.500.000"         → income, 8500000, kategori: Gaji
  "Bayar listrik 350 ribu"      → expense, 350000, kategori: Tagihan
  "Terima uang dari mama 200k"  → income, 200000, kategori: Transfer
  ```
- **Acceptance Criteria:**
  - Akurasi parsing > 90% untuk format umum
  - Bot reply dengan konfirmasi dalam 3 detik
  - User bisa koreksi jika kategori salah via inline button

#### F-03: Perintah Rekap
- **Deskripsi:** User bisa minta rekap via command
- **Priority:** P0 (must have)
- **Commands:**
  - `/rekap` → rekap hari ini
  - `/rekap bulan` → rekap bulan berjalan
  - `/rekap [bulan] [tahun]` → rekap periode spesifik

#### F-04: Manajemen Budget
- **Deskripsi:** Set budget per kategori, dapat notifikasi jika hampir habis
- **Priority:** P1 (should have)
- **Acceptance Criteria:**
  - Bisa set budget via bot: `/budget makanan 1500000`
  - Notifikasi otomatis ketika pengeluaran mencapai 80% budget
  - `/budget` tampilkan status semua kategori

#### F-05: OCR Foto Struk
- **Deskripsi:** Kirim foto nota/struk, bot extract total dan item
- **Priority:** P2 (nice to have)
- **Tech:** Google Vision API atau Tesseract

#### F-06: Multi-anggota Keluarga
- **Deskripsi:** Bisa tambah anggota ke workspace yang sama
- **Priority:** P1 (should have)
- **Acceptance Criteria:**
  - Admin bisa generate link invite
  - Setiap transaksi ada label "siapa yang catat"
  - Dashboard bisa filter by anggota

### 4.2 Web Dashboard

#### F-07: Halaman Dashboard Utama
- **Deskripsi:** Overview keuangan bulan berjalan
- **Priority:** P0 (must have)
- **Konten:**
  - Total saldo, total pemasukan, total pengeluaran bulan ini
  - Grafik pemasukan vs pengeluaran (bar chart 6 bulan)
  - Breakdown pengeluaran per kategori (donut chart)
  - Tren tabungan (line chart)
  - Daftar transaksi terbaru (10 item)

#### F-08: Halaman Transaksi
- **Deskripsi:** List semua transaksi dengan filter & search
- **Priority:** P0 (must have)
- **Filter:** Periode, Kategori, Anggota, Tipe (in/out)

#### F-09: Halaman Laporan
- **Deskripsi:** Analisis mendalam per periode
- **Priority:** P1 (should have)

#### F-10: Halaman Budget
- **Deskripsi:** Kelola budget per kategori
- **Priority:** P1 (should have)

#### F-11: Autentikasi
- **Deskripsi:** Login via magic link email (Supabase Auth)
- **Priority:** P0 (must have)
- **Note:** Tidak perlu password — user klik link di email

---

## 5. Kategori Transaksi Default

| Emoji | Kategori | Contoh |
|---|---|---|
| 🍽 | Makanan & Minuman | Makan siang, kopi, belanja dapur |
| ⛽ | Transportasi | Bensin, parkir, grab, KRL |
| 🏠 | Rumah | Sewa, listrik, air, gas, internet |
| 🛒 | Belanja | Pakaian, elektronik, kebutuhan rumah |
| 💊 | Kesehatan | Obat, dokter, vitamin |
| 🎓 | Pendidikan | SPP, buku, kursus |
| 🎮 | Hiburan | Netflix, bioskop, game |
| 💼 | Gaji | Gaji bulanan, bonus |
| 💰 | Usaha | Pendapatan bisnis |
| 📲 | Transfer | Transfer antar anggota |
| 🎁 | Lainnya | Tidak termasuk kategori di atas |

---

## 6. Model Bisnis

### 6.1 Opsi Monetisasi

| Model | Deskripsi | Harga |
|---|---|---|
| **Freemium** | Gratis sampai 2 anggota, 100 transaksi/bulan | Rp 0 |
| **Family Plan** | Unlimited anggota & transaksi | Rp 29.000/bulan |
| **Self-hosted License** | Source code + deploy support | Rp 499.000 one-time |

### 6.2 Fase Peluncuran

| Fase | Waktu | Target |
|---|---|---|
| **Alpha** | Bulan 1-2 | Internal testing, 5 keluarga beta |
| **Beta** | Bulan 3-4 | 50 keluarga, collect feedback |
| **Launch** | Bulan 5 | Public launch, mulai monetisasi |

---

## 7. Non-functional Requirements

| Requirement | Target |
|---|---|
| **Performance** | Dashboard load < 2 detik |
| **Availability** | Bot uptime > 99.5% |
| **Security** | Data per tenant terisolasi via RLS |
| **Scalability** | Support hingga 10.000 tenant |
| **Mobile** | Dashboard fully responsive |
| **Bahasa** | Semua UI dalam Bahasa Indonesia |

---

## 8. Out of Scope (v1.0)

- Integrasi bank/e-wallet otomatis (akan dipertimbangkan v2.0)
- Aplikasi mobile native (iOS/Android)
- AI financial advisor
- Laporan pajak

---

*Dokumen ini adalah living document dan akan diupdate seiring development.*
