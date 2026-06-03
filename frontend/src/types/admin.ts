export type AdminPendingCounts = {
  pending_graduation_count?: number;
  pending_image_count?: number;
  pending_havale_payments_count?: number;
  pending_sales_report_count?: number;
  pending_ai_drone_requests_count?: number;
};

export type AdminUserListItem = {
  id: number;
  email: string;
  phone_number: string;
  customer_type: string;
  customer_type_display: string;
  role: string;
  role_display: string;
  is_active: boolean;
  balance: number;
  created_at: string;
};

export type AdminUserDetail = AdminUserListItem & {
  total_purchased: number;
  total_used: number;
  first_name: string;
  last_name: string;
  company_name: string;
};

export type AdminImageApprovalItem = {
  profile_id: number;
  is_mongo_profile: boolean;
  image_type: "avatar" | "logo";
  user_email: string;
  user_name: string;
  pending_image_url: string | null;
  current_image_url: string | null;
  uploaded_at: string;
};

export type AdminGraduationItem = {
  id: number;
  user_email: string;
  user_name: string;
  education_level: string;
  university: string;
  department: string;
  diploma_file_url: string | null;
  is_verified: boolean;
  rejection_reason: string;
  created_at: string;
};

export type AdminHavalePaymentItem = {
  id: number;
  user_id: number;
  user_email: string;
  payment_reference: string;
  package_code: string;
  amount: number;
  payment_status: string;
  ai_auto_approved?: boolean;
  ai_review_required?: boolean;
  ai_confidence_score?: number | null;
  created_at: string;
  receipt_url?: string;
  admin_note?: string;
};

export type AdminSalesReportItem = {
  id: number;
  user_id: number;
  city_name: string;
  town_name: string;
  quarter_name: string;
  mahalle: string;
  ada: string;
  parsel: string;
  sale_price: string | null;
  status: string;
  review_notes: string;
  deed_fee_receipt_url: string | null;
  created_at: string;
};

export type AdminAiDroneItem = {
  id: number;
  status: string;
  status_display: string;
  requester_id: number;
  requester_email: string;
  requester_name: string;
  user_note: string;
  tkgm_summary: string;
  created_at: string;
};

export type AdminAiDroneStats = {
  total: number;
  pending_routing: number;
  assigned: number;
  editor_delivered: number;
  closed: number;
  pending_count: number;
};
