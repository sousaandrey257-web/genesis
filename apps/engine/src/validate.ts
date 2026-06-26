import type { GeneratedFile } from '@genesis/shared';

export interface ValidationReport {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

const REQUIRED = [
  'package.json',
  'tsconfig.json',
  'app/layout.tsx',
  'app/page.tsx',
  'app/globals.css',
  'lib/seo.ts',
  'data/content.json',
];

/**
 * Cheap structural validation of a generated Next.js project — no build, no
 * network. Catches the failure modes that actually happen with LLM output:
 * truncated files, leaked ``` fences, unbalanced braces, malformed JSON and a
 * missing entrypoint. Returns errors (block "ready") and warnings (informational).
 */
export function validateProject(files: GeneratedFile[]): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const byPath = new Map(files.map((f) => [f.path, f]));

  for (const req of REQUIRED) {
    if (!byPath.has(req)) errors.push(`fichier requis manquant: ${req}`);
  }

  for (const f of files) {
    const text = f.content;

    if (!text.trim()) {
      errors.push(`${f.path}: fichier vide`);
      continue;
    }

    // A leaked markdown fence means stripFences missed an inner block — the file
    // won't compile.
    if (/^\s*```/m.test(text)) {
      errors.push(`${f.path}: bloc markdown \`\`\` résiduel`);
    }

    if (/\.(tsx?|jsx?)$/.test(f.path)) {
      const brace = balance(text, '{', '}');
      const paren = balance(text, '(', ')');
      if (brace !== 0) errors.push(`${f.path}: accolades déséquilibrées (${brace > 0 ? '+' : ''}${brace})`);
      if (paren !== 0) warnings.push(`${f.path}: parenthèses déséquilibrées (${paren > 0 ? '+' : ''}${paren})`);
    }

    if (f.path.endsWith('.json')) {
      try {
        JSON.parse(text);
      } catch (err) {
        errors.push(`${f.path}: JSON invalide (${(err as Error).message})`);
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

/** Net bracket balance, ignoring brackets inside strings/line comments. */
function balance(text: string, open: string, close: string): number {
  let depth = 0;
  let str: string | null = null;
  let prev = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (str) {
      if (c === str && prev !== '\\') str = null;
    } else if (c === '"' || c === "'" || c === '`') {
      str = c;
    } else if (c === open) {
      depth++;
    } else if (c === close) {
      depth--;
    }
    prev = c === '\\' && prev === '\\' ? '' : c;
  }
  return depth;
}
