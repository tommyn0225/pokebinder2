import { createClient } from '@/lib/supabase/server'
import Navbar from './Navbar'

export default async function NavbarWrapper() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return <Navbar userEmail={user?.email ?? null} />
}
