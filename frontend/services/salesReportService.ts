import { authFormFetch } from "./apiClient";

export type SalesReportPropertyType =
  | "Arsa"
  | "Tarla"
  | "Köy içi"
  | "Ticari";

export async function submitSalesReport(form: {
  city_name?: string;
  town_name?: string;
  mahalle: string;
  ada: string;
  parsel: string;
  sale_price?: string | number;
  area_m2?: string | number;
  property_type_value?: SalesReportPropertyType | string;
  deed_fee_receipt: { uri: string; name?: string; type?: string };
}): Promise<{ ok: true; id: number; status: string } | { ok: false; error: string }> {
  const fd = new FormData();
  if (form.city_name) fd.append("city_name", form.city_name);
  if (form.town_name) fd.append("town_name", form.town_name);
  fd.append("mahalle", form.mahalle);
  fd.append("ada", form.ada);
  fd.append("parsel", form.parsel);
  if (form.sale_price != null && String(form.sale_price).trim() !== "") {
    fd.append("sale_price", String(form.sale_price));
  }
  if (form.property_type_value) {
    fd.append("property_type_value", String(form.property_type_value));
  }

  const reviewParts: string[] = [];
  if (form.area_m2 != null && String(form.area_m2).trim() !== "") {
    reviewParts.push(`Parsel alanı: ${String(form.area_m2).trim()} m²`);
  }
  if (form.property_type_value) {
    reviewParts.push(`Nitelik: ${form.property_type_value}`);
  }
  if (reviewParts.length) {
    fd.append("review_notes", reviewParts.join(" | "));
  }

  fd.append("user_confirmed", "1");
  fd.append("deed_fee_receipt", {
    uri: form.deed_fee_receipt.uri,
    name: form.deed_fee_receipt.name || "receipt.jpg",
    type: form.deed_fee_receipt.type || "image/jpeg",
  } as unknown as Blob);

  const res = await authFormFetch<{ success: boolean; id: number; status: string; error?: string }>(
    "/api/sales-report/",
    fd
  );
  if (!res.ok) return { ok: false, error: res.error };
  if (res.data?.success) return { ok: true, id: res.data.id, status: res.data.status };
  return { ok: false, error: res.data?.error || "İşlem başarısız" };
}
