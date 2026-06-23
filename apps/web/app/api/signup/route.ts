import { supabaseAuthClient, supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

/** Create a Supabase Auth user + a profile row. */
export async function POST(req: Request) {
  const { email, password, fullName } = (await req.json()) as {
    email?: string;
    password?: string;
    fullName?: string;
  };

  if (!email || !password || password.length < 6) {
    return Response.json(
      { error: 'Email et mot de passe (6 caractères min) requis.' },
      { status: 400 },
    );
  }

  const client = supabaseAuthClient();
  if (!client) {
    return Response.json({ error: 'Supabase non configuré.' }, { status: 503 });
  }

  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName ?? '' } },
  });
  if (error) return Response.json({ error: error.message }, { status: 400 });

  const admin = supabaseAdmin();
  if (admin && data.user) {
    await admin
      .from('profiles')
      .upsert({ id: data.user.id, email, full_name: fullName ?? '' }, { onConflict: 'id' });
    await admin
      .from('subscriptions')
      .upsert({ user_id: data.user.id, plan: 'free', status: 'inactive' }, { onConflict: 'user_id' });
  }

  // If email confirmation is enabled in Supabase, the user must confirm before login.
  const needsConfirm = !data.session;
  return Response.json({ ok: true, needsConfirm });
}
