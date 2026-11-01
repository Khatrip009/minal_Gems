export type Role =
  | 'admin'
  | 'manager'
  | 'sales'
  | 'accountant'
  | 'viewer'
  | 'craftsman'
  | 'karigar'
  | 'customer'

/** Who can see cost/metal-rate/stone-cost columns. */
export function canSeeCosts(role: Role | null): boolean {
  return role === 'admin' || role === 'manager' || role === 'accountant'
}

/** Who can see financial KPIs (revenue, receivables, cash flow, unpaid invoices). */
export function canSeeFinance(role: Role | null): boolean {
  return role === 'admin' || role === 'manager' || role === 'accountant'
}

/** Who can write (create/edit) business records. */
export function canWrite(role: Role | null): boolean {
  return role === 'admin' || role === 'manager' || role === 'sales' || role === 'accountant'
}

/** Who can administer users / company settings. */
export function isAdmin(role: Role | null): boolean {
  return role === 'admin'
}