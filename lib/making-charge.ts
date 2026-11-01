export type MakingChargeType =
  | 'fixed'
  | 'per_gram'
  | 'percent_of_metal'
  | 'percent_of_total'

export type MakingChargeRule = {
  type: MakingChargeType
  value: number
}

export type PricingContext = {
  netMetalFineG: number
  metalRatePerG: number
  stoneValue: number
}

export type MakingChargeResult = {
  amount: number
  basis: string
  formula: string
}

export function computeMakingCharge(
  rule: MakingChargeRule,
  ctx: PricingContext,
): MakingChargeResult {
  const metalValue = Math.max(0, ctx.netMetalFineG) * Math.max(0, ctx.metalRatePerG)
  const stoneValue = Math.max(0, ctx.stoneValue)

  switch (rule.type) {
    case 'fixed': {
      const amount = Math.max(0, rule.value)
      return {
        amount,
        basis: 'Fixed',
        formula: `₹${amount.toFixed(2)} flat`,
      }
    }
    case 'per_gram': {
      const amount = Math.max(0, rule.value) * Math.max(0, ctx.netMetalFineG)
      return {
        amount,
        basis: 'Per gram',
        formula: `₹${rule.value.toFixed(2)}/g × ${ctx.netMetalFineG.toFixed(3)} g`,
      }
    }
    case 'percent_of_metal': {
      const amount = (Math.max(0, rule.value) / 100) * metalValue
      return {
        amount,
        basis: '% of metal',
        formula: `${rule.value.toFixed(2)}% × ₹${metalValue.toFixed(2)}`,
      }
    }
    case 'percent_of_total': {
      const amount = (Math.max(0, rule.value) / 100) * (metalValue + stoneValue)
      return {
        amount,
        basis: '% of total',
        formula: `${rule.value.toFixed(2)}% × ₹${(metalValue + stoneValue).toFixed(2)}`,
      }
    }
  }
}

// Weighted average rate across metal issues (each issue × its lot's rate)
export function weightedAverageMetalRate(
  issues: Array<{ fine_g: number; rate_per_g: number }>,
): number {
  let totalFine = 0
  let totalValue = 0
  for (const i of issues) {
    const fine = Math.abs(Number(i.fine_g) || 0)
    const rate = Number(i.rate_per_g) || 0
    totalFine += fine
    totalValue += fine * rate
  }
  return totalFine > 0 ? totalValue / totalFine : 0
}