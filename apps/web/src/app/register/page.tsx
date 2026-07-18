import { redirect } from "next/navigation"

// Pendaftaran mandiri DIMATIKAN (model SaaS managed).
// Akun hanya dibuat oleh super_admin (untuk admin/kepala keluarga) atau oleh
// admin (untuk member keluarganya) lewat undangan email. Halaman ini tidak lagi
// dapat diakses — siapa pun yang membuka /register langsung dilempar ke /login.
export default function RegisterPage() {
  redirect("/login")
}
