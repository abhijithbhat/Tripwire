/**
 * Hand-computed golden-truth financial and timeline numbers.
 *
 * All money amounts are in integer minor units (paise for INR, cents for USD).
 * Invariant: Never change an expectation to make a test pass.
 */

export interface GoldenTimelineItem {
  date: string;
  milestoneId: string;
  amount: number;
  status: 'PAID' | 'DUE_TODAY' | 'UPCOMING' | 'OVERDUE';
}

export interface GoldenPlanData {
  vendorTotals: Record<string, number>;
  planTotal: number;
  headroom: number;
  lines?: Record<string, Record<string, number>>;
  optionTotals?: Record<string, number>;
  timeline: GoldenTimelineItem[];
  paidToDate: number;
  remaining: number;
  overdue: number;
  dueToday: number;
}

export const GOLDEN = {
  'wedding-120': {
    vendorTotals: {
      venue: 20_650_000,
      catering: 15_246_000,
      decor: 18_880_000,
      photo: 11_000_000,
    },
    planTotal: 65_776_000,
    headroom: 4_224_000,
    lines: {
      venue: { rental: 15_000_000, av: 2_500_000, gst: 3_150_000 },
      catering: {
        plates: 11_400_000,
        staff: 1_800_000,
        'service-charge': 1_320_000,
        gst: 726_000,
      },
      decor: { stage: 12_000_000, florals: 4_000_000, gst: 2_880_000 },
    },
    optionTotals: {
      'venue/grand-ballroom': 31_270_000,
      'catering/premium-menu': 19_404_000,
      'catering/buffet-lite': 11_781_000,
    },
    timeline: [
      { date: '2026-08-14', milestoneId: 'venue.deposit', amount: 5_162_500, status: 'PAID' },
      { date: '2026-09-13', milestoneId: 'photo.booking', amount: 4_400_000, status: 'PAID' },
      { date: '2026-10-13', milestoneId: 'catering.advance', amount: 4_573_800, status: 'PAID' },
      { date: '2026-10-28', milestoneId: 'venue.second', amount: 10_325_000, status: 'DUE_TODAY' },
      { date: '2026-11-12', milestoneId: 'decor.advance', amount: 9_440_000, status: 'UPCOMING' },
      { date: '2026-11-28', milestoneId: 'catering.second', amount: 6_098_400, status: 'UPCOMING' },
      { date: '2026-12-02', milestoneId: 'photo.balance', amount: 6_600_000, status: 'UPCOMING' },
      { date: '2026-12-05', milestoneId: 'venue.final', amount: 5_162_500, status: 'UPCOMING' },
      { date: '2026-12-09', milestoneId: 'decor.final', amount: 9_440_000, status: 'UPCOMING' },
      { date: '2026-12-10', milestoneId: 'catering.final', amount: 4_573_800, status: 'UPCOMING' },
    ],
    paidToDate: 14_136_300,
    remaining: 51_639_700,
    overdue: 0,
    dueToday: 10_325_000,
  },
  'birthday-40': {
    vendorTotals: {
      venue: 30_000,
      catering: 59_920,
      entertainer: 18_000,
    },
    planTotal: 107_920,
    headroom: 12_080,
    timeline: [
      { date: '2026-10-31', milestoneId: 'venue.deposit', amount: 15_000, status: 'UPCOMING' },
      { date: '2026-11-07', milestoneId: 'entertainer.deposit', amount: 9000, status: 'PAID' },
      { date: '2026-11-14', milestoneId: 'catering.full', amount: 59_920, status: 'UPCOMING' },
      { date: '2026-11-21', milestoneId: 'venue.balance', amount: 15_000, status: 'UPCOMING' },
      { date: '2026-11-21', milestoneId: 'entertainer.balance', amount: 9000, status: 'UPCOMING' },
    ],
    paidToDate: 9000,
    remaining: 98_920,
    overdue: 0,
    dueToday: 0,
  },
  'community-300': {
    vendorTotals: {
      grounds: 2_800_000,
      kitchen: 4_050_000,
      av: 4_130_000,
      rentals: 1_650_000,
    },
    planTotal: 12_630_000,
    headroom: 2_370_000,
    timeline: [
      { date: '2026-10-31', milestoneId: 'av.advance', amount: 2_065_000, status: 'PAID' },
      { date: '2026-11-04', milestoneId: 'kitchen.advance', amount: 2_025_000, status: 'UPCOMING' },
      { date: '2026-11-07', milestoneId: 'grounds.full', amount: 2_800_000, status: 'UPCOMING' },
      { date: '2026-11-12', milestoneId: 'rentals.full', amount: 1_650_000, status: 'UPCOMING' },
      { date: '2026-11-13', milestoneId: 'kitchen.final', amount: 2_025_000, status: 'UPCOMING' },
      { date: '2026-11-13', milestoneId: 'av.final', amount: 2_065_000, status: 'UPCOMING' },
    ],
    paidToDate: 2_065_000,
    remaining: 10_565_000,
    overdue: 0,
    dueToday: 0,
  },
} as const;
