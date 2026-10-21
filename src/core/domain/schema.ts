import { z } from 'zod';
import { isValidISODate } from '../shared/dates';

const Id = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'Use letters, digits, - or _');
const Label = z.string().min(1).max(120);
const MoneyMinor = z.number().int().min(0).max(1_000_000_000_000);
const Bp = z.number().int().min(0).max(100_000);
const Guests = z.number().int().min(0).max(100_000);
const Days = z.number().int().min(0).max(3_650);

export const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine(isValidISODate, 'Not a real calendar date');

export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'] as const;
export const EVENT_TYPES = ['WEDDING', 'BIRTHDAY', 'COMMUNITY'] as const;
export const VENDOR_CATEGORIES = [
  'VENUE',
  'CATERING',
  'DECOR',
  'PHOTO_VIDEO',
  'MUSIC_ENTERTAINMENT',
  'TRANSPORT',
  'OTHER',
] as const;

const FlatRule = z.object({ kind: z.literal('FLAT'), id: Id, label: Label, amount: MoneyMinor });
const PerGuestRule = z.object({
  kind: z.literal('PER_GUEST'),
  id: Id,
  label: Label,
  unitAmount: MoneyMinor,
  minBillableGuests: Guests.optional(),
});
const TierBand = z.object({ fromGuests: Guests, unitAmount: MoneyMinor });
const TieredRule = z.object({
  kind: z.literal('PER_GUEST_TIERED'),
  id: Id,
  label: Label,
  tiers: z.array(TierBand).min(1).max(12),
  minBillableGuests: Guests.optional(),
});
const StepRule = z.object({
  kind: z.literal('STEP'),
  id: Id,
  label: Label,
  guestsPerUnit: z.number().int().min(1).max(100_000),
  unitAmount: MoneyMinor,
});
const SurchargeRule = z.object({
  kind: z.literal('SURCHARGE_PCT'),
  id: Id,
  label: Label,
  pctBp: Bp,
  base: z.enum(['BASE_ONLY', 'BASE_PLUS_PRIOR_SURCHARGES']),
});
export const CostRuleSchema = z.discriminatedUnion('kind', [
  FlatRule,
  PerGuestRule,
  TieredRule,
  StepRule,
  SurchargeRule,
]);

const PaymentMilestone = z.object({
  id: Id,
  label: Label,
  pctBp: Bp,
  dueOffsetDays: Days,
  paid: z.boolean(),
});
const GuestLock = z.object({
  lockOffsetDays: Days,
  reductionsAllowedAfterLock: z.boolean(),
  guaranteedGuests: Guests.optional(),
  increaseAllowedUntilOffsetDays: Days.optional(),
  increaseTolerancePctBp: Bp.optional(),
});
const CancellationTier = z.object({ minDaysBefore: Days, forfeitPctBp: Bp });
const VendorOption = z.object({
  id: Id,
  label: Label,
  capacity: Guests.optional(),
  switchFee: MoneyMinor,
  costRules: z.array(CostRuleSchema).min(1).max(20),
});

export const VendorSchema = z.object({
  id: Id,
  name: Label,
  category: z.enum(VENDOR_CATEGORIES),
  status: z.enum(['CONFIRMED', 'DROPPED']),
  capacity: Guests.optional(),
  costRules: z.array(CostRuleSchema).min(1).max(20),
  paymentSchedule: z.array(PaymentMilestone).min(1).max(8),
  lock: GuestLock.optional(),
  leadTimeDays: Days.optional(),
  cancellation: z.array(CancellationTier).min(1).max(8),
  vendorCancelRefund: z.enum(['FULL', 'NONE', 'UNKNOWN']),
  options: z.array(VendorOption).max(6),
});

export const PrioritiesSchema = z.object({
  guests: z.number().int().min(1).max(5),
  budget: z.number().int().min(1).max(5),
  simplicity: z.number().int().min(1).max(5),
});

export const PlanSchema = z.object({
  schemaVersion: z.literal(1),
  id: Id,
  name: Label,
  eventType: z.enum(EVENT_TYPES),
  currency: z.enum(CURRENCIES),
  eventDate: IsoDate,
  asOfDate: IsoDate,
  guestCount: Guests,
  budgetCap: MoneyMinor,
  priorities: PrioritiesSchema,
  vendors: z.array(VendorSchema).min(1).max(30),
});

export type CostRule = z.infer<typeof CostRuleSchema>;
export type Vendor = z.infer<typeof VendorSchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type Currency = (typeof CURRENCIES)[number];
