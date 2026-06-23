import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { supabaseAuthClient, supabaseAdmin } from '@/lib/supabase';

/**
 * GENESIS uses NextAuth v5 for the app session layer, with a Credentials
 * provider that authenticates against Supabase Auth (email + password). This
 * keeps identity in Supabase while giving the Next app `auth()`/`useSession`
 * and middleware protection. Sessions are JWT (required for Credentials).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(creds) {
        const email = String(creds?.email ?? '').trim();
        const password = String(creds?.password ?? '');
        if (!email || !password) return null;

        const client = supabaseAuthClient();
        if (!client) return null;

        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error || !data.user) return null;

        // Ensure a profile row exists for this user.
        const admin = supabaseAdmin();
        if (admin) {
          await admin
            .from('profiles')
            .upsert({ id: data.user.id, email: data.user.email }, { onConflict: 'id' });
        }

        return {
          id: data.user.id,
          email: data.user.email,
          name: (data.user.user_metadata?.full_name as string) ?? data.user.email,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.uid) session.user.id = token.uid as string;
      return session;
    },
  },
});
