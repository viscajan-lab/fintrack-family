import type { TxRow } from "@/lib/data/queries"
import { formatIDR } from "@/lib/utils"

/** Format tanggal ID untuk baris ekspor → "07 Jul 2026" */
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
  })
}

/** Nama file dengan timestamp → "transaksi-fintrack-2026-07-07.csv" */
function fileStamp(ext: string): string {
  const d = new Date()
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  return `transaksi-fintrack-${stamp}.${ext}`
}

/** Escape satu field CSV (RFC 4180: bungkus quote bila ada koma/quote/newline). */
function csvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Export daftar transaksi ke CSV dan trigger download di browser.
 * Kolom: Tanggal, Deskripsi, Kategori, Tipe, Jumlah (rupiah bertanda).
 */
export function exportTransactionsCSV(rows: TxRow[]): void {
  const header = ["Tanggal", "Deskripsi", "Kategori", "Tipe", "Jumlah"]

  const lines = rows.map((tx) => {
    const signed = (tx.type === "income" ? "" : "-") + tx.amount
    return [
      fmtDate(tx.date),
      tx.description,
      tx.category_name ?? "Tanpa Kategori",
      tx.type === "income" ? "Pemasukan" : "Pengeluaran",
      signed,
    ].map((c) => csvField(String(c))).join(",")
  })

  // BOM (\uFEFF) supaya Excel membaca UTF-8 dengan benar (rupiah, aksara ID).
  const csv = "\uFEFF" + [header.map(csvField).join(","), ...lines].join("\r\n")

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  triggerDownload(blob, fileStamp("csv"))
}

/** Buat <a download> sementara lalu klik untuk memulai unduhan. */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Export ke PDF via jendela print browser (zero-dependency).
 * Membuka HTML terformat rapi lalu memanggil window.print(); user pilih
 * "Save as PDF". Menghindari menambah library berat seperti jsPDF.
 */
export function exportTransactionsPDF(rows: TxRow[]): void {
  const totalIncome  = rows.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0)
  const totalExpense = rows.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0)
  const net = totalIncome - totalExpense
  const printedAt = new Date().toLocaleString("id-ID", {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  })

  const bodyRows = rows.map((tx) => `
    <tr>
      <td>${escapeHtml(fmtDate(tx.date))}</td>
      <td>${escapeHtml(tx.description)}</td>
      <td>${escapeHtml(tx.category_name ?? "Tanpa Kategori")}</td>
      <td>${tx.type === "income" ? "Pemasukan" : "Pengeluaran"}</td>
      <td class="num ${tx.type}">${tx.type === "income" ? "+" : "−"}${escapeHtml(formatIDR(tx.amount))}</td>
    </tr>`).join("")

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>Laporan Transaksi FinTrack</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1a1a1a; margin: 32px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { font-size: 12px; color: #666; margin-bottom: 20px; }
  .summary { display: flex; gap: 16px; margin-bottom: 20px; }
  .card { flex: 1; border: 1px solid #e5e5e5; border-radius: 8px; padding: 12px 16px; }
  .card .label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: .04em; }
  .card .value { font-size: 16px; font-weight: 700; margin-top: 2px; }
  .income { color: #16a34a; }
  .expense { color: #dc2626; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead th { text-align: left; border-bottom: 2px solid #333; padding: 8px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; }
  tbody td { padding: 7px 10px; border-bottom: 1px solid #eee; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
  tfoot td { padding: 10px; font-weight: 700; border-top: 2px solid #333; }
  .footer { margin-top: 24px; font-size: 10px; color: #999; text-align: center; }
  @media print { body { margin: 0; } @page { margin: 16mm; } }
</style>
</head>
<body>
  <h1>Laporan Transaksi — FinTrack Family</h1>
  <div class="meta">Dicetak: ${escapeHtml(printedAt)} · ${rows.length} transaksi</div>
  <div class="summary">
    <div class="card"><div class="label">Pemasukan</div><div class="value income">${escapeHtml(formatIDR(totalIncome))}</div></div>
    <div class="card"><div class="label">Pengeluaran</div><div class="value expense">${escapeHtml(formatIDR(totalExpense))}</div></div>
    <div class="card"><div class="label">Saldo Bersih</div><div class="value ${net >= 0 ? "income" : "expense"}">${net >= 0 ? "" : "−"}${escapeHtml(formatIDR(Math.abs(net)))}</div></div>
  </div>
  <table>
    <thead>
      <tr><th>Tanggal</th><th>Deskripsi</th><th>Kategori</th><th>Tipe</th><th style="text-align:right">Jumlah</th></tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <div class="footer">Dihasilkan oleh FinTrack Family · fintrack-family.vercel.app</div>
</body>
</html>`

  const win = window.open("", "_blank", "width=900,height=700")
  if (!win) {
    alert("Popup diblokir. Izinkan popup untuk mengekspor PDF.")
    return
  }
  win.document.write(html)
  win.document.close()
  // Tunggu render lalu buka dialog print.
  win.onload = () => {
    win.focus()
    win.print()
  }
}

/** Escape teks agar aman disisipkan ke HTML print. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
