import { z } from 'zod';
import { IsoDate } from '../domain/schema';

const Guests = z.number().int().min(0).max(100_000);
const SignedBp = z.number().int().min(-9_999).max(100_000);
const VendorRef = z.string().min(1).max(64);

export const ChangeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('GUEST_COUNT_SET'), to: Guests }).strict(),
  z
    .object({
      kind: z.literal('GUEST_COUNT_DELTA'),
      delta: z.number().int().min(-100_000).max(100_000),
    })
    .strict(),
  z
    .object({
      kind: z.literal('BUDGET_CAP_SET'),
      to: z.number().int().min(1).max(1_000_000_000_000),
    })
    .strict(),
  z.object({ kind: z.literal('BUDGET_CAP_PCT'), pctBp: SignedBp }).strict(),
  z.object({ kind: z.literal('EVENT_DATE_MOVE'), to: IsoDate }).strict(),
  z.object({ kind: z.literal('VENDOR_DROP'), vendorId: VendorRef }).strict(),
  z.object({ kind: z.literal('VENDOR_PRICE_PCT'), vendorId: VendorRef, pctBp: SignedBp }).strict(),
]);
export const ChangeSetSchema = z.object({ changes: z.array(ChangeSchema).min(1).max(5) }).strict();
export type Change = z.infer<typeof ChangeSchema>;
export type ChangeSet = z.infer<typeof ChangeSetSchema>;
export interface ChangeParseIssue {
  path: string;
  message: string;
}
export type ChangeParseResult =
  { ok: true; changes: Change[] } | { ok: false; issues: ChangeParseIssue[] };

/**
 * Safely parses untrusted input against ChangeSetSchema without throwing.
 * Dot-joins the path elements in any reported issues (e.g. 'changes.0.to').
 *
 * @param input Untrusted input.
 * @returns Result with validated changes array or parse issues.
 */
export function parseChangeSet(input: unknown): ChangeParseResult {
  const result = ChangeSetSchema.safeParse(input);
  if (!result.success) {
    const issues: ChangeParseIssue[] = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    return { ok: false, issues };
  }
  return { ok: true, changes: result.data.changes };
}
