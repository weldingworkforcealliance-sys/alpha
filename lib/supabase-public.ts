import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let publicClient: SupabaseClient | null = null;

// Student codes/personal links and the public demo have their own authorization.
// Never attach an unrelated staff login, including one awaiting its MFA challenge.
export function getPublicSupabase() {
  if (!publicClient) {
    publicClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { accessToken: async () => null }
    );
  }
  return publicClient;
}
