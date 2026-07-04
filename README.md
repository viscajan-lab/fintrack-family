# 💰 FinTrack Family

> **Pencatat keuangan keluarga berbasis Telegram + Web Dashboard**
> Input via chat, rekap di dashboard — sesimpel itu.

![Status](https://img.shields.io/badge/status-in%20development-yellow)
![Stack](https://img.shields.io/badge/stack-Next.js%20%7C%20Supabase%20%7C%20Telegram-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 🎯 Apa Itu FinTrack Family?

FinTrack Family adalah aplikasi pencatatan keuangan **multi-user** yang dirancang untuk keluarga Indonesia. Pengguna cukup mengirim pesan ke bot Telegram — misalnya `"Makan siang 35000"` atau `"Bensin 50rb"` — dan sistem langsung mencatatnya secara otomatis ke database.

Semua data bisa dilihat dan dianalisis melalui **web dashboard** yang modern, dengan grafik, rekap bulanan, dan breakdown per kategori.

---

## ✨ Fitur Utama

| Fitur | Deskripsi |
|---|---|
| 🤖 **Telegram Bot** | Input pemasukan/pengeluaran via chat natural language |
| 📊 **Web Dashboard** | Visualisasi data keuangan: grafik, kategori, tren |
| 👨‍👩‍👧 **Multi-user** | Satu workspace untuk seluruh anggota keluarga |
| 🏢 **Multi-tenant** | Bisa dipakai banyak keluarga berbeda (SaaS-ready) |
| 📷 **OCR Nota** | Kirim foto struk, bot extract otomatis |
| 📅 **Export** | Laporan PDF/Excel langsung dari Telegram |
| 🌙 **Dark Mode** | UI mendukung light & dark mode |
| 🔒 **Aman** | Row Level Security (RLS) Supabase — data tiap keluarga terisolasi |

---

## 🗂️ Struktur Proyek

```
fintrack-family/
├── apps/
│   ├── web/                  # Next.js frontend (Vercel)
│   │   ├── app/              # App Router
│   │   ├── components/       # UI components
│   │   └── lib/              # Supabase client, utils
│   └── bot/                  # Telegram bot (Railway/Render)
│       ├── handlers/         # Command & message handlers
│       ├── services/         # NLP parser, Supabase service
│       └── main.py           # Entry point
├── supabase/
│   ├── migrations/           # Database migrations
│   └── schema.sql            # Full schema
├── docs/
│   ├── ARCHITECTURE.md
│   ├── PRD.md
│   └── TECH_STACK.md
├── design/
│   └── index.html            # Design system preview
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- Supabase account
- Telegram Bot Token (dari @BotFather)

### 1. Clone & Install

```bash
git clone https://github.com/username/fintrack-family.git
cd fintrack-family

# Install web dependencies
cd apps/web && npm install

# Install bot dependencies
cd ../bot && pip install -r requirements.txt
```

### 2. Setup Environment Variables

```bash
# apps/web/.env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# apps/bot/.env
TELEGRAM_BOT_TOKEN=your_bot_token
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_key  # untuk NLP parsing
```

### 3. Setup Database

```bash
# Push schema ke Supabase
cd supabase
supabase db push
```

### 4. Jalankan Lokal

```bash
# Web (terminal 1)
cd apps/web && npm run dev

# Bot (terminal 2)
cd apps/bot && python main.py
```

Web jalan di `http://localhost:3000`

---

## 🤖 Cara Pakai Bot

Cari bot di Telegram: `@FinTrackFamilyBot` → `/start`

### Input Natural Language

```
Makan siang 35000         → Pengeluaran Rp 35.000 (Makanan)
Bensin 50rb               → Pengeluaran Rp 50.000 (Transportasi)
Gaji Juli 8500000         → Pemasukan Rp 8.500.000
Listrik bulan ini 350rb   → Pengeluaran Rp 350.000 (Tagihan)
```

### Perintah Bot

| Perintah | Fungsi |
|---|---|
| `/start` | Registrasi & setup workspace |
| `/rekap` | Rekap hari ini |
| `/rekap bulan` | Rekap bulan berjalan |
| `/budget` | Cek sisa budget per kategori |
| `/export pdf` | Export laporan PDF |
| `/anggota` | Lihat/tambah anggota keluarga |
| `/help` | Daftar perintah lengkap |

---

## 🔗 Link Penting

| | Link |
|---|---|
| 🌐 **Web App** | https://fintrack-family.vercel.app |
| 🤖 **Telegram Bot** | @FinTrackFamilyBot |
| 📊 **Supabase Dashboard** | https://app.supabase.com |
| 🎨 **Design System** | `/design/index.html` |

---

## 🛣️ Roadmap

- [x] Design System v1.0
- [ ] Database schema & migrations
- [ ] Telegram bot — input natural language
- [ ] Web dashboard — halaman utama
- [ ] Autentikasi (Supabase Auth)
- [ ] Multi-tenant support
- [ ] OCR foto struk
- [ ] Export PDF/Excel
- [ ] Notifikasi budget overrun
- [ ] Mobile-responsive dashboard

---

## 📄 Lisensi

MIT License — bebas digunakan dan dimodifikasi.

---

*Dibuat dengan ❤️ untuk keluarga Indonesia*
