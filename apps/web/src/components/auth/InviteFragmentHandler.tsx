"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

// Jaring pengaman untuk link email yang mengembalikan sesi lewat URL fragment
// (implicit flow): .../login#access_token=...&refresh_token=...&type=invite
//
// Fragment (#...) tidak pernah dikirim ke server, jadi route callback server-side
// tidak bisa membacanya dan akan jatuh ke error "Link undangan tidak valid".
// Komponen client ini menangkap fragment itu di browser, membangun sesi via
// setSession(), lalu mengarahkan user ke halaman set-password (untuk invite/recovery)
// atau dashboard. Dengan begini link lama/implicit tetap berfungsi.
export function InviteFragmentHandler() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const hash = window.location.hash
    if (!hash || !hash.includes("access_token")) return

    const params = new URLSearchParams(hash.replace(/^#/, ""))
    const access_token = params.get("access_token")
    const refresh_token = params.get("refresh_token")
    const type = params.get("type")
    const errorDesc = params.get("error_description")

    if (errorDesc) {
      // Bersihkan fragment lalu tampilkan error asli dari Supabase.
      window.history.replaceState(null, "", window.location.pathname)
      router.replace(`/login?error=${encodeURIComponent(errorDesc)}`)
      return
    }

    if (!access_token || !refresh_token) return

    setBusy(true)
    const supabase = createClient()
    supabase.auth
      .setSession({ access_token, refresh_token })
      .then(({ error }) => {
        // Bersihkan token dari address bar apa pun hasilnya.
        window.history.replaceState(null, "", window.location.pathname)
        if (error) {
          router.replace(`/login?error=${encodeURIComponent(error.message)}`)
          return
        }
        // invite & recovery → user harus menyetel password dulu.
        if (type === "invite" || type === "recovery") {
          router.replace("/auth/set-password")
        } else {
          router.replace("/dashboard")
        }
      })
  }, [router])

  if (!busy) return null
  return (
    <div className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
      Memproses undangan…
    </div>
  )
}
