import { authJsonFetch } from "./apiClient";
import type {
  AdminAiDroneItem,
  AdminAiDroneStats,
  AdminGraduationItem,
  AdminHavalePaymentItem,
  AdminImageApprovalItem,
  AdminPendingCounts,
  AdminSalesReportItem,
  AdminUserDetail,
  AdminUserListItem,
} from "../src/types/admin";

type ListResponse<T> = { success: boolean; error?: string } & T;

export async function fetchAdminPendingCounts() {
  return authJsonFetch<{ success: boolean; counts: AdminPendingCounts }>("/api/admin/pending-counts/");
}

export async function fetchAdminUsers(params: {
  search?: string;
  customer_type?: string;
  role?: string;
  page?: number;
  page_size?: number;
}) {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.customer_type) qs.set("customer_type", params.customer_type);
  if (params.role) qs.set("role", params.role);
  if (params.page) qs.set("page", String(params.page));
  if (params.page_size) qs.set("page_size", String(params.page_size));
  const q = qs.toString();
  return authJsonFetch<ListResponse<{ items: AdminUserListItem[]; total: number; page: number; page_size: number }>>(
    q ? `/api/admin/users/?${q}` : "/api/admin/users/"
  );
}

export async function fetchAdminUserDetail(userId: number) {
  return authJsonFetch<{ success: boolean; user: AdminUserDetail }>(`/api/admin/users/${userId}/`);
}

export async function addAdminUserCredit(userId: number, amount: number, notes?: string) {
  return authJsonFetch<{ success: boolean; message?: string; new_balance?: number; error?: string }>(
    `/api/admin/users/${userId}/credit/`,
    { method: "POST", json: { amount, notes: notes || "" } }
  );
}

export async function fetchImageApprovals() {
  return authJsonFetch<{ success: boolean; images: AdminImageApprovalItem[]; pending_count: number }>(
    "/api/admin/image-approvals/"
  );
}

export async function imageApprovalAction(payload: {
  profile_id: number;
  image_type: "avatar" | "logo";
  action: "approve" | "reject";
  rejection_reason?: string;
  is_mongo_profile?: boolean;
}) {
  return authJsonFetch<{ success: boolean; message?: string; error?: string }>(
    "/api/admin/image-approvals/action/",
    {
      method: "POST",
      json: {
        ...payload,
        mongo_profile: payload.is_mongo_profile ? "1" : "0",
      },
    }
  );
}

export async function fetchGraduationApprovals(status: string = "pending") {
  return authJsonFetch<{ success: boolean; graduations: AdminGraduationItem[]; pending_count: number }>(
    `/api/admin/graduation-approvals/?status=${encodeURIComponent(status)}`
  );
}

export async function graduationApprovalAction(payload: {
  graduation_id: number;
  action: "approve" | "reject";
  rejection_reason?: string;
}) {
  return authJsonFetch<{ success: boolean; message?: string; error?: string }>(
    "/api/admin/graduation-approvals/action/",
    { method: "POST", json: payload }
  );
}

export async function fetchHavalePayments(params: {
  status?: string;
  q?: string;
  page?: number;
  manual_review?: boolean;
}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.q) qs.set("q", params.q);
  if (params.page) qs.set("page", String(params.page));
  if (params.manual_review) qs.set("manual_review", "1");
  const q = qs.toString();
  return authJsonFetch<ListResponse<{ items: AdminHavalePaymentItem[]; total: number; page: number }>>(
    q ? `/api/admin/havale/payments/?${q}` : "/api/admin/havale/payments/"
  );
}

export async function fetchHavalePaymentDetail(paymentRequestId: number) {
  return authJsonFetch<{
    success: boolean;
    payment: AdminHavalePaymentItem;
    audit_logs: Array<{ created_at: string; action: string; old_status: string; new_status: string; note: string }>;
  }>(`/api/admin/havale/payments/${paymentRequestId}/`);
}

export async function havalePaymentAction(
  paymentRequestId: number,
  action: "approve" | "reject" | "revision",
  adminNote: string
) {
  return authJsonFetch<{ success: boolean; message?: string; error?: string }>(
    `/api/admin/havale/payments/${paymentRequestId}/${action}/`,
    { method: "POST", json: { admin_note: adminNote } }
  );
}

export async function fetchSalesReports(status: string = "submitted") {
  return authJsonFetch<{ success: boolean; items: AdminSalesReportItem[] }>(
    `/api/admin/sales-report/?status=${encodeURIComponent(status)}`
  );
}

export async function approveSalesReport(reportId: number, reviewNotes?: string) {
  return authJsonFetch<{ success: boolean; error?: string }>(
    `/api/admin/sales-report/${reportId}/approve/`,
    { method: "POST", json: { review_notes: reviewNotes || "" } }
  );
}

export async function rejectSalesReport(reportId: number, reviewNotes?: string) {
  return authJsonFetch<{ success: boolean; error?: string }>(
    `/api/admin/sales-report/${reportId}/reject/`,
    { method: "POST", json: { review_notes: reviewNotes || "" } }
  );
}

export async function fetchAiDroneRequests(params: { status?: string; q?: string; page?: number }) {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.q) qs.set("q", params.q);
  if (params.page) qs.set("page", String(params.page));
  const q = qs.toString();
  return authJsonFetch<ListResponse<{ items: AdminAiDroneItem[]; stats: AdminAiDroneStats; total: number }>>(
    q ? `/api/admin/ai-drone-requests/?${q}` : "/api/admin/ai-drone-requests/"
  );
}
