export type DiscountType = "monto" | "porcentaje";

export interface LineInput {
  quantity: number;
  unit_price: number;
}

export interface Totals {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

/*
 * Aritmética exacta en centavos (BigInt) para coincidir con el tipo numeric de PostgreSQL.
 * Los valores tienen como máximo 2 decimales (cantidad, precio, porcentaje, tasa).
 * round() de PostgreSQL redondea la mitad alejándose de cero; aquí todos los valores son >= 0.
 */
const toHundredths = (n: number) => BigInt(Math.round((Number(n) || 0) * 100));
const roundDiv = (a: bigint, b: bigint) => (a + b / 2n) / b;
const fromCents = (c: bigint) => Number(c) / 100;

function lineCents(line: LineInput): bigint {
  // (q·100)(p·100) está en diezmilésimas; /100 → centavos
  return roundDiv(toHundredths(line.quantity) * toHundredths(line.unit_price), 100n);
}

export function lineTotal(line: LineInput): number {
  return fromCents(lineCents(line));
}

/**
 * Misma fórmula que la base de datos (calc_discount + apply_document_totals).
 * Se usa para la vista previa en pantalla; el valor oficial lo calcula PostgreSQL.
 */
export function calcTotals(lines: LineInput[], discountType: DiscountType, discountValue: number, taxRate: number): Totals {
  const sub = lines.reduce((s, l) => s + lineCents(l), 0n);
  let value = toHundredths(Math.max(Number(discountValue) || 0, 0));
  let disc: bigint;
  if (discountType === "porcentaje") {
    if (value > 10000n) value = 10000n; // máximo 100%
    disc = roundDiv(sub * value, 10000n);
  } else {
    disc = value < sub ? value : sub;
  }
  const tax = roundDiv((sub - disc) * toHundredths(Math.max(Number(taxRate) || 0, 0)), 10000n);
  return { subtotal: fromCents(sub), discount: fromCents(disc), tax: fromCents(tax), total: fromCents(sub - disc + tax) };
}
