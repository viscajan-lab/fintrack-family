# 🤖 FinTrack Bot

Telegram bot untuk pencatatan keuangan keluarga — input natural language, rekap harian/bulanan, cek budget.

## Setup Lokal

```bash
cd apps/bot
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # isi token & keys
python main.py
```

## Environment Variables

| Variable | Keterangan |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Token dari @BotFather |
| `SUPABASE_URL` | URL project Supabase |
| `SUPABASE_SERVICE_KEY` | Service role key Supabase |
| `OPENAI_API_KEY` | (Opsional) GPT-4o-mini fallback parser |

## Deploy ke Railway

1. Buat project baru di [Railway](https://railway.app)
2. Connect repo GitHub ini
3. Set **Root Directory** → `apps/bot`
4. Tambahkan environment variables di dashboard
5. Railway otomatis detect `Procfile` → deploy!

## Cara Pakai Bot

Kirim pesan natural ke bot:

```
Makan siang 35000
Bensin 50rb
Gaji Juli 8.5jt
Belanja supermarket 250rb
```

**Perintah:**
- `/start` — Setup workspace keluarga
- `/rekap` — Rekap hari ini
- `/rekap_bulan` — Rekap bulan ini  
- `/budget` — Cek sisa budget per kategori
- `/help` — Bantuan

## Struktur Folder

```
apps/bot/
├── main.py                  # Entry point
├── requirements.txt
├── Procfile                 # Railway deploy
├── runtime.txt              # Python 3.11
├── .env.example
├── handlers/
│   ├── start.py             # /start, /help, setup workspace
│   ├── transaction.py       # Input transaksi natural language
│   ├── recap.py             # /rekap, /rekap_bulan
│   └── budget.py            # /budget
└── services/
    ├── nlp_parser.py        # Regex parser + OpenAI fallback
    └── supabase_service.py  # Semua operasi database
```
