import type { GeneratedFile } from '@genesis/shared';
import { deployToVercel } from '../tools/VercelDeploy';

export interface DeployResult {
  deployed: boolean;
  url?: string;
  message: string;
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
    const url = await deployToVercel({ projectId, files, customDomain });
    return { deployed: true, url, message: `Deployed to ${url}` };
  } catch (err) {
    return {
      deployed: false,
      message: `Deploy failed: ${(err as Error).message}`,
    };
  }
}
