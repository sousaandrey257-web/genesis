import type { GeneratedFile } from '@genesis/shared';

/**
 * Deploys a set of static files to Vercel via the v13 deployments API.
 * Returns the live URL. Throws on any non-2xx response.
 */
export async function deployToVercel(opts: {
  projectId: string;
  files: GeneratedFile[];
  customDomain?: string;
}): Promise<string> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error('VERCEL_TOKEN is required to deploy.');

  const res = await fetch('https://api.vercel.com/v13/deployments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: opts.projectId,
      target: 'production',
      files: opts.files.map((f) => ({
        file: f.path,
        data: f.content,
      })),
      projectSettings: {
        framework: null, // static
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vercel API ${res.status}: ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as { url?: string; alias?: string[] };
  const url = json.alias?.[0] || json.url;
  if (!url) throw new Error('Vercel returned no URL.');
  return url.startsWith('http') ? url : `https://${url}`;
}
