import type { Role } from './roles'

export type NavItem = { label: string; href: string; roles: Role[] }
export type NavSection = { title: string; items: NavItem[] }

const ALL_STAFF: Role[]     = ['admin', 'manager', 'sales', 'accountant']
const ADMIN_MGR: Role[]     = ['admin', 'manager']
const ADMIN_MGR_ACC: Role[] = ['admin', 'manager', 'accountant']

export const NAV: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', href: '/',       roles: ALL_STAFF },
      { label: 'Reports',   href: '/reports', roles: ALL_STAFF },
    ],
  },

  // ── CATALOG — product & design master data ─────────────────────────
  {
    title: 'Catalog',
    items: [
      { label: 'Product Catalog',     href: '/catalog',                  roles: ALL_STAFF },
      { label: 'Designs',             href: '/designs',                  roles: ALL_STAFF },
      { label: 'Categories & Brands', href: '/settings/catalog-taxonomy', roles: ADMIN_MGR },
      { label: 'Materials',           href: '/settings/materials',       roles: ADMIN_MGR },
      { label: 'Stone Types',         href: '/settings/stone-master',    roles: ADMIN_MGR },
    ],
  },

  {
    title: 'Sell',
    items: [
      { label: 'POS (New Invoice)', href: '/invoices/new', roles: ALL_STAFF },
      { label: 'Invoices',          href: '/invoices',     roles: ALL_STAFF },
      { label: 'Online Orders',     href: '/orders',       roles: ALL_STAFF },
      { label: 'Returns',           href: '/returns',      roles: ALL_STAFF },
      { label: 'Advance Bookings',  href: '/bookings',     roles: ADMIN_MGR_ACC },
      { label: 'Buyback',           href: '/buyback',      roles: ADMIN_MGR_ACC },
      { label: 'Gold Schemes',      href: '/schemes',      roles: ALL_STAFF },
      { label: 'Customers',         href: '/customers',    roles: ALL_STAFF },
    ],
  },

  {
    title: 'Inventory',
    items: [
      { label: 'Finished Goods', href: '/inventory',     roles: ALL_STAFF },
      { label: 'Metal Lots',     href: '/metal/lots',    roles: ADMIN_MGR_ACC },
      { label: 'Stone Lots',     href: '/stones/lots',   roles: ADMIN_MGR_ACC },
      { label: 'Material Lots',  href: '/material/lots', roles: ADMIN_MGR_ACC },
      { label: 'Purchases',      href: '/purchases',     roles: ADMIN_MGR_ACC },
      { label: 'Vendors',        href: '/vendors',       roles: ADMIN_MGR_ACC },
    ],
  },

  {
    title: 'Production',
    items: [
      { label: 'Craftsmen', href: '/craftsmen', roles: ADMIN_MGR },
      { label: 'Jobs',      href: '/jobs',      roles: ALL_STAFF },
      { label: 'Repairs',   href: '/repairs',   roles: ALL_STAFF },
    ],
  },

  {
    title: 'Finance',
    items: [
      { label: 'Expenses',   href: '/expenses',   roles: ADMIN_MGR_ACC },
      { label: 'Accounting', href: '/accounting', roles: ADMIN_MGR_ACC },
    ],
  },

  {
    title: 'Admin',
    items: [
      { label: 'Settings', href: '/settings', roles: ADMIN_MGR },
    ],
  },
]

export function visibleNav(role: Role): NavSection[] {
  return NAV.map((s) => ({
    title: s.title,
    items: s.items.filter((i) => i.roles.includes(role)),
  })).filter((s) => s.items.length > 0)
}

export function bottomNavFor(role: Role): NavItem[] {
  const salesNav: NavItem[] = [
    { label: 'Home',      href: '/',             roles: [] },
    { label: 'Inventory', href: '/inventory',    roles: [] },
    { label: 'POS',       href: '/invoices/new', roles: [] },
    { label: 'Orders',    href: '/orders',       roles: [] },
    { label: 'More',      href: '#more',         roles: [] },
  ]
  const accNav: NavItem[] = [
    { label: 'Home',       href: '/',           roles: [] },
    { label: 'Invoices',   href: '/invoices',   roles: [] },
    { label: 'Accounting', href: '/accounting', roles: [] },
    { label: 'Reports',    href: '/reports',    roles: [] },
    { label: 'More',       href: '#more',       roles: [] },
  ]
  if (role === 'accountant' || role === 'viewer') return accNav
  if (role === 'craftsman' || role === 'karigar') {
    return [
      { label: 'Home',   href: '/',       roles: [] },
      { label: 'Jobs',   href: '/jobs',   roles: [] },
      { label: 'Issues', href: '/issues', roles: [] },
      { label: 'More',   href: '#more',   roles: [] },
    ]
  }
  return salesNav
}