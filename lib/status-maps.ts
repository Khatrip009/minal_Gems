import {
  AlertCircle, AlertTriangle, CheckCircle, Clock, Hammer, Package,
  RotateCcw, XCircle, Truck, Undo2,
} from 'lucide-react'

export type Tone = 'neutral' | 'info' | 'warning' | 'success' | 'danger' | 'brand' | 'muted'
export type StatusDef = { label: string; tone: Tone; icon?: React.ComponentType<{ className?: string }> }

export const jobStatusMap: Record<string, StatusDef> = {
  pending:     { label: 'Pending',     tone: 'neutral',  icon: Clock },
  in_progress: { label: 'In progress', tone: 'warning',  icon: Hammer },
  completed:   { label: 'Completed',   tone: 'success',  icon: CheckCircle },
  delivered:   { label: 'Delivered',   tone: 'brand',    icon: Package },
  cancelled:   { label: 'Cancelled',   tone: 'muted',    icon: XCircle },
}

export const invoiceStatusMap: Record<string, StatusDef> = {
  draft:  { label: 'Draft',  tone: 'neutral' },
  issued: { label: 'Issued', tone: 'info' },
  voided: { label: 'Voided', tone: 'muted', icon: Undo2 },
}

export const invoicePaymentStatusMap: Record<string, StatusDef> = {
  unpaid:         { label: 'Unpaid',  tone: 'danger',  icon: AlertCircle },
  partially_paid: { label: 'Partial', tone: 'warning', icon: AlertTriangle },
  paid:           { label: 'Paid',    tone: 'success', icon: CheckCircle },
  refunded:       { label: 'Refunded',tone: 'info',    icon: RotateCcw },
}

export const inventoryStatusMap: Record<string, StatusDef> = {
  available:    { label: 'Available',    tone: 'success' },
  reserved:     { label: 'Reserved',     tone: 'info' },
  allocated:    { label: 'Allocated',    tone: 'warning' },
  sold:         { label: 'Sold',         tone: 'muted' },
  in_repair:    { label: 'In repair',    tone: 'warning' },
  in_transit:   { label: 'In transit',   tone: 'info',  icon: Truck },
  damaged:      { label: 'Damaged',      tone: 'danger' },
  lost:         { label: 'Lost',         tone: 'danger' },
  returned:     { label: 'Returned',     tone: 'info' },
  exchanged:    { label: 'Exchanged',    tone: 'info' },
  scrapped:     { label: 'Scrapped',     tone: 'muted' },
}

export const returnStatusMap: Record<string, StatusDef> = {
  pending:   { label: 'Pending',   tone: 'warning' },
  received:  { label: 'Received',  tone: 'info' },
  completed: { label: 'Completed', tone: 'success' },
}

export const buybackStatusMap: Record<string, StatusDef> = {
  received:         { label: 'Received',       tone: 'info' },
  applied:          { label: 'Applied',        tone: 'success' },
  pending_refining: { label: 'Refining',       tone: 'warning' },
  refined:          { label: 'Refined',        tone: 'success' },
  voided:           { label: 'Voided',         tone: 'muted' },
}

export const schemeEnrollmentStatusMap: Record<string, StatusDef> = {
  active:    { label: 'Active',    tone: 'info' },
  matured:   { label: 'Matured',   tone: 'brand' },
  redeemed:  { label: 'Redeemed',  tone: 'success' },
  defaulted: { label: 'Defaulted', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'muted' },
  closed:    { label: 'Closed',    tone: 'neutral' },
}