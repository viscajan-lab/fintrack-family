"use client"

import { useState, useTransition } from "react"
import { Plus, X, Loader2, Pencil, Trash2, Lock, Tag } from "lucide-react"
import { cn } from "@/lib/utils"
import { addCategory, updateCategory, deleteCategory } from "@/app/dashboard/actions"
import type { Category } from "@/lib/data/queries"

const TYPE_LABEL: Record<Category["type"], string> = {
  income:  "Pemasukan",
  expense: "Pengeluaran",
  both:    "Keduanya",
}

const TYPE_BADGE: Record<Category["type"], string> = {
  income:  "bg-[var(--color-income)]/15 text-[var(--color-income)]",
  expense: "bg-[var(--color-expense)]/15 text-[var(--color-expense)]",
  both:    "bg-[var(--color-brand-500)]/15 text-[var(--color-brand-500)]",
}

// ─── Form modal (dipakai untuk tambah & edit) ────────────────────────────────

function CategoryForm({
  initial,
  onClose,
}: {
  initial: Category | null   // null = mode tambah
  onClose: () => void
}) {
  const isEdit = initial !== null
  const [error, setError]  = useState<string | null>(null)
  const [isPending, start] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    start(async () => {
      const res = isEdit
        ? await updateCategory(initial!.id, fd)
        : await addCategory(fd)
      if (res?.error) { setError(res.error); return }
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-[var(--color-background)] rounded-2xl border border-[var(--color-border)] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <h2 className="font-semibold">{isEdit ? "Ubah Kategori" : "Kategori Baru"}</h2>
          <button onClick={onClose} className="text-[var(--color-muted)] hover:text-[var(--color-foreground)]">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="flex gap-3">
            <div className="w-20 shrink-0">
              <label className="block text-xs font-medium text-[var(--color-muted)] mb-1">Emoji</label>
              <input
                name="emoji" maxLength={4} defaultValue={initial?.emoji ?? ""}
                placeholder="🍔"
                className="w-full px-3 py-2 text-center text-lg rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-[var(--color-muted)] mb-1">Nama Kategori</label>
              <input
                name="name" required maxLength={40} autoFocus defaultValue={initial?.name ?? ""}
                placeholder="Contoh: Sekolah Anak"
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-muted)] mb-1">Berlaku Untuk</label>
            <select
              name="type" defaultValue={initial?.type ?? "expense"}
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]"
            >
              <option value="expense">Pengeluaran</option>
              <option value="income">Pemasukan</option>
              <option value="both">Keduanya</option>
            </select>
          </div>

          {error && (
            <p className="text-xs text-[var(--color-expense)] bg-[var(--color-expense)]/10 rounded-lg px-3 py-2">
              ⚠️ {error}
            </p>
          )}

          <button
            type="submit" disabled={isPending}
            className="w-full py-2.5 rounded-lg bg-[var(--color-brand-500)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isPending
              ? <><Loader2 size={15} className="animate-spin" /> Menyimpan...</>
              : isEdit ? "Simpan Perubahan" : "Buat Kategori"}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Row per kategori ────────────────────────────────────────────────────────

function CategoryRow({ cat, onEdit }: { cat: Category; onEdit: (c: Category) => void }) {
  const [isDeleting, startDelete] = useTransition()

  function handleDelete() {
    if (!confirm(`Hapus kategori "${cat.name}"? Transaksi lama tetap tersimpan dengan nama kategori ini.`)) return
    startDelete(async () => { await deleteCategory(cat.id) })
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] last:border-b-0">
      <div className="w-9 h-9 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-base shrink-0">
        {cat.emoji || <Tag size={15} className="text-[var(--color-muted)]" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm truncate">{cat.name}</p>
        <span className={cn("inline-block mt-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium", TYPE_BADGE[cat.type])}>
          {TYPE_LABEL[cat.type]}
        </span>
      </div>

      {cat.isDefault ? (
        <span className="flex items-center gap-1 text-[10px] text-[var(--color-muted)] shrink-0">
          <Lock size={11} /> Bawaan
        </span>
      ) : (
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onEdit(cat)}
            className="p-1.5 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-brand-500)] hover:bg-[var(--color-brand-500)]/10 transition-colors"
            aria-label="Ubah kategori"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-1.5 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-expense)] hover:bg-[var(--color-expense)]/10 transition-colors disabled:opacity-50"
            aria-label="Hapus kategori"
          >
            {isDeleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Manager utama ───────────────────────────────────────────────────────────

export function CategoryManager({ categories }: { categories: Category[] }) {
  const [modal, setModal] = useState<null | { mode: "add" } | { mode: "edit"; cat: Category }>(null)

  const custom   = categories.filter((c) => !c.isDefault)
  const defaults = categories.filter((c) =>  c.isDefault)

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kategori</h1>
          <p className="text-sm text-[var(--color-muted)] mt-0.5">
            Kelola kategori transaksi keluarga 🏷️
          </p>
        </div>
        <button
          onClick={() => setModal({ mode: "add" })}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-brand-500)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={16} /> Kategori Baru
        </button>
      </div>

      {/* Custom */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wide">
          Kategori Keluarga
        </h2>
        <div className="rounded-xl bg-[var(--color-background)] border border-[var(--color-border)] overflow-hidden">
          {custom.length === 0 ? (
            <div className="py-10 text-center text-sm text-[var(--color-muted)]">
              Belum ada kategori custom 🏷️<br />
              <span className="text-xs">Klik &ldquo;Kategori Baru&rdquo; untuk menambah sesuai kebutuhan keluarga.</span>
            </div>
          ) : (
            custom.map((c) => <CategoryRow key={c.id} cat={c} onEdit={(cat) => setModal({ mode: "edit", cat })} />)
          )}
        </div>
      </div>

      {/* Default */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wide">
          Kategori Bawaan
        </h2>
        <div className="rounded-xl bg-[var(--color-background)] border border-[var(--color-border)] overflow-hidden">
          {defaults.map((c) => <CategoryRow key={c.id} cat={c} onEdit={() => {}} />)}
        </div>
      </div>

      {modal?.mode === "add"  && <CategoryForm initial={null}      onClose={() => setModal(null)} />}
      {modal?.mode === "edit" && <CategoryForm initial={modal.cat} onClose={() => setModal(null)} />}
    </>
  )
}
