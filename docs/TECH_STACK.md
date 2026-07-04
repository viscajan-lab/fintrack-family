# 🛠️ Tech Stack
# FinTrack Family

---

## Ringkasan Cepat

| Layer | Teknologi | Alasan |
|---|---|---|
| **Frontend** | Next.js 14 + TypeScript | SSR, App Router, ekosistem React terbaik |
| **Styling** | Tailwind CSS | Utility-first, rapid development |
| **Bot** | Python + aiogram 3 | Async, library Telegram paling mature |
| **Database** | Supabase (PostgreSQL) | Auth + RLS + Realtime in one |
| **Hosting Web** | Vercel | Zero-config Next.js deployment |
| **Hosting Bot** | Railway | Persistent server, mudah deploy Python |
| **Source Control** | GitHub | Industry standard |
| **CI/CD** | GitHub Actions | Native integration dengan GitHub |

---

## 1. Frontend — Next.js 14

**Versi:** Next.js 14.x  
**Language:** TypeScript  
**Mengapa Next.js?**
- App Router — layout yang reusable dan clean
- Server Components — data fetch langsung di server, lebih cepat
- Built-in optimization: image, font, metadata
- Native deployment di Vercel (zero config)
- Ekosistem terbesar untuk React

### Dependencies Utama

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "typescript": "^5.0.0",
    "@supabase/supabase-js": "^2.0.0",
    "@supabase/ssr": "^0.5.0",
    "recharts": "^2.0.0",
    "date-fns": "^3.0.0",
    "lucide-react": "^0.400.0",
    "clsx": "^2.0.0"
  },
  "devDependencies": {
    "tailwindcss": "^3.4.0",
    "eslint": "^8.0.0",
    "@types/react": "^18.0.0"
  }
}
```

### Struktur Folder Next.js

```
apps/web/
├── app/                    # App Router (Next.js 14)
│   ├── (auth)/            # Route group — no layout
│   └── (dashboard)/       # Route group — dengan sidebar layout
├── components/
│   ├── ui/                # Atomic components
│   └── charts/            # Chart wrappers
└── lib/
    └── supabase/          # Supabase clients
```

---

## 2. Styling — Tailwind CSS

**Versi:** 3.4.x  
**Mengapa Tailwind?**
- Tidak perlu buat CSS file terpisah
- Konsisten dengan design token
- Ukuran bundle kecil (purge otomatis)
- Mudah implement dark mode (`dark:` variant)

**Design Tokens (custom):**

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#f0fdf9',
          500: '#14b8a6',  // Teal utama
          600: '#0d9488',
        },
        income:  '#22c55e',  // Hijau
        expense: '#f43f5e',  // Merah coral
        savings: '#3b82f6',  // Biru
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    }
  },
  darkMode: 'class',
}
```

---

## 3. Charts — Recharts

**Versi:** 2.x  
**Mengapa Recharts?**
- Built for React (bukan wrapper jQuery)
- Customizable via JSX
- SVG-based = tajam di semua resolusi
- Responsive out of the box

**Charts yang dipakai:**

| Chart | Dipakai Untuk |
|---|---|
| `BarChart` | Pemasukan vs pengeluaran per bulan |
| `PieChart` / `RadialBarChart` | Breakdown per kategori |
| `LineChart` | Tren tabungan |
| `AreaChart` | Overview saldo harian |

---

## 4. Database — Supabase

**Tier:** Free (dev) → Pro ($25/bulan, produksi)  
**Underlying DB:** PostgreSQL 15  

**Mengapa Supabase?**
- PostgreSQL tapi dengan developer experience yang jauh lebih enak
- Auth sudah built-in (magic link, OAuth)
- Row Level Security (RLS) — solusi multi-tenant yang proven
- Realtime subscriptions — dashboard update otomatis
- Storage untuk foto struk
- Dashboard yang bagus untuk manage data

**Fitur Supabase yang dipakai:**

