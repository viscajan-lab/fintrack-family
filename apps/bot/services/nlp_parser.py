"""
NLP Parser — parse input natural language ke transaksi terstruktur
Tier 1: Regex (cepat, gratis)
Tier 2: Groq LLM — teks (llama-3.3-70b) & vision nota (llama-4-scout), fallback input ambigu
"""
import re
import json
import base64
import logging
from os import getenv
from typing import Optional

# Daftar kategori valid — dipakai regex, LLM teks, & vision nota.
VALID_CATEGORIES = [
    "Makanan & Minuman", "Transportasi", "Rumah & Tagihan", "Belanja",
    "Kesehatan", "Pendidikan", "Hiburan", "Gaji", "Usaha / Freelance",
    "Transfer Masuk", "Lainnya",
]

# ── Groq (OpenAI-compatible) — teks & vision ─────────────────────────────────
GROQ_BASE_URL   = "https://api.groq.com/openai/v1"
GROQ_TEXT_MODEL   = "llama-3.3-70b-versatile"
GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"


def _groq_client():
    """AsyncOpenAI yang menunjuk ke Groq. None kalau GROQ_API_KEY kosong."""
    api_key = getenv("GROQ_API_KEY")
    if not api_key:
        return None
    from openai import AsyncOpenAI
    return AsyncOpenAI(api_key=api_key, base_url=GROQ_BASE_URL)


def _strip_json_fence(raw: str) -> str:
    """Buang fence markdown ```json ... ``` kalau model membungkusnya."""
    return re.sub(r"^```(?:json)?|```$", "", raw.strip()).strip()

log = logging.getLogger(__name__)

# ── Mapping nominal: rb/k/jt ─────────────────────────────────────────────────
MULTIPLIERS = {
    "jt":  1_000_000,
    "juta": 1_000_000,
    "rb":  1_000,
    "ribu": 1_000,
    "k":   1_000,
}

# ── Keyword klasifikasi tipe transaksi ────────────────────────────────────────
INCOME_KEYWORDS = {
    "gaji", "salary", "upah", "bonus", "thr", "transfer masuk",
    "terima", "dapat", "pemasukan", "income", "bayaran", "freelance",
    "honor", "komisi", "dividen", "investasi", "refund", "kembalian",
}
EXPENSE_KEYWORDS = {
    "beli", "bayar", "bayar", "belanja", "makan", "minum", "bensin",
    "parkir", "tol", "ojek", "grab", "gojek", "listrik", "air", "wifi",
    "internet", "pulsa", "cicilan", "kredit", "tagihan", "sewa", "kontrakan",
    "kos", "nongkrong", "jajan", "beli", "langganan", "berlangganan",
}

# ── Mapping kata → kategori ───────────────────────────────────────────────────
CATEGORY_MAP = [
    ({"makan", "minum", "restoran", "warung", "cafe", "kopi", "lunch",
      "dinner", "breakfast", "sarapan", "siang", "malam", "jajan", "snack",
      "bakso", "mie", "nasi", "ayam", "pizza", "burger"}, "Makanan & Minuman"),
    ({"bensin", "bbm", "solar", "pertamax", "grab", "gojek", "ojek",
      "taksi", "taxi", "tol", "parkir", "bus", "kereta", "commuter",
      "transjakarta", "angkot", "motor", "mobil"}, "Transportasi"),
    ({"listrik", "pln", "air", "pdam", "wifi", "internet", "indihome",
      "biznet", "telkom", "gas", "iuran", "sewa", "kontrakan", "kos",
      "rumah", "cicilan", "kpr"}, "Rumah & Tagihan"),
    ({"belanja", "supermarket", "indomaret", "alfamart", "tokopedia",
      "shopee", "lazada", "baju", "pakaian", "sepatu", "tas", "elektronik"}, "Belanja"),
    ({"obat", "dokter", "rumah sakit", "rs", "apotek", "klinik",
      "kesehatan", "bpjs", "vitamin", "suplemen"}, "Kesehatan"),
    ({"sekolah", "kuliah", "les", "kursus", "buku", "spp", "uang sekolah",
      "pendidikan", "edukasi"}, "Pendidikan"),
    ({"hiburan", "nonton", "bioskop", "netflix", "spotify", "game",
      "playstation", "steam", "konser", "liburan", "wisata", "hotel"}, "Hiburan"),
    ({"gaji", "salary", "upah", "thr", "bonus"}, "Gaji"),
    ({"freelance", "proyek", "project", "honor", "komisi", "usaha",
      "jualan", "bisnis"}, "Usaha / Freelance"),
    ({"transfer", "kirim", "terima"}, "Transfer Masuk"),
]


def _parse_amount(raw: str) -> Optional[int]:
    """Konversi string nominal ke integer rupiah"""
    raw = raw.lower().replace(",", ".").replace(" ", "")

    # Cari multiplier (jt, rb, k, dll)
    for suffix, mult in MULTIPLIERS.items():
        if raw.endswith(suffix):
            num_str = raw[: -len(suffix)]
            try:
                return int(float(num_str) * mult)
            except ValueError:
                return None

    # Hapus titik sebagai pemisah ribuan, lalu parse
    cleaned = raw.replace(".", "")
    try:
        val = int(cleaned)
        return val if val > 0 else None
    except ValueError:
        return None


