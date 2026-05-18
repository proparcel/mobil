export type ExpertRequestStatus =
  | "PENDING"
  | "IN_REVIEW"
  | "ANSWERED"
  | "CANCELLED"
  | "EXPIRED_REFUNDED"
  | "CLOSED"
  | "ROUTING_FAILED";

export type RequestKind =
  | "expert_request"
  | "map_operation_request"
  | "spk_valuation_request";

export type ExpertPersonDTO = {
  userId: number | null;
  fullName: string | null;
  profilePhotoUrl: string | null;
  companyName?: string | null;
  isExpert?: boolean;
  expertBadgeLabel?: string | null;
  expertScoreCurrent?: number | null;
  expertLevel?: "first_experience" | "advisor" | "bronze" | "silver" | "gold" | "platinum" | null;
  rating?: number | null;
  ratingCount?: number | null;
};

export type ClaimedExpertDTO = {
  userId: number;
  fullName: string;
  profilePhotoUrl: string | null;
  companyName: string | null;
  expertBadgeLabel: string | null;
  hasResponded: boolean;
  respondedAt: string | null;
};

export type ExpertLocationDTO = {
  cityName?: string | null;
  districtName?: string | null;
  neighborhoodName?: string | null;
  ada?: string | null;
  parsel?: string | null;
  neighborhoodValue?: number;
};

export type ProQueryParams = {
  mahalle: number | null;
  ada: string | null;
  parsel: string | null;
};

export type ExpertRequestListItem = {
  id: number;
  requestKind?: RequestKind;
  requestKindLabel?: string;
  status: ExpertRequestStatus;
  createdAt: string;
  lastActivityAt?: string | null;
  noteSnippet: string;
  unreadForMe: boolean;
  location: ExpertLocationDTO;
  requester: {
    userId: number | null;
    fullName: string | null;
    profilePhotoUrl: string | null;
    companyName?: string | null;
  };
  // mine mode
  assignedExpert?: ExpertPersonDTO | null;
  // incoming mode
  person?: ExpertPersonDTO | null;
  // Kart üzerinde gösterilecek kişi (backend'den hesaplanır)
  cardPerson?: ExpertPersonDTO | null;
  feeCoin: number;
  refundEligibleAt?: string | null;
  refundedAt?: string | null;
  sourceReportId?: string | null;
  // Pro query params for viewing report
  proQueryParams?: ProQueryParams | null;
  queryUrl?: string | null;
  // Kayıtlı sorgu bilgisi (mine mode için)
  hasSavedQuery?: boolean;
  savedQueryId?: number | null;
  // İlgilenen / üstlenen uzmanlar listesi
  claimedExperts?: ClaimedExpertDTO[];
  canViewReport?: boolean;
  canRespond?: boolean;
  routingMode?: "single_route" | "fan_out_multi_recipient" | null;
  recipientCount?: number;
  requestAttachments?: string[];
};

export type ExpertRequestDetail = {
  id: number;
  requestKind?: RequestKind;
  requestKindLabel?: string;
  status: ExpertRequestStatus;
  createdAt: string;
  lastActivityAt?: string | null;
  note?: string | null;
  location: ExpertLocationDTO;
  feeCoin: number;
  refundEligibleAt?: string | null;
  chargedAt?: string | null;
  refundedAt?: string | null;
  answeredAt?: string | null;
  sourceReportId?: string | null;
  requester: ExpertPersonDTO;
  assignedExpert?: ExpertPersonDTO | null;
  requestAttachments?: string[];
  response?: { responseText: string; approvedAt?: string | null; pdfUrl?: string | null; attachments?: string[] } | null;
  responses?: Array<{
    id: number;
    responseText: string;
    createdAt?: string | null;
    expert?: ExpertPersonDTO | null;
    attachments?: string[];
  }>;
  permissions?: {
    canClaim?: boolean;
    canRespond?: boolean;
    canViewPdf?: boolean;
    canViewReport?: boolean;
    canUpdateStatus?: boolean;
    isRequester?: boolean;
  } | null;
  // Pro query params for viewing report
  proQueryParams?: ProQueryParams | null;
  queryUrl?: string | null;
  // Kayıtlı sorgu bilgisi (mine mode için)
  hasSavedQuery?: boolean;
  savedQueryId?: number | null;
  routingMode?: "single_route" | "fan_out_multi_recipient" | null;
  recipientCount?: number;
};

export type ExpertBadgeCounts = {
  unreadIncomingCount: number;
  unreadMyRepliesCount: number;
  breakdown?: {
    expert?: { incoming: number; mine: number };
    mapOperation?: { incoming: number; mine: number };
    spkValuation?: { incoming: number; mine: number };
  };
};

