"""
Scheduler — background task harian untuk aturan transaksi berulang (recurring_rules).

Desain (KISS, zero-dependency):
  - Loop asyncio: tidur sampai RUN_HOUR tiap hari, lalu proses rule jatuh tempo.
  - Mode 'auto'     : langsung catat transaksi + notif ke pembuat.
  - Mode 'reminder' : kirim pesan + tombol [Catat sekarang / Nanti].
  - Anti-dobel      : mark_recurring_run(last_run_date) + filter di get_due_recurring.
  - Bulan pendek    : rule tgl 29/30/31 yang tidak ada di bulan ini → jalan di hari
                      terakhir bulan (mis. tgl 31 pada Februari → 28/29 Feb).
"""
import asyncio
import logging
from calendar import monthrange
from datetime import date, datetime, timedelta

from aiogram import Bot
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

from services.supabase_service import SupabaseService

log = logging.getLogger(__name__)

RUN_HOUR = 8   # jam lokal server (UTC di Railway) untuk proses harian


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


async def _reminder_kb(rule_id: str) -> InlineKeyboardMarkup:
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


async def _process_due(bot: Bot, db: SupabaseService, today: date) -> int:
    """Proses semua rule jatuh tempo hari ini. Return jumlah rule tersentuh."""
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
                            f"🤖 *Tagihan otomatis dicatat*\n\n"
                            f"*{rule['description']}*\n"
                            f"{format_idr(rule['amount'])} • {rule['category_name']}\n\n"
                            f"Cek: /rekap_bulan",
                            parse_mode="Markdown",
                        )
                else:  # reminder — jangan mark_run dulu, tunggu konfirmasi user
                    if chat_id:
                        await bot.send_message(
                            chat_id,
                            f"🔔 *Pengingat tagihan*\n\n"
                            f"*{rule['description']}*\n"
                            f"{format_idr(rule['amount'])} • {rule['category_name']}\n"
                            f"Jatuh tempo hari ini. Catat sekarang?",
                            parse_mode="Markdown",
                            reply_markup=await _reminder_kb(rule["id"]),
                        )
                    # Tandai sudah dikirim remindernya (anti spam harian)
                    await db.mark_recurring_run(rule["id"], today)
            except Exception as e:
                log.error("Gagal proses rule %s: %s", rule.get("id"), e)
    return touched


async def _seconds_until_next_run(now: datetime) -> float:
    target = now.replace(hour=RUN_HOUR, minute=0, second=0, microsecond=0)
    if now >= target:
        target += timedelta(days=1)
    return (target - now).total_seconds()


async def recurring_scheduler(bot: Bot, db: SupabaseService) -> None:
    """Task latar: bangun tiap hari jam RUN_HOUR, proses rule jatuh tempo."""
    log.info("⏰ Recurring scheduler aktif (jam %02d:00 harian).", RUN_HOUR)
    while True:
        try:
            delay = await _seconds_until_next_run(datetime.now())
            log.info("Scheduler tidur %.0f detik sampai run berikutnya.", delay)
            await asyncio.sleep(delay)
            today = date.today()
            n = await _process_due(bot, db, today)
            log.info("Scheduler run %s: %d rule diproses.", today, n)
        except asyncio.CancelledError:
            log.info("Scheduler dihentikan.")
            raise
        except Exception as e:
            log.error("Scheduler error, retry 1 jam: %s", e)
            await asyncio.sleep(3600)
