"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

// Baca fragment auth (#access_token=...&type=invite) sekali saat mount. Fragment
// tidak pernah sampai ke server, jadi route callback server-side tak bisa membacanya
// dan link implicit-flow jatuh ke error "Link undangan tidak valid". Handler client
// ini menangkapnya di browser, membangun sesi via setSession(), lalu mengarahkan
// user ke set-password (invite/recovery) atau dashboard.
function readAuthFragment() {
  if (typeof window === "undefined") return null
  const hash = window.location.hash
  if (!hash || !hash.includes("access_token")) return null
  const p = new URLSearchParams(hash.replace(/^#/, ""))
  return {
    access_token: p.get("access_token"),
    refresh_token: p.get("refresh_token"),
    type: p.get("type"),
    error_description: p.get("error_description"),
  }
}

export function InviteFragmentHandler() {
  const router = useRouter()
  // Lazy init: hitung sekali saat mount, hindari setState sinkron di dalam effect.
  const [frag] = useState(readAuthFragment)

  useEffect(() => {
    if (!frag) return
    // Selalu bersihkan token dari address bar.
    window.history.replaceState(null, "", window.location.pathname)

    const { access_token, refresh_token, type, error_description } = frag
    if (error_description) {
      router.replace(`/login?error=${encodeURIComponent(error_description)}`)
      return
    }
    if (!access_token || !refresh_token) return

    createClient()
      .auth.setSession({ access_token, refresh_token })
      .then(({ error }) => {
        if (error) return router.replace(`/login?error=${encodeURIComponent(error.message)}`)
        const dest = type === "invite" || type === "recovery" ? "/auth/set-password" : "/dashboard"
        router.replace(dest)
      })
  }, [frag, router])

  if (!frag || frag.error_description) return null
  return (
    <div className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
      Memproses undangan…
    </div>
  )
}
