import { auth } from '@/auth';
import { createConnectedAccount } from '@genesis/engine';

export const runtime = 'nodejs';

/**
 * Start Stripe Express onboarding for the authenticated seller. Returns the
 * onboarding URL the client redirects to, or a 503 when Stripe Connect is not
 * configured (createConnectedAccount returns null).
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'auth_required', redirect: '/login' }, { status: 401 });
  }

  const email = session.user.email;
  if (!email) {
    return Response.json({ error: 'Adresse e-mail manquante.' }, { status: 400 });
  }

  const origin = process.env.NEXTAUTH_URL || new URL(req.url).origin;
  const account = await createConnectedAccount({
    email,
    refreshUrl: `${origin}/dashboard?connect=refresh`,
    returnUrl: `${origin}/dashboard?connect=done`,
  });

  if (!account) {
    return Response.json(
      { error: 'Stripe Connect non configuré.' },
      { status: 503 },
    );
  }

  return Response.json({ onboardingUrl: account.onboardingUrl });
}
