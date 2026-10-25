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

export { weddingPlan } from './fixtures/wedding-120';
export { birthdayPlan } from './fixtures/birthday-40';
export { communityPlan } from './fixtures/community-300';
export { GOLDEN, type GoldenPlanData, type GoldenTimelineItem } from './fixtures/golden';

export { computeRulesCost, type CostLine, type RulesCost } from './cost/rules';

export {
  isLockActive,
  billableGuestsFor,
  computeVendorCost,
  computePlanCost,
  type VendorCost,
  type PlanCost,
} from './cost/plan-cost';

export {
  computePaymentTimeline,
  type PaymentStatus,
  type PaymentEvent,
  type PaymentTimeline,
} from './cost/payments';

export {
  ChangeSchema,
  ChangeSetSchema,
  parseChangeSet,
  type Change,
  type ChangeSet,
  type ChangeParseIssue,
  type ChangeParseResult,
} from './change/schema';

export {
  applyChange,
  applyChanges,
  type ApplyErrorCode,
  type ApplyError,
  type Assumption,
  type ApplyResult,
} from './change/apply';

export {
  STATUS_SEVERITY,
  NEAR_BUDGET_BP,
  NEAR_CAPACITY_BP,
  LOCK_SOON_DAYS,
  type TripwireStatus,
  type TripwireKind,
  type FactValue,
  type Tripwire,
  type Evaluation,
} from './evaluate/types';

export { worstStatus, evaluatePlan } from './evaluate/evaluate';

export {
  evaluateBudgetCap,
  evaluateVenuePresent,
  evaluateVenueCapacity,
  evaluateGuestLocks,
  evaluatePayments,
} from './evaluate/tripwires';
