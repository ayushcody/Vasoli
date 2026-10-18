/**
 * Pure functions for financial calculators used in the Learn hub.
 * All functions return calculated values and explanations where appropriate.
 */

// 1. Emergency Fund Calculator
export function calculateEmergencyFund(monthlyExpenses: number, targetMonths: number) {
  const target = monthlyExpenses * targetMonths
  return {
    target,
    explanation: `You need ₹${target.toLocaleString("en-IN")} to cover ${targetMonths} months of expenses (₹${monthlyExpenses.toLocaleString("en-IN")}/mo).`
  }
}

// 2. Debt Snowball / Avalanche Explainer
export function analyzeDebtStrategy(debts: Array<{ name: string, outstanding: number, interestRate: number, emi: number }>) {
  if (!debts || debts.length === 0) return { snowball: [], avalanche: [] }

  const snowball = [...debts].sort((a, b) => a.outstanding - b.outstanding)
  const avalanche = [...debts].sort((a, b) => b.interestRate - a.interestRate)

  return {
    snowball,
    avalanche,
    explanation: "Snowball focuses on smallest balances first for quick wins. Avalanche targets highest interest rates first to save money mathematically."
  }
}

// 3. Goal Contribution Calculator
export function calculateGoalContribution(targetAmount: number, currentAmount: number, monthsRemaining: number) {
  if (monthsRemaining <= 0) return { monthly: 0, shortfall: 0 }
  const shortfall = Math.max(0, targetAmount - currentAmount)
  const monthly = shortfall / monthsRemaining
  return {
    monthly,
    shortfall
  }
}

// 4. Retirement Corpus Estimator
export function estimateRetirementCorpus(
  currentAge: number,
  retirementAge: number,
  currentMonthlyExpense: number,
  inflationRate: number = 0.06,
  returnRate: number = 0.08,
  lifeExpectancy: number = 85
) {
  const yearsToRetirement = Math.max(0, retirementAge - currentAge)
  const yearsInRetirement = Math.max(0, lifeExpectancy - retirementAge)

  if (yearsToRetirement === 0 || yearsInRetirement === 0) return { corpusNeeded: 0, inflatedMonthlyExpense: 0 }

  // 1. Inflate current expenses to retirement age
  const inflatedMonthlyExpense = currentMonthlyExpense * Math.pow(1 + inflationRate, yearsToRetirement)
  const annualRetirementExpense = inflatedMonthlyExpense * 12

  // 2. Calculate Real Return Rate during retirement
  // Real Return = ((1 + returnRate) / (1 + inflationRate)) - 1
  const realReturnRate = ((1 + returnRate) / (1 + inflationRate)) - 1

  // 3. Calculate Present Value of an Annuity (Corpus needed at retirement)
  // formula: PMT * [1 - (1 + r)^-n] / r
  // If realReturnRate is ~0, corpus = annualRetirementExpense * yearsInRetirement
  let corpusNeeded = 0
  if (Math.abs(realReturnRate) < 0.001) {
    corpusNeeded = annualRetirementExpense * yearsInRetirement
  } else {
    corpusNeeded = annualRetirementExpense * ((1 - Math.pow(1 + realReturnRate, -yearsInRetirement)) / realReturnRate)
  }

  return {
    inflatedMonthlyExpense,
    corpusNeeded,
    yearsToRetirement,
    yearsInRetirement,
    assumptions: `Assumes ${inflationRate*100}% inflation, ${returnRate*100}% post-retirement returns, and life expectancy of ${lifeExpectancy}.`
  }
}

// 5. Subscription Leak Calculator
export function calculateSubscriptionLeak(monthlyAmount: number) {
  const annual = monthlyAmount * 12
  const fiveYear = annual * 5
  return {
    annual,
    fiveYear,
    explanation: `A ₹${monthlyAmount} monthly subscription costs you ₹${annual.toLocaleString("en-IN")} a year, or ₹${fiveYear.toLocaleString("en-IN")} over 5 years. Is it worth it?`
  }
}