| Fitur | Dipakai Untuk |
|---|---|
| **PostgreSQL** | Semua data transaksi, user, tenant |
| **Auth** | Magic link login untuk web dashboard |
| **Row Level Security** | Isolasi data per tenant |
| **Realtime** | Update dashboard real-time saat ada transaksi baru |
| **Storage** | Simpan foto struk yang diupload via bot |
| **Edge Functions** | (Opsional) Webhook handler |

---

## 5. Telegram Bot — Python + aiogram

**Python:** 3.11+  
**Framework:** aiogram 3.x  
**Mengapa Python?**
- Library Telegram terlengkap (aiogram, python-telegram-bot)
- Ekosistem AI/NLP terbaik (OpenAI, HuggingFace)
- OCR library tersedia (pytesseract, Google Vision)

**Mengapa aiogram 3?**
- Fully async (asyncio) — performa tinggi
- FSM (Finite State Machine) built-in — untuk conversation flow
- Middleware support
- Aktif dikembangkan

### Dependencies Bot

```
# requirements.txt
aiogram==3.10.0
supabase==2.7.0
openai==1.40.0
python-dotenv==1.0.0
pydantic==2.8.0
pillow==10.0.0           # Image processing
pytesseract==0.3.10      # OCR (opsional)
aiohttp==3.9.0
```

---

## 6. NLP Parser

**Strategi:** Regex-first → LLM fallback

### Tier 1: Regex (< 50ms, gratis)
Untuk pola yang umum dan jelas:
- `"Makan siang 35000"` → expense, 35000
- `"Bensin 50rb"` → expense, 50000
- `"Gaji 8.5jt"` → income, 8500000

### Tier 2: OpenAI GPT-4o-mini (< 2s, ~$0.0001/request)
Fallback untuk input yang ambigu:
- Kalimat panjang / tidak terstruktur
- Transaksi dengan konteks khusus
- Bahasa campur (Indonesia + Jawa, dll)

**Estimasi biaya NLP:** ~Rp 15/transaksi (sangat murah)

---

## 7. Hosting

### Web: Vercel

| Aspek | Detail |
|---|---|
| **Tier** | Hobby (gratis) → Pro ($20/bulan) |
| **Deploy** | Auto-deploy dari GitHub push |
| **Domain** | Custom domain support |
| **Performance** | Edge CDN global |
| **Fungsi** | Next.js API Routes |

### Bot: Railway

| Aspek | Detail |
|---|---|
| **Tier** | Starter ($5/bulan) |
| **Deploy** | Auto-deploy dari GitHub push |
| **Uptime** | 24/7 persistent |
| **Restart** | Auto-restart jika crash |
| **Logs** | Built-in log monitoring |

**Mengapa Railway, bukan Render?**
- Railway lebih cepat cold start
- Deploy experience lebih smooth
- Harga kompetitif
- (Render juga bisa sebagai alternatif)

---

## 8. CI/CD — GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Vercel
        run: npx vercel --prod --token=${{ secrets.VERCEL_TOKEN }}

  deploy-bot:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Railway
        run: railway up --service=fintrack-bot
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

---

## 9. Estimasi Biaya Bulanan (Produksi)

| Service | Tier | Biaya/bulan |
|---|---|---|
| Vercel | Pro | $20 (~Rp 320rb) |
| Railway | Starter | $5 (~Rp 80rb) |
| Supabase | Pro | $25 (~Rp 400rb) |
| OpenAI (NLP) | Pay per use | ~$2 (~Rp 32rb) |
| Domain | Tahunan | ~Rp 15rb/bulan |
| **Total** | | **~Rp 847rb/bulan** |

> 💡 Untuk fase development/MVP, semua bisa gratis:
> - Vercel Hobby (gratis)
> - Railway Trial ($5 credit)  
> - Supabase Free (500MB, 50.000 MAU)
> - OpenAI ($5 free credit)

---

## 10. Dev Tools

| Tool | Fungsi |
|---|---|
| **VS Code** | Editor utama |
| **Supabase CLI** | Manage migrations lokal |
| **ngrok** | Expose localhost untuk bot webhook testing |
| **Postman / Bruno** | Test API endpoints |
| **ESLint + Prettier** | Code formatting |
| **Husky** | Pre-commit hooks |

---

*Last updated: Juli 2025*
