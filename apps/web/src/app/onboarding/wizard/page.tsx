import { redirect } from "next/navigation"
import { getWizardState } from "./actions"
import { WizardClient } from "./WizardClient"

export const dynamic = "force-dynamic"

export default async function WizardPage() {
  const state = await getWizardState()

  // Belum login → arahkan ke /login (pendaftaran mandiri dimatikan; akun
  // dibuat oleh admin via undangan email).
  if (!state.authenticated) redirect("/login")

  return <WizardClient initial={state} />
}
