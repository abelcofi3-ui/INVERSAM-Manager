import "server-only";
import { createClient } from "@/lib/supabase/server";
import { vehicleLabel } from "@/lib/labels";
import type { CustomerOption, VehicleOption } from "@/components/pickers";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Opciones para selectores de cliente/vehículo. */
export async function loadCustomerVehicleOptions(supabase: Supabase) {
  const [{ data: customers }, { data: vehicles }] = await Promise.all([
    supabase.from("customers").select("id, full_name, phone").order("full_name").limit(5000),
    supabase.from("vehicles").select("id, customer_id, brand, model, year, plate, mileage").limit(10000),
  ]);
  return {
    customers: (customers ?? []) as CustomerOption[],
    vehicles: (vehicles ?? []).map((v) => ({
      id: v.id,
      customer_id: v.customer_id,
      label: vehicleLabel(v),
      mileage: v.mileage,
    })) as VehicleOption[],
  };
}

export async function loadTechnicians(supabase: Supabase) {
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("active", true)
    .in("role", ["mecanico", "admin"])
    .order("full_name");
  return (data ?? []).map((t) => ({ value: t.id as string, label: t.full_name as string }));
}

export async function loadServices(supabase: Supabase) {
  const { data } = await supabase
    .from("services")
    .select("id, name, price, estimated_minutes")
    .eq("active", true)
    .order("name");
  return (data ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    price: Number(s.price),
    estimated_minutes: s.estimated_minutes as number | null,
  }));
}

export async function loadSettings(supabase: Supabase) {
  const { data } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
  return {
    business_name: (data?.business_name as string) ?? "INVERSAM",
    legal_name: (data?.legal_name as string | null) ?? null,
    rtn: (data?.rtn as string | null) ?? null,
    address: (data?.address as string | null) ?? null,
    phone: (data?.phone as string | null) ?? null,
    email: (data?.email as string | null) ?? null,
    tax_label: (data?.tax_label as string) ?? "ISV",
    tax_rate: Number(data?.tax_rate ?? 15),
    quote_validity_days: Number(data?.quote_validity_days ?? 15),
    document_footer: (data?.document_footer as string | null) ?? null,
  };
}

export type BusinessSettings = Awaited<ReturnType<typeof loadSettings>>;
