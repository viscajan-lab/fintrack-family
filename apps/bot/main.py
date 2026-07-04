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
    dp.include_router(start_router)
    dp.include_router(transaction_router)
    dp.include_router(recap_router)
    dp.include_router(budget_router)

    log.info("🤖 FinTrack Bot starting...")
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
