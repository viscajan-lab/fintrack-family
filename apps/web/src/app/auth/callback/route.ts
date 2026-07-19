import { NextResponse } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"

// Callback undangan/recovery email Supabase. Link email bisa datang dalam 2 bentuk:
//   1. PKCE       → ?code=<uuid>            → exchangeCodeForSession(code)
//   2. token_hash → ?token_hash=..&type=invite → verifyOtp({ token_hash, type })
// Setelah sesi dibuat, arahkan ke `next` (default: /auth/set-password) supaya
// user undangan langsung menyetel password. Kalau gagal → /login dgn pesan.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const tokenHash = url.searchParams.get("token_hash")
  const type = url.searchParams.get("type") as EmailOtpType | null
  const next = url.searchParams.get("next") || "/auth/set-password"

  const supabase = await createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(next, url.origin))
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin)
    )
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (!error) return NextResponse.redirect(new URL(next, url.origin))
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin)
    )
  }

  return NextResponse.redirect(
    new URL(`/login?error=${encodeURIComponent("Link undangan tidak valid atau kedaluwarsa")}`, url.origin)
  )
}
