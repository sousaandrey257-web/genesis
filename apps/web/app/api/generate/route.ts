import { runPipeline } from '@genesis/engine';
import type { GenerateRequest, GeneratedSite } from '@genesis/shared';
import { auth } from '@/auth';
import { checkEntitlement, recordSite } from '@/lib/entitlements';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Streams the GENESIS pipeline to the client as Server-Sent Events.
 * Each line is `data: <json StreamEvent>\n\n`; the final event carries the
 * assembled site under { stage: 'deploy', status: 'done', data: { site } }.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as GenerateRequest;
  if (!body?.idea || body.idea.trim().length < 3) {
    return new Response(JSON.stringify({ error: 'idea is required' }), { status: 400 });
  }

  // Logged-in users are billed against their plan's monthly limit. Anonymous
  // visitors get the public marketing demo without a quota.
  const session = await auth();
  const userId = session?.user?.id;
  if (userId) {
    const ent = await checkEntitlement(userId);
    if (!ent.allowed) {
      return new Response(JSON.stringify({ error: ent.reason }), { status: 402 });
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      try {
        const gen = runPipeline(body);
        let next = await gen.next();
        while (!next.done) {
          send(next.value);
          next = await gen.next();
        }
        const site = next.value as GeneratedSite;

        // Persist for logged-in users (counts toward their monthly quota).
        if (userId) {
          await recordSite(userId, {
            id: site.id,
            business_name: site.brief.businessName,
            type: site.brief.type,
            sector: site.brief.sector,
            language: site.brief.location.locale,
            status: site.deployUrl ? 'live' : 'building',
            deploy_url: site.deployUrl ?? null,
          });
        }

        // Final payload: omit the (large) file contents, keep the manifest.
        const { files, ...manifest } = site;
        void files;
        send({
          stage: 'deploy',
          status: 'done',
          message: 'Site prêt',
          progress: 100,
          data: { site: manifest },
        });
      } catch (err) {
        send({
          stage: 'translate',
          status: 'error',
          message: (err as Error).message,
          progress: 0,
        });
      } finally {
        controller.enqueue(encoder.encode('event: end\ndata: {}\n\n'));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
