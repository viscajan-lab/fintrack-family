"""
Waktu — helper timezone terpusat untuk seluruh bot.

Railway (dan kebanyakan server) berjalan di UTC. Semua logika waktu yang
berhubungan dengan user (jam reminder, jadwal recurring, sapaan, tanggal
"hari ini" menurut user) HARUS memakai WIB (Asia/Jakarta, UTC+7) — bukan
jam server.

KISS: satu tempat, satu sumber kebenaran. Jangan pernah pakai
`datetime.now()` naive untuk logika waktu user; pakai `now_wib()` di sini.
"""
from datetime import date, datetime
from zoneinfo import ZoneInfo

WIB = ZoneInfo("Asia/Jakarta")


def now_wib() -> datetime:
    """Waktu sekarang di zona WIB (aware datetime)."""
    return datetime.now(WIB)


def today_wib() -> date:
    """Tanggal 'hari ini' menurut user di Jakarta.

    Penting di sekitar tengah malam: pukul 00:30 WIB masih pukul 17:30 UTC
    hari sebelumnya. Memakai date.today() server akan salah hari.
    """
    return now_wib().date()


def greeting_wib() -> str:
    """Sapaan sesuai jam WIB — dipakai untuk pesan yang ramah waktu."""
    h = now_wib().hour
    if 4 <= h < 11:
        return "Selamat pagi"
    if 11 <= h < 15:
        return "Selamat siang"
    if 15 <= h < 19:
        return "Selamat sore"
    return "Selamat malam"
