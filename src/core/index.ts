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
