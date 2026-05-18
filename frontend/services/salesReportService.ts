import { authFormFetch } from "./apiClient";

export async function submitSalesReport(form: {
  city_name?: string;
  town_name?: string;
  mahalle: string;
  ada: string;
  parsel: string;
  deed_fee_receipt: any; // RN file object
}): Promise<{ ok: true; id: number; status: string } | { ok: false; error: string }> {
  const fd = new FormData();
  if (form.city_name) fd.append("city_name", form.city_name);
  if (form.town_name) fd.append("town_name", form.town_name);
  fd.append("mahalle", form.mahalle);
  fd.append("ada", form.ada);
  fd.append("parsel", form.parsel);
  fd.append("deed_fee_receipt", form.deed_fee_receipt);

  const res = await authFormFetch<{ success: boolean; id: number; status: string; error?: string }>(
    "/api/sales-report/",
    fd
  );
  if (!res.ok) return { ok: false, error: res.error };
  if (res.data?.success) return { ok: true, id: res.data.id, status: res.data.status };
  return { ok: false, error: res.data?.error || "İşlem başarısız" };
}

