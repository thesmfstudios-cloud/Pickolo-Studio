export type PricingConfig = {
  amountPaise: number;
  platformFeeBps: number;
};

export function calculateBookingPrice(config: PricingConfig) {
  const totalPaise = Math.round(config.amountPaise);
  const platformFeePaise = Math.round(totalPaise * (config.platformFeeBps / 10_000));

  return {
    currency: 'INR',
    totalPaise,
    platformFeePaise,
    partnerPayoutPaise: totalPaise - platformFeePaise,
  };
}
