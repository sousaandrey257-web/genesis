import type { GeneratedFile } from '@genesis/shared';

const API = 'https://api.vercel.com';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface VercelDeployResult {
  url: string;
  deploymentId: string;
  state: 'READY' | 'BUILDING' | 'ERROR' | 'QUEUED' | 'CANCELED' | 'UNKNOWN';
  customDomain?: { name: string; attached: boolean };
}

/**
 * Deploys a generated Next.js 14 project to Vercel via the v13 deployments API,
 * waits for the build to finish, and (optionally) attaches a custom domain.
 *
 * Unlike the previous static deploy, this declares `framework: nextjs` so Vercel
 * installs deps and runs `next build`. Throws with the parsed Vercel error on any
 * non-2xx response or if the build ends in ERROR.
 */
export async function deployToVercel(opts: {
  projectId: string;
  files: GeneratedFile[];
  customDomain?: string;
  /** Max seconds to wait for the build before returning BUILDING. Default 180. */
  timeoutSeconds?: number;
}): Promise<VercelDeployResult> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error('VERCEL_TOKEN is required to deploy.');

  const name = sanitizeName(opts.projectId);
  const teamQuery = process.env.VERCEL_TEAM_ID ? `?teamId=${process.env.VERCEL_TEAM_ID}` : '';

  const created = await vercel(token, `/v13/deployments${teamQuery}`, 'POST', {
    name,
    target: 'production',
    files: opts.files.map((f) => ({ file: f.path, data: f.content })),
    projectSettings: { framework: 'nextjs' },
  });

  const deploymentId = created.id as string;
  const directUrl = toHttps((created.url as string) || '');

  const finalState = await waitForReady(
    token,
    deploymentId,
    teamQuery,
    opts.timeoutSeconds ?? 180,
  );

  let customDomain: VercelDeployResult['customDomain'];
  if (opts.customDomain) {
    customDomain = await attachDomain(token, name, opts.customDomain, teamQuery);
  }

  const url =
    customDomain?.attached && customDomain.name
      ? toHttps(customDomain.name)
      : directUrl;

  if (finalState === 'ERROR') {
    throw new Error(`Vercel build failed for ${url || deploymentId}.`);
  }

  return { url, deploymentId, state: finalState, customDomain };
}

/** Poll the deployment until it leaves the BUILDING/QUEUED state or we time out. */
async function waitForReady(
  token: string,
  id: string,
  teamQuery: string,
  timeoutSeconds: number,
): Promise<VercelDeployResult['state']> {
  const deadline = Date.now() + timeoutSeconds * 1000;
  let delay = 2000;
  while (Date.now() < deadline) {
    const dep = await vercel(token, `/v13/deployments/${id}${teamQuery}`, 'GET');
    const state = (dep.readyState || dep.status || 'UNKNOWN') as VercelDeployResult['state'];
    if (state === 'READY' || state === 'ERROR' || state === 'CANCELED') return state;
    await sleep(delay);
    delay = Math.min(delay * 1.5, 10000);
  }
  return 'BUILDING';
}

/** Attach a custom domain to the project. Non-fatal: returns attached:false on failure. */
async function attachDomain(
  token: string,
  project: string,
  domain: string,
  teamQuery: string,
): Promise<{ name: string; attached: boolean }> {
  try {
    await vercel(token, `/v10/projects/${project}/domains${teamQuery}`, 'POST', {
      name: domain,
    });
    return { name: domain, attached: true };
  } catch {
    return { name: domain, attached: false };
  }
}

async function vercel(
  token: string,
  path: string,
  method: 'GET' | 'POST',
  body?: unknown,
): Promise<Record<string, unknown>> {
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    /* non-JSON body */
  }

  if (!res.ok) {
    const errObj = json.error as { message?: string; code?: string } | undefined;
    const detail = errObj?.message || text.slice(0, 300) || res.statusText;
    throw new Error(`Vercel ${method} ${path} → ${res.status}: ${detail}`);
  }
  return json;
}

function toHttps(url: string): string {
  if (!url) return '';
  return url.startsWith('http') ? url : `https://${url}`;
}

function sanitizeName(id: string): string {
  return (
    id
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 52) || 'genesis-site'
  );
}
