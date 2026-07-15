"""
Scheduler — background task WIB-aware. Satu loop, dua tugas harian:

  1. Recurring rules (tagihan/langganan berulang)
       - Jatuh tempo tiap `RECURRING_HOUR` WIB pada day_of_month rule.
       - Mode 'auto'     : langsung catat transaksi + notif pembuat.
       - Mode 'reminder' : kirim pesan + tombol [Catat sekarang / Nanti].
       - Anti-dobel      : mark_recurring_run(last_run_date) + filter query.
       - Bulan pendek    : rule tgl 29/30/31 → jalan di hari terakhir bulan.

  2. Reminder harian catat pengeluaran (per user, jam fleksibel)
       - User set jam via /reminder HH:MM (disimpan WIB di tenant_members).
       - Tiap menit dicek: user yang jam remindernya == sekarang → dikirim.

Desain (KISS, zero-dependency):
  - Loop tick tiap 60 detik memakai jam WIB (Asia/Jakarta), BUKAN jam server.
    Railway berjalan di UTC; memakai jam server membuat semua jadwal meleset
    7 jam. Sumber waktu tunggal: services.waktu.now_wib().
  - Tick per menit → mendukung banyak jam reminder berbeda tanpa banyak task.
  - Anti-dobel harian pakai penanda tanggal WIB (today_wib()).
"""
import asyncio
import logging
from calendar import monthrange
from datetime import date

from aiogram import Bot
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

from services.supabase_service import SupabaseService
from services.waktu import now_wib

log = logging.getLogger(__name__)

RECURRING_HOUR = 8   # jam WIB untuk memproses recurring rules harian
BUDGET_ALERT_HOUR = 20  # jam WIB untuk push alert budget proaktif (sebelum rekap grup 21:00)
BUDGET_ALERT_THRESHOLD = 0.90  # kirim alert kalau pemakaian kategori >= 90% dari limit


def format_idr(amount: int) -> str:
    return f"Rp {amount:,.0f}".replace(",", ".")


def _due_days(today: date) -> list[int]:
    """Hari yang dianggap 'jatuh tempo' hari ini.
    Normalnya cuma [today.day], tapi kalau hari ini hari TERAKHIR bulan,
    ikutkan juga tanggal-tanggal yang 'hilang' (mis. 30/31) supaya rule
    bertanggal 31 tetap kena di bulan yang cuma 28–30 hari."""
    last_day = monthrange(today.year, today.month)[1]
    if today.day == last_day:
        return list(range(today.day, 32))  # today.day .. 31
    return [today.day]


def _reminder_kb(rule_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="✅ Catat sekarang", callback_data=f"recdue:{rule_id}"),
        InlineKeyboardButton(text="⏭ Nanti",          callback_data=f"recskip:{rule_id}"),
    ]])


async def run_rule(db: SupabaseService, rule: dict, today: date) -> None:
    """Catat transaksi dari sebuah rule (dipakai scheduler mode auto & callback 'Ya')."""
    await db.create_transaction({
        "tenant_id":        rule["tenant_id"],
        "type":             rule.get("type", "expense"),
        "amount":           rule["amount"],
        "category_name":    rule["category_name"],
        "description":      f"{rule['description']} (otomatis)",
        "transaction_date": str(today),
    })


# ── Tugas 1: recurring rules ─────────────────────────────────────────────────

async def _process_recurring(bot: Bot, db: SupabaseService, today: date) -> int:
    """Proses semua rule jatuh tempo hari ini (WIB). Return jumlah tersentuh."""
    seen: set[str] = set()
    touched = 0
    for day in _due_days(today):
        for rule in await db.get_due_recurring(day, today):
            if rule["id"] in seen:
                continue
            seen.add(rule["id"])
            touched += 1
            chat_id = rule.get("created_by")
            try:
                if rule["mode"] == "auto":
                    await run_rule(db, rule, today)
                    await db.mark_recurring_run(rule["id"], today)
                    if chat_id:
                        await bot.send_message(
                            chat_id,
                            f"🤖 <b>Tagihan otomatis dicatat</b>\n\n"
                            f"<b>{rule['description']}</b>\n"
                            f"{format_idr(rule['amount'])} • {rule['category_name']}\n\n"
                            f"Cek: /rekap_bulan",
                            parse_mode="HTML",
                        )
                else:  # reminder — kirim, lalu tandai (anti spam harian)
                    if chat_id:
                        await bot.send_message(
                            chat_id,
                            f"🔔 <b>Pengingat tagihan</b>\n\n"
                            f"<b>{rule['description']}</b>\n"
                            f"{format_idr(rule['amount'])} • {rule['category_name']}\n"
                            f"Jatuh tempo hari ini. Catat sekarang?",
                            parse_mode="HTML",
                            reply_markup=_reminder_kb(rule["id"]),
                        )
                    await db.mark_recurring_run(rule["id"], today)
            except Exception as e:
                log.error("Gagal proses rule %s: %s", rule.get("id"), e)
    return touched


