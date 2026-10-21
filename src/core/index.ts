export const CORE_VERSION = '0.1.0';

export {
  BP_SCALE,
  assertSafeInt,
  sumMoney,
  mulBp,
  splitByBp,
  ceilDiv,
  type Money,
  type Bp,
} from './shared/money';

export {
  isValidISODate,
  toDayNumber,
  fromDayNumber,
  addDays,
  diffDays,
  compareISODate,
  type ISODate,
} from './shared/dates';

export { formatMoney } from './shared/format';

export {
  CostRuleSchema,
  VendorSchema,
  PrioritiesSchema,
  PlanSchema,
  IsoDate,
  CURRENCIES,
  EVENT_TYPES,
  VENDOR_CATEGORIES,
  type CostRule,
  type Vendor,
  type Plan,
  type Currency,
} from './domain/schema';

export { validatePlan, type ValidationIssue, type ValidationResult } from './domain/validate';

export {
  rupees,
  dollars,
  flat,
  perGuest,
  tiered,
  step,
  surcharge,
  milestone,
  cancel,
  makeVendor,
  makePlan,
  type PaymentMilestone,
  type CancellationTier,
  type TierBand,
} from './fixtures/builders';
