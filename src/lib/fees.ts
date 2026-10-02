import type { FeeTier, Payout } from "./types";

export const FEE_RATE: Record<FeeTier, number> = {
  BASIC: 0.07,
  ADVANCED: 0.1,
};

export const FEE_LABEL: Record<FeeTier, string> = {
  BASIC: "Phí vận hành 7% (mô phỏng)",
  ADVANCED: "Phí bảo vệ nâng cao 10% (mô phỏng)",
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Phí chỉ tính trên phần freelancer nhận. Phần hoàn cho business không bị trừ phí. */
export function computePayout(
  amount: number,
  freelancerGross: number,
  tier: FeeTier,
): Payout {
  const gross = Math.min(Math.max(freelancerGross, 0), amount);
  const fee = round2(gross * FEE_RATE[tier]);
  const decision = gross === amount ? "release" : gross === 0 ? "refund" : "split";
  return {
    decision,
    freelancerGross: gross,
    fee,
    freelancerNet: round2(gross - fee),
    businessRefund: round2(amount - gross),
  };
}

export function usdc(n: number): string {
  const s = n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${s} USDC`;
}
