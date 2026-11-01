export type OrderStatus =
  | 'pending'
  | 'pending_payment'
  | 'confirmed'
  | 'paid'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded'

type StatusConfig = { label: string; tone: string }

const STATUS_CONFIG: Record<OrderStatus, StatusConfig> = {
  pending: {
    label: 'Pending',
    tone: 'bg-amber-100 text-amber-800',
  },
  pending_payment: {
    label: 'Awaiting payment',
    tone: 'bg-amber-100 text-amber-800',
  },
  confirmed: {
    label: 'Confirmed',
    tone: 'bg-blue-100 text-blue-800',
  },
  paid: {
    label: 'Paid',
    tone: 'bg-emerald-100 text-emerald-800',
  },
  shipped: {
    label: 'Shipped',
    tone: 'bg-indigo-100 text-indigo-800',
  },
  delivered: {
    label: 'Delivered',
    tone: 'bg-emerald-100 text-emerald-800',
  },
  cancelled: {
    label: 'Cancelled',
    tone: 'bg-rose-100 text-rose-800',
  },
  refunded: {
    label: 'Refunded',
    tone: 'bg-stone-100 text-stone-700',
  },
}

export function getOrderStatusConfig(status: string | null | undefined): StatusConfig {
  if (status && status in STATUS_CONFIG) {
    return STATUS_CONFIG[status as OrderStatus]
  }
  return { label: status ?? 'Unknown', tone: 'bg-stone-100 text-stone-700' }
}