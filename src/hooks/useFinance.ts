import { useMemo } from 'react'
import { useAppState } from '@/store/store'
import { spendRows, periodTotals, savingsReport, monthSeries, financeAlerts, frequentProducts } from '@/domain/finance'
import { startOfMonth, addMonths } from '@/lib/dates'

/** Dados financeiros derivados das compras finalizadas (memoizados). */
export function useFinance(now: Date = new Date()) {
  const purchases = useAppState((s) => s.purchases)
  const prices = useAppState((s) => s.prices)
  const goals = useAppState((s) => s.settings.goals)
  const dayKey = now.toDateString()
  return useMemo(() => {
    const d = new Date(dayKey)
    const rows = spendRows(purchases)
    const pt = periodTotals(rows, d)
    const m0 = startOfMonth(d)
    const monthSavings = savingsReport(purchases, prices, { from: m0, to: addMonths(m0, 1) })
    const hasData = rows.length > 0
    return {
      rows,
      hasData,
      period: pt,
      series: monthSeries(rows, d, 6),
      savings: monthSavings,
      allSavings: savingsReport(purchases, prices),
      alerts: financeAlerts(rows, purchases, prices, goals, d),
      frequent: frequentProducts(purchases, 5),
      budgetCents: goals.monthlyBudgetCents,
      balanceCents: goals.monthlyBudgetCents > 0 ? goals.monthlyBudgetCents - pt.month : null,
    }
  }, [purchases, prices, goals, dayKey])
}
