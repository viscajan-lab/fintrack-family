# 🏗️ Architecture Document
# FinTrack Family

**Versi:** 1.0  
**Tanggal:** Juli 2025  

---

## 1. Gambaran Umum Arsitektur

FinTrack Family menggunakan arsitektur **3-tier** dengan separation yang jelas antara:
- **Input layer:** Telegram Bot
- **Data layer:** Supabase (PostgreSQL)
- **Presentation layer:** Next.js Web Dashboard

```
┌─────────────────────────────────────────────────────────┐
│                     USER                                 │
│                                                          │
│   📱 Telegram App          🌐 Browser                   │
└────────┬──────────────────────────┬─────────────────────┘
         │                          │
         ▼                          ▼
┌─────────────────┐      ┌──────────────────────┐
│  Telegram Bot   │      │   Next.js Web App     │
│  (Railway /     │      │   (Vercel)            │
│   Render)       │      │                       │
│                 │      │  - App Router         │
│  - aiogram 3    │      │  - Server Components  │
│  - NLP Parser   │      │  - Supabase Client    │
│  - OCR Handler  │      │  - Recharts / SVG     │
└────────┬────────┘      └──────────┬────────────┘
         │                          │
         └──────────┬───────────────┘
                    │
                    ▼
         ┌──────────────────┐
         │    Supabase      │
         │                  │
         │  - PostgreSQL    │
         │  - Auth          │
         │  - Row Level     │
         │    Security      │
         │  - Realtime      │
         │  - Storage       │
         └──────────────────┘
```

---

## 2. Komponen Utama

### 2.1 Telegram Bot

**Hosting:** Railway atau Render (persistent server)  
**Mengapa bukan serverless?** Bot butuh koneksi persistent untuk polling/webhook. Serverless (Vercel Functions) tidak cocok untuk long-running connection.

**Teknologi:** Python + aiogram 3.x

```
apps/bot/
├── main.py              # Entry point, init bot & dispatcher
├── handlers/
│   ├── start.py         # /start — registrasi & onboarding
│   ├── transaction.py   # Input natural language
│   ├── recap.py         # /rekap command
│   ├── budget.py        # /budget command
│   └── photo.py         # OCR foto struk
├── services/
│   ├── nlp_parser.py    # Parse "Makan siang 35rb" → structured data
│   ├── supabase_svc.py  # CRUD operations ke Supabase
│   └── ocr_svc.py       # Extract text dari foto
├── models/
│   └── transaction.py   # Data models / Pydantic schemas
└── requirements.txt
```

**Flow input transaksi:**

```
User kirim "Bensin 50rb"
        │
        ▼
[NLP Parser]
  - Detect tipe: expense
  - Extract amount: 50000
  - Detect kategori: Transportasi
  - Confidence score: 0.95
        │
        ▼
[Validation]
  - Amount valid?
  - User terdaftar?
  - Tenant aktif?
        │
        ▼
[Supabase Insert]
  INSERT INTO transactions (...)
        │
        ▼
[Bot Reply]
  "✅ Pengeluaran dicatat!
   ⛽ Bensin Motor — Rp 50.000"
```

### 2.2 Web Dashboard (Next.js)

**Hosting:** Vercel  
**Framework:** Next.js 14+ dengan App Router

```
apps/web/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx        # Magic link login
│   │   └── callback/page.tsx     # Auth callback
│   ├── (dashboard)/
│   │   ├── layout.tsx            # Sidebar layout
│   │   ├── page.tsx              # Dashboard utama
│   │   ├── transactions/page.tsx # List transaksi
│   │   ├── reports/page.tsx      # Laporan
│   │   ├── budget/page.tsx       # Manajemen budget
│   │   └── settings/page.tsx     # Pengaturan
│   ├── api/
│   │   ├── transactions/route.ts # REST API (opsional)
│   │   └── export/route.ts       # PDF/Excel export
│   └── layout.tsx                # Root layout
├── components/
│   ├── ui/                       # Base components (Button, Card, etc)
│   ├── charts/                   # Chart components (Recharts)
│   ├── transactions/             # Transaction-specific components
│   └── layout/                   # Sidebar, Navbar, etc
└── lib/
    ├── supabase/
    │   ├── client.ts             # Browser client
    │   └── server.ts             # Server client (RSC)
    └── utils.ts                  # Format currency, dates, etc
```

### 2.3 Database (Supabase / PostgreSQL)

**Multi-tenant strategy:** Semua data dalam 1 database, terisolasi via `tenant_id` + Row Level Security.

---

## 3. Database Schema

### 3.1 Entity Relationship Diagram (Teks)

```
tenants (1) ──── (N) tenant_members
tenants (1) ──── (N) transactions
tenants (1) ──── (N) budgets
tenants (1) ──── (N) categories (custom)
users   (1) ──── (N) transactions (sebagai recorder)
users   (1) ──── (N) tenant_members
```

### 3.2 Tabel Utama

```sql
-- Tenant = 1 workspace keluarga
CREATE TABLE tenants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,               -- "Keluarga Ardi"
  slug        TEXT UNIQUE NOT NULL,        -- "keluarga-ardi"
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- User bisa punya banyak tenant (misal gabung 2 keluarga)
CREATE TABLE tenant_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT DEFAULT 'member',       -- 'admin' | 'member'
  display_name TEXT,                       -- nama di dalam keluarga
  telegram_id BIGINT UNIQUE,              -- untuk link bot ↔ dashboard
  joined_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

-- Semua transaksi
CREATE TABLE transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  recorded_by   UUID REFERENCES auth.users(id),
  type          TEXT NOT NULL,             -- 'income' | 'expense'
  amount        BIGINT NOT NULL,           -- dalam rupiah (integer, bukan float)
  description   TEXT NOT NULL,            -- "Makan siang"
  category      TEXT NOT NULL,            -- 'makanan' | 'transportasi' | ...
  source        TEXT DEFAULT 'bot',       -- 'bot' | 'web' | 'import'
  notes         TEXT,
  transaction_date DATE DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Budget per kategori per bulan
CREATE TABLE budgets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  category    TEXT NOT NULL,
  amount      BIGINT NOT NULL,
  month       INT NOT NULL,               -- 1-12
  year        INT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, category, month, year)
);
```