# ── Tugas 2: reminder harian catat pengeluaran ───────────────────────────────

async def _process_reminders(bot: Bot, db: SupabaseService, hh: int, mm: int, today: date) -> int:
    """Kirim reminder harian ke user yang jam remindernya == hh:mm WIB.
    Anti-dobel: skip user yang reminder_last_sent == hari ini (WIB)."""
    sent = 0
    for m in await db.get_members_reminder_at(hh, mm):
        if m.get("reminder_last_sent") == str(today):
            continue
        chat_id = m.get("telegram_id")
        if not chat_id:
            continue
        try:
            await bot.send_message(
                chat_id,
                "🔔 <b>Jangan lupa catat pengeluaran hari ini!</b>\n\n"
                "Tulis langsung aja, misal:\n"
                "<code>kopi 25rb</code> atau <code>gaji 5jt</code>\n\n"
                "Lihat rekap: /rekap • Setel ulang jam: /reminder",
                parse_mode="HTML",
            )
            await db.mark_reminder_sent(chat_id, today)
            sent += 1
        except Exception as e:
            log.error("Gagal kirim reminder ke %s: %s", chat_id, e)
    return sent


# ── Tugas 3: broadcast rekap harian ke grup keluarga ─────────────────────────

async def _process_group_recap(bot: Bot, db: SupabaseService, hour: int, today: date) -> int:
    """Broadcast rekap harian ke grup tenant yang jadwalnya == `hour` WIB.
    Anti-dobel: skip tenant yang group_last_recap == hari ini (WIB)."""
    sent = 0
    for tenant in await db.get_tenants_for_group_recap(hour):
        if tenant.get("group_last_recap") == str(today):
            continue
        chat_id = tenant.get("group_chat_id")
        if not chat_id:
            continue
        try:
            summary  = await db.get_summary(tenant["id"], today, today)
            income   = summary.get("total_income", 0)
            expense  = summary.get("total_expense", 0)
            txs      = summary.get("transactions", []) or []
            net      = income - expense
            net_str  = f"+{format_idr(net)}" if net >= 0 else f"-{format_idr(abs(net))}"

            # Rincian pengeluaran per kategori (top 5)
            by_cat: dict[str, int] = {}
            for t in txs:
                if t.get("type") == "expense":
                    cat = t.get("category_name") or "Lainnya"
                    by_cat[cat] = by_cat.get(cat, 0) + t["amount"]
            top = sorted(by_cat.items(), key=lambda x: x[1], reverse=True)[:5]
            rincian = "\n".join(f"   • {c}: {format_idr(a)}" for c, a in top) if top else "   • (belum ada pengeluaran)"

            tgl = today.strftime("%d-%m-%Y")
            await bot.send_message(
                chat_id,
                f"📊 <b>Rekap Keluarga — {tgl}</b>\n\n"
                f"💰 Pemasukan  : {format_idr(income)}\n"
                f"💸 Pengeluaran: {format_idr(expense)}\n"
                f"📈 Selisih    : <b>{net_str}</b>\n"
                f"🧾 Transaksi  : {len(txs)}\n\n"
                f"<b>Pengeluaran terbesar:</b>\n{rincian}\n\n"
                f"Detail lengkap ada di dashboard web. 💙",
                parse_mode="HTML",
            )
            await db.mark_group_recap_sent(tenant["id"], today)
            sent += 1
        except Exception as e:
            log.error("Gagal broadcast rekap grup tenant %s: %s", tenant.get("id"), e)
    return sent


# ── Tugas 4: push budget proaktif (alert kategori hampir/tembus limit) ────────

