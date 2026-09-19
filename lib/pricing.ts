
export type ServiceLevelName = 'Basic' | 'Standard' | 'Professional';

type PricingInput = {
  level: ServiceLevelName;
  durationMinutes: 30 | 60 | 120;
};

const BASE_RATES: Record<ServiceLevelName, Record<30 | 60 | 120, number>> = {
  Basic: { 30: 49900, 60: 79900, 120: 139900 },
  Standard: { 30: 69900, 60: 109900, 120: 189900 },
  Professional: { 30: 99900, 60: 159900, 120: 279900 }
};

export function calculateBookingPrice({ level, durationMinutes }: PricingInput) {
  const totalPaise = BASE_RATES[level][durationMinutes];
  const platformFeePaise = Math.round(totalPaise * 0.2);
  return {
    currency: 'INR',
    totalPaise,
    platformFeePaise,
    partnerPayoutPaise: totalPaise - platformFeePaise
  };
}