### 3.3 Row Level Security (RLS)

```sql
-- Aktifkan RLS di semua tabel
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;

-- Policy: user hanya bisa akses data tenant-nya sendiri
CREATE POLICY "tenant_isolation" ON transactions
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = auth.uid()
    )
  );

-- Sama untuk budgets
CREATE POLICY "tenant_isolation" ON budgets
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = auth.uid()
    )
  );
```

---

## 4. Autentikasi & Multi-tenant Flow

### 4.1 Registrasi via Bot

```
1. User: /start di Telegram
2. Bot: "Nama keluargamu?"
3. User: "Keluarga Ardi"
4. Bot: Buat tenant "keluarga-ardi" di Supabase
5. Bot: Buat tenant_member dengan telegram_id user
6. Bot: Kirim link → https://fintrack.app/join?token=xxx
7. User klik link → masuk web, set email → magic link
8. Magic link klik → auth.users terbuat → link ke tenant_member
```

### 4.2 Login Web (Returning User)

```
1. User buka fintrack.app
2. Masukkan email → klik "Kirim Magic Link"
3. Cek email → klik link
4. Redirect ke dashboard dengan session aktif
5. Middleware Next.js validasi session via Supabase
```

### 4.3 Multi-tenant Middleware

```typescript
// middleware.ts
export async function middleware(req: NextRequest) {
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) return redirect('/login')

  // Inject tenant context ke setiap request
  const { data: membership } = await supabase
    .from('tenant_members')
    .select('tenant_id, role')
    .eq('user_id', session.user.id)
    .single()

  // Set tenant di header untuk server components
  req.headers.set('x-tenant-id', membership.tenant_id)
}
```

---

## 5. NLP Parser (Bot)

Bot menggunakan strategi **regex-first, LLM-fallback**:

```python
# Langkah 1: Regex parsing (cepat, gratis)
patterns = [
    r'(?P<desc>.+?)\s+(?P<amount>\d[\d.,]*)\s*(?P<unit>rb|ribu|jt|juta|k)?',
    r'bayar\s+(?P<desc>.+?)\s+(?P<amount>\d[\d.,]*)',
    r'terima\s+(?P<desc>.+?)\s+(?P<amount>\d[\d.,]*)',
]

# Langkah 2: Normalisasi amount
# "50rb" → 50000
# "1.5jt" → 1500000
# "35.000" → 35000

# Langkah 3: Kategori detection (keyword matching)
category_keywords = {
    'makanan': ['makan', 'minum', 'kopi', 'warteg', 'resto', 'snack'],
    'transportasi': ['bensin', 'grab', 'gojek', 'parkir', 'tol', 'krl'],
    'tagihan': ['listrik', 'air', 'gas', 'wifi', 'internet', 'pulsa'],
    # ...
}

# Langkah 4: LLM fallback (jika confidence < 0.7)
# Kirim ke OpenAI GPT-4o-mini dengan prompt terstruktur
# Lebih mahal tapi akurasi lebih tinggi untuk edge cases
```

---

## 6. Deployment Architecture

```
┌──────────────────────────────────────────────────┐
│                  PRODUCTION                       │
│                                                   │
│  Vercel (Web)          Railway (Bot)              │
│  ┌─────────────┐      ┌─────────────────────┐    │
│  │ Next.js App │      │ Python Bot (24/7)   │    │
│  │ - SSR/SSG   │      │ - Webhook mode      │    │
│  │ - API Routes│      │ - Auto-restart      │    │
│  │ - Edge CDN  │      │ - Log monitoring    │    │
│  └─────────────┘      └─────────────────────┘    │
│         │                      │                  │
│         └──────────┬───────────┘                  │
│                    │                              │
│         ┌──────────▼───────────┐                  │
│         │      Supabase        │                  │
│         │  - PostgreSQL (DB)   │                  │
│         │  - Auth (JWT)        │                  │
│         │  - Storage (foto)    │                  │
│         │  - Realtime (ws)     │                  │
│         └──────────────────────┘                  │
└──────────────────────────────────────────────────┘

GitHub Actions (CI/CD)
  - Push ke main → auto deploy ke Vercel
  - Push ke main → auto deploy bot ke Railway
  - Run tests sebelum deploy
```

---

## 7. Environment Variables

| Variable | Service | Deskripsi |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Web | URL Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Web | Anon key (safe untuk client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Bot | Service key (hanya server!) |
| `TELEGRAM_BOT_TOKEN` | Bot | Token dari @BotFather |
| `OPENAI_API_KEY` | Bot | Untuk NLP fallback |
| `WEBHOOK_URL` | Bot | URL public bot untuk webhook |

---

## 8. Security Considerations

| Risiko | Mitigasi |
|---|---|
| Data tenant bocor ke tenant lain | RLS Supabase — semua query otomatis difilter |
| Bot dipakai orang luar | Setiap user harus terdaftar di `tenant_members` |
| Service role key exposed | Hanya ada di environment variable server, tidak pernah ke client |
| SQL Injection | Supabase client menggunakan parameterized queries |
| Spam bot | Rate limiting per telegram_id |

---

*Last updated: Juli 2025*
