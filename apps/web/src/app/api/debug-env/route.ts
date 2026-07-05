import { NextResponse } from "next/server"

// TEMPORARY debug endpoint — remove after fix
export async function GET() {
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "MISSING"
  const anon    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "MISSING"
  const svc     = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "MISSING"

  return NextResponse.json({
    url_prefix:  url.slice(0, 30),
    anon_suffix: anon.slice(-6),
    svc_suffix:  svc.slice(-6),
    anon_len:    anon.length,
    svc_len:     svc.length,
  })
}
