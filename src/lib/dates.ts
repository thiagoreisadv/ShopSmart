export const pad = (n: number) => String(n).padStart(2, '0')
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
/** Semana começa na segunda-feira. */
export function startOfWeek(d: Date): Date {
  const s = startOfDay(d)
  const dow = (s.getDay() + 6) % 7
  s.setDate(s.getDate() - dow)
  return s
}
export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
export const startOfYear = (d: Date) => new Date(d.getFullYear(), 0, 1)
export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}
export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export function monthLabel(key: string, withYear = true): string {
  const [y, m] = key.split('-').map(Number)
  return withYear ? `${MONTHS[m - 1]}/${String(y).slice(2)}` : MONTHS[m - 1]
}
export function monthLong(d: Date): string {
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
export function daysBetween(aIso: string, now = new Date()): number {
  return Math.floor((startOfDay(now).getTime() - startOfDay(new Date(aIso)).getTime()) / 86400000)
}
export function ageLabel(iso: string, now = new Date()): string {
  const d = daysBetween(iso, now)
  if (d <= 0) return 'hoje'
  if (d === 1) return 'ontem'
  if (d < 30) return `há ${d} dias`
  if (d < 365) return `há ${Math.floor(d / 30)} ${Math.floor(d / 30) === 1 ? 'mês' : 'meses'}`
  return `há ${Math.floor(d / 365)} ${Math.floor(d / 365) === 1 ? 'ano' : 'anos'}`
}
