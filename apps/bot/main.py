"""
FinTrack Family — Telegram Bot
Entry point: setup aiogram, register handlers, start polling
"""
import asyncio
import logging
from os import getenv

from aiogram import Bot, Dispatcher
from aiogram.fsm.storage.memory import MemoryStorage
from dotenv import load_dotenv

from handlers.start import router as start_router
from handlers.transaction import router as transaction_router
from handlers.recap import router as recap_router
from handlers.budget import router as budget_router
from handlers.savings import router as savings_router
from handlers.recurring import router as recurring_router
from handlers.insight import router as insight_router
from handlers.anggota import router as anggota_router
from handlers.reminder import router as reminder_router
from handlers.link import router as link_router

from services.supabase_service import SupabaseService
from services.scheduler import recurring_scheduler

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)


async def main() -> None:
    token = getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        raise ValueError("TELEGRAM_BOT_TOKEN tidak ditemukan di .env")

    bot = Bot(token=token)
    dp  = Dispatcher(storage=MemoryStorage())

    # Register semua router
    # recurring_router didaftar SEBELUM transaction_router: handler /recurring,
    # /add_recurring, dan FSM AddRecurring harus diprioritaskan di atas catch-all
    # handle_text_input milik transaction_router.
    dp.include_router(start_router)
    dp.include_router(recurring_router)
    dp.include_router(savings_router)
    dp.include_router(transaction_router)
    dp.include_router(recap_router)
    dp.include_router(budget_router)
    dp.include_router(insight_router)
    dp.include_router(anggota_router)
    dp.include_router(reminder_router)
    dp.include_router(link_router)

    # Set bot commands (menu burger di Telegram)
    from aiogram.types import BotCommand
    await bot.set_my_commands([
        BotCommand(command="start",        description="Mulai / kembali ke menu utama"),
        BotCommand(command="rekap",        description="Rekap transaksi hari ini"),
        BotCommand(command="rekap_bulan",  description="Rekap bulan ini"),
        BotCommand(command="budget",       description="Cek sisa budget kategori"),
        BotCommand(command="set_budget",   description="Set / ubah budget kategori"),
        BotCommand(command="tabungan",     description="Lihat target tabungan & progres"),
        BotCommand(command="nabung",       description="Setor ke target tabungan"),
        BotCommand(command="target_baru",  description="Buat target tabungan baru"),
        BotCommand(command="insight",      description="Analitik: bulan ini vs bulan lalu"),
        BotCommand(command="recurring",    description="Daftar tagihan & langganan berulang"),
        BotCommand(command="add_recurring", description="Tambah tagihan berulang"),
        BotCommand(command="anggota",      description="Kelola anggota keluarga"),
        BotCommand(command="reminder",     description="Atur pengingat harian catat pengeluaran"),
        BotCommand(command="hubungkan",     description="Sambungkan akun web ⇄ bot"),
        BotCommand(command="help",         description="Panduan penggunaan bot"),
    ])

    log.info("🤖 FinTrack Bot starting...")
    await bot.delete_webhook(drop_pending_updates=True)

    # Scheduler recurring — background task, jalan seiring polling.
    scheduler_task = asyncio.create_task(recurring_scheduler(bot, SupabaseService()))
    try:
        await dp.start_polling(bot)
    finally:
        scheduler_task.cancel()


if __name__ == "__main__":
    asyncio.run(main())
