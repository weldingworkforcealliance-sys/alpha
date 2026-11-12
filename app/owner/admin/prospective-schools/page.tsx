import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import Pipeline from './pipeline';

export const dynamic = 'force-dynamic';
export default async function ProspectiveSchools() {
  const db = await createSupabaseServerClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/login?next=/owner/admin/prospective-schools');
  const { data: owner, error } = await db.rpc('is_platform_owner');
  if (error || owner !== true) return <main style={{padding:40}}><h1>Access denied</h1><p>Prospective Schools is restricted to platform owners.</p><Link href="/dashboard">Return to Dashboard</Link></main>;
  return <Pipeline />;
}