async def _process_budget_alert(bot: Bot, db: SupabaseService, today: date) -> int:
    """Kirim alert budget ke tenant yang punya kategori dengan pemakaian
    >= BUDGET_ALERT_THRESHOLD (default 90%) pada bulan berjalan (WIB).

    Target kirim: semua anggota tenant yang punya telegram_id, plus grup
    keluarga bila group_chat_id terisi.
    Anti-dobel: maksimal 1x/hari/tenant (budget_alert_last_sent == hari ini).
    """
    sent = 0
    month, year = today.month, today.year
    for tenant in await db.get_tenants_for_budget_alert(today):
        # Guard tambahan (jaga-jaga bila filter DB longgar): skip yang sudah hari ini.
        if str(tenant.get("budget_alert_last_sent")) == str(today):
            continue
        tenant_id = tenant["id"]
        try:
            budgets = await db.get_budgets(tenant_id, month, year)
            if not budgets:
                await db.mark_budget_alert_sent(tenant_id, today)
                continue

            # Peta pengeluaran per kategori bulan ini
            spent_map: dict[str, int] = {
                row["category_name"]: int(row.get("total") or 0)
                for row in await db.get_expense_by_category(tenant_id, month, year)
            }

            # Kumpulkan kategori yang tembus/hampir tembus ambang
            flagged: list[tuple[str, int, int, float]] = []  # (cat, limit, spent, ratio)
            for b in budgets:
                cat   = b["category_name"]
                limit = int(b.get("amount") or 0)
                if limit <= 0:
                    continue
                spent = spent_map.get(cat, 0)
                ratio = spent / limit
                if ratio >= BUDGET_ALERT_THRESHOLD:
                    flagged.append((cat, limit, spent, ratio))

            if not flagged:
                # Tak ada yang perlu dialertkan → tetap tandai supaya tak dicek ulang tiap tick hari ini
                await db.mark_budget_alert_sent(tenant_id, today)
                continue

            # Susun pesan alert
            flagged.sort(key=lambda x: x[3], reverse=True)
            lines: list[str] = []
            for cat, limit, spent, ratio in flagged:
                icon = "🔴" if ratio >= 1.0 else "🟠"
                status = "JEBOL" if ratio >= 1.0 else f"{ratio*100:.0f}%"
                sisa = limit - spent
                sisa_str = (
                    f"sisa {format_idr(sisa)}" if sisa >= 0
                    else f"lewat {format_idr(abs(sisa))}"
                )
                lines.append(
                    f"{icon} <b>{cat}</b> — {status}\n"
                    f"   {format_idr(spent)} / {format_idr(limit)} ({sisa_str})"
                )
            body = "\n".join(lines)
            tgl = today.strftime("%d-%m-%Y")
            text = (
                f"⚠️ <b>Peringatan Budget — {tgl}</b>\n\n"
                f"Kategori berikut sudah menyentuh/melewati batas budget bulan ini:\n\n"
                f"{body}\n\n"
                f"Cek rinci: /budget • Detail lengkap di dashboard web. 💙"
            )

            # Kumpulkan chat target: anggota ber-telegram_id + grup (bila ada), tanpa dobel
            targets: list[int] = []
            for m in await db.get_tenant_members(tenant_id):
                tg = m.get("telegram_id")
                if tg:
                    targets.append(tg)
            group_chat = tenant.get("group_chat_id")
            if group_chat:
                targets.append(group_chat)
            targets = list(dict.fromkeys(targets))  # dedup, jaga urutan

            delivered = 0
            for chat_id in targets:
                try:
                    await bot.send_message(chat_id, text, parse_mode="HTML")
                    delivered += 1
                except Exception as e:
                    log.error("Gagal kirim alert budget ke %s: %s", chat_id, e)

            await db.mark_budget_alert_sent(tenant_id, today)
            if delivered:
                sent += 1
        except Exception as e:
            log.error("Gagal proses alert budget tenant %s: %s", tenant_id, e)
    return sent


# ── Loop utama: tick per menit, WIB-aware ────────────────────────────────────

async def scheduler_loop(bot: Bot, db: SupabaseService) -> None:
    """Task latar: tick tiap menit pada jam WIB, jalankan tugas jatuh tempo."""
    log.info("⏰ Scheduler WIB aktif (recurring %02d:00, reminder per-user).", RECURRING_HOUR)
    last_recurring_date: str | None = None
    last_budget_alert_date: str | None = None
    while True:
        try:
            now = now_wib()
            today = now.date()

            # Reminder harian: cek tiap menit (jam fleksibel per user)
            n = await _process_reminders(bot, db, now.hour, now.minute, today)
            if n:
                log.info("Reminder terkirim: %d user (%02d:%02d WIB).", n, now.hour, now.minute)

            # Recurring: sekali sehari saat menit 0 jam RECURRING_HOUR WIB
            if now.hour == RECURRING_HOUR and now.minute == 0 and last_recurring_date != str(today):
                touched = await _process_recurring(bot, db, today)
                last_recurring_date = str(today)
                log.info("Recurring run %s WIB: %d rule diproses.", today, touched)

            # Broadcast rekap grup: tiap menit 0, filter tenant yg group_recap_hour == jam ini
            if now.minute == 0:
                g = await _process_group_recap(bot, db, now.hour, today)
                if g:
                    log.info("Rekap grup terkirim: %d tenant (%02d:00 WIB).", g, now.hour)

            # Alert budget proaktif: sekali sehari saat menit 0 jam BUDGET_ALERT_HOUR WIB
            if now.hour == BUDGET_ALERT_HOUR and now.minute == 0 and last_budget_alert_date != str(today):
                b = await _process_budget_alert(bot, db, today)
                last_budget_alert_date = str(today)
                log.info("Alert budget %s WIB: %d tenant dinotifikasi.", today, b)

            # Tidur sampai awal menit berikutnya (drift-free)
            await asyncio.sleep(max(1, 60 - now.second))
        except asyncio.CancelledError:
            log.info("Scheduler dihentikan.")
            raise
        except Exception as e:
            log.error("Scheduler error, retry 60 dtk: %s", e)
            await asyncio.sleep(60)


# Alias kompatibilitas mundur (main.py lama memanggil recurring_scheduler)
recurring_scheduler = scheduler_loop