def _detect_type(text_lower: str) -> str:
    """Deteksi income/expense dari keyword"""
    for kw in INCOME_KEYWORDS:
        if kw in text_lower:
            return "income"
    return "expense"  # default expense


def _detect_category(text_lower: str) -> str:
    for keywords, category in CATEGORY_MAP:
        for kw in keywords:
            if kw in text_lower:
                return category
    return "Lainnya"


def _regex_parse(text: str) -> Optional[dict]:
    """
    Tier 1: parse dengan regex.
    Pola: <deskripsi> <nominal> atau <nominal> <deskripsi>
    """
    text_lower = text.lower().strip()

    # Pola nominal: angka + opsional suffix (rb/jt/k) atau angka dengan titik/koma
    amount_pattern = r"(\d[\d.,]*(?:rb|ribu|jt|juta|k)?)"

    # Coba pola: teks angka (misal "Makan siang 35000")
    m = re.search(amount_pattern, text_lower)
    if not m:
        return None

    amount = _parse_amount(m.group(1))
    if not amount or amount < 100:  # minimal Rp 100
        return None

    # Deskripsi = teks tanpa nominal
    description = re.sub(amount_pattern, "", text).strip().strip("-").strip()
    if not description:
        description = text.strip()

    tx_type  = _detect_type(text_lower)
    category = _detect_category(text_lower)

    return {
        "type":          tx_type,
        "amount":        amount,
        "description":   description or text,
        "category_name": category,
        "source":        "bot",
    }


async def _llm_parse(text: str) -> Optional[dict]:
    """
    Tier 2: fallback ke Groq LLM untuk input ambigu.
    Hanya dipanggil jika regex gagal.
    """
    client = _groq_client()
    if not client:
        return None

    try:
        prompt = f"""Kamu adalah parser transaksi keuangan. 
Extract informasi dari teks berikut dan kembalikan JSON saja (tanpa markdown).

Teks: "{text}"

Format JSON:
{{
  "type": "income" atau "expense",
  "amount": integer dalam rupiah,
  "description": string deskripsi singkat,
  "category_name": salah satu dari {VALID_CATEGORIES}
}}

Aturan:
- "50rb" = 50000, "8jt" = 8000000, "8.5jt" = 8500000
- Jika tidak bisa diparsing, kembalikan null"""

        resp = await client.chat.completions.create(
            model=GROQ_TEXT_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200,
            temperature=0,
        )

        raw = _strip_json_fence(resp.choices[0].message.content or "")
        if raw.lower() == "null" or not raw:
            return None

        data = json.loads(raw)
        data["source"] = "bot"
        return data

    except Exception as e:
        log.warning(f"Groq text parse failed: {e}")
        return None


async def parse_transaction(text: str) -> Optional[dict]:
    """
    Entry point parser. Tier 1 regex → Tier 2 Groq LLM fallback.
    Returns dict dengan keys: type, amount, description, category_name, source
    """
    result = _regex_parse(text)
    if result:
        log.debug(f"Parsed via regex: {result}")
        return result

    log.debug(f"Regex failed, trying Groq for: {text!r}")
    result = await _llm_parse(text)
    if result:
        log.debug(f"Parsed via Groq: {result}")
    return result


async def parse_receipt_image(image_bytes: bytes) -> Optional[dict]:
    """
    Baca foto nota/struk belanja pakai Groq vision (llama-4-scout).
    Returns dict {type, amount, description, category_name, source} — sama
    persis skema parse_transaction, biar reuse alur konfirmasi di handler.
    None kalau tak ada API key, bukan nota, atau gagal parse.
    """
    client = _groq_client()
    if not client:
        return None

    try:
        b64 = base64.b64encode(image_bytes).decode()
        prompt = f"""Kamu adalah pembaca nota/struk belanja Indonesia.
Baca gambar dan kembalikan JSON saja (tanpa markdown):
{{
  "type": "expense",
  "amount": integer TOTAL akhir yang dibayar dalam rupiah (grand total, bukan subtotal/item),
  "description": string nama toko/merchant singkat (mis. "Indomaret", "Warung Padang"),
  "category_name": salah satu dari {VALID_CATEGORIES}
}}
Aturan:
- Ambil angka TOTAL/GRAND TOTAL, abaikan diskon per-item & subtotal.
- Kalau gambar bukan nota/struk atau total tak terbaca, kembalikan null."""

        resp = await client.chat.completions.create(
            model=GROQ_VISION_MODEL,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url",
                     "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
                ],
            }],
            max_tokens=200,
            temperature=0,
        )

        raw = _strip_json_fence(resp.choices[0].message.content or "")
        if raw.lower() == "null" or not raw:
            return None

        data = json.loads(raw)
        if not isinstance(data.get("amount"), int) or data["amount"] < 100:
            return None
        if data.get("category_name") not in VALID_CATEGORIES:
            data["category_name"] = "Lainnya"
        data["type"]   = "expense"
        data["source"] = "bot"
        return data

    except Exception as e:
        log.warning(f"Groq vision parse failed: {e}")
        return None
