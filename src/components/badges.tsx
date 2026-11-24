import { Badge } from "@/components/ui";
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_TONE,
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_TONE,
  WORK_ORDER_STATUS_LABELS,
  WORK_ORDER_STATUS_TONE,
  type AppointmentStatus,
  type QuoteStatus,
  type WorkOrderStatus,
} from "@/lib/labels";

export function OrderStatusBadge({ status }: { status: WorkOrderStatus }) {
  return <Badge tone={WORK_ORDER_STATUS_TONE[status]}>{WORK_ORDER_STATUS_LABELS[status]}</Badge>;
}

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return <Badge tone={QUOTE_STATUS_TONE[status]}>{QUOTE_STATUS_LABELS[status]}</Badge>;
}

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  return <Badge tone={APPOINTMENT_STATUS_TONE[status]}>{APPOINTMENT_STATUS_LABELS[status]}</Badge>;
}

export function BalanceBadge({ balance, total }: { balance: number; total: number }) {
  if (total <= 0) return <Badge>Sin cargos</Badge>;
  if (balance <= 0) return <Badge tone="green">Pagado</Badge>;
  if (balance < total) return <Badge tone="amber">Abono</Badge>;
  return <Badge tone="red">Pendiente</Badge>;
}
