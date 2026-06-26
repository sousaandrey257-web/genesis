import type { GeneratedFile } from '@genesis/shared';
import { deployToVercel } from '../tools/VercelDeploy';

export interface DeployResult {
  deployed: boolean;
  url?: string;
  message: string;
  state?: string;
  customDomain?: { name: string; attached: boolean };
}

/**
 * Step 7 — deploy the generated files to Vercel. If VERCEL_TOKEN is not set we
 * return a dry-run result with a local preview path instead of failing, so the
 * pipeline always completes end-to-end in development.
 */
export async function runDeployer(
  projectId: string,
  files: GeneratedFile[],
  customDomain?: string,
): Promise<DeployResult> {
  if (!process.env.VERCEL_TOKEN) {
    return {
      deployed: false,
      message:
        'VERCEL_TOKEN not set — skipped real deploy. Files are ready; preview is ' +
        'served locally. Set VERCEL_TOKEN to deploy to a live URL.',
    };
  }

  try {
    const r = await deployToVercel({ projectId, files, customDomain });
    const domainNote =
      r.customDomain && !r.customDomain.attached
        ? ` (domaine ${r.customDomain.name} non rattaché — vérifie le DNS)`
        : '';
    const message =
      r.state === 'READY'
        ? `Déployé sur ${r.url}${domainNote}`
        : r.state === 'BUILDING'
          ? `Build lancé (${r.url}) — toujours en cours${domainNote}`
          : `Déploiement ${r.state} : ${r.url}${domainNote}`;
    return {
      deployed: r.state === 'READY' || r.state === 'BUILDING',
      url: r.url,
      state: r.state,
      customDomain: r.customDomain,
      message,
    };
  } catch (err) {
    return {
      deployed: false,
      message: `Échec du déploiement : ${(err as Error).message}`,
    };
  }
}
