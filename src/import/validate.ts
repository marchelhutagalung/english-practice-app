import type { ZodIssue } from 'zod';
import { PackSchema, checkPackIntegrity, type Pack, type PackIssue } from '../domain/schema';

export type ValidationResult = { ok: true; pack: Pack } | { ok: false; issues: PackIssue[] };

const COLLECTIONS = new Set(['topics', 'competitions', 'passages', 'questions']);

function describeIssue(raw: unknown, issue: ZodIssue): PackIssue {
  const path = issue.path;
  if (path.length >= 2 && typeof path[0] === 'string' && COLLECTIONS.has(path[0]) && typeof path[1] === 'number') {
    const kind = path[0];
    const index = path[1];
    const rec = (raw as Record<string, unknown[]>)?.[kind]?.[index] as { id?: unknown } | undefined;
    const idPart = rec && typeof rec.id === 'string' ? ` (id "${rec.id}")` : '';
    const field = path.slice(2).join('.') || '(item)';
    return { item: `${kind}[${index}]${idPart}`, field, message: messageOf(issue) };
  }
  return { item: 'pack', field: path.join('.') || '(root)', message: messageOf(issue) };
}

function messageOf(issue: ZodIssue): string {
  if (issue.code === 'unrecognized_keys') return `unknown field(s): ${issue.keys.join(', ')}`;
  if (issue.code === 'invalid_type' && issue.received === 'undefined') return 'is required';
  return issue.message;
}

/** Validate an already-parsed value. Never partially accepts: any issue rejects the pack. */
export function validatePack(raw: unknown): ValidationResult {
  const parsed = PackSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map((i) => describeIssue(raw, i)) };
  }
  const integrity = checkPackIntegrity(parsed.data);
  if (integrity.length) return { ok: false, issues: integrity };
  return { ok: true, pack: parsed.data };
}

/** Parse JSON text, then validate. */
export function validatePackText(textContent: string): ValidationResult {
  let raw: unknown;
  try {
    raw = JSON.parse(textContent);
  } catch (e) {
    return { ok: false, issues: [{ item: 'file', field: '(json)', message: `not valid JSON: ${(e as Error).message}` }] };
  }
  return validatePack(raw);
}

export function formatIssues(issues: PackIssue[]): string {
  return issues.map((i) => `• ${i.item} → ${i.field}: ${i.message}`).join('\n');
}
