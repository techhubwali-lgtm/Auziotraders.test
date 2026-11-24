export type CurrencyCode = string;

export type PersistedUserRole =
  | 'customer'
  | 'dealer'
  | 'sales'
  | 'sales_manager'
  | 'accounts'
  | 'operations'
  | 'hr'
  | 'it'
  | 'management'
  | 'admin';

export type UserRole = 'visitor' | PersistedUserRole;

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'export';

export type AdminModuleKey =
  | 'dashboard'
  | 'crm'
  | 'sales'
  | 'inventory'
  | 'auctions'
  | 'orders'
  | 'logistics'
  | 'accounts'
  | 'banking'
  | 'hr'
  | 'documents'
  | 'reports'
  | 'cms'
  | 'ai'
  | 'users'
  | 'settings';

export type RolePermissionsMap = Partial<Record<AdminModuleKey, PermissionAction[]>>;

export type LoginPortalType = 'customer' | 'staff';

export type ListingType = 'auzio_stock' | 'auction_listing' | 'partner_stock';

export type ShippingMethod = 'roro' | 'container_20ft' | 'container_40ft';

export type VehicleStatus = 'available' | 'reserved' | 'sold' | 'archived';

export type FuelType = 'Petrol' | 'Diesel' | 'Hybrid' | 'Electric';

export type TransmissionType = 'Automatic' | 'Manual' | 'CVT';

export type DrivetrainType = '2WD' | '4WD' | 'AWD';

export type SteeringType = 'RHD' | 'LHD';

export type BodyType =
  | 'SUV'
  | 'Pickup'
  | 'Sedan'
  | 'Hatchback'
  | 'Van'
  | 'Coupe'
  | 'Wagon';

export type OriginPort = 'Yokohama' | 'Nagoya' | 'Kobe' | 'Osaka' | 'Hakata';

export type ShippingRegion =
  | 'East & Central Africa'
  | 'Southern Africa'
  | 'Oceania'
  | 'Caribbean'
  | 'UK & Middle East';

export type TradeOrderMilestone =
  | 'request_received'
  | 'options_prepared'
  | 'quotation_sent'
  | 'customer_approved'
  | 'bid_placed'
  | 'vehicle_purchased'
  | 'payment_pending'
  | 'payment_received'
  | 'vehicle_in_yard'
  | 'export_docs_ready'
  | 'shipment_booked'
  | 'shipped'
  | 'arrived_port'
  | 'completed';

export type OrderMilestone =
  | 'received'
  | 'proforma_issued'
  | 'deposit_confirmed'
  | 'inspection_passed'
  | 'vessel_booked'
  | 'shipped'
  | 'cancelled';

export type BodyPanelKey =
  | 'frontBumper'
  | 'hood'
  | 'roof'
  | 'rearBumper'
  | 'frontLeftFender'
  | 'frontLeftDoor'
  | 'rearLeftDoor'
  | 'rearLeftQuarter'
  | 'frontRightFender'
  | 'frontRightDoor'
  | 'rearRightDoor'
  | 'rearRightQuarter';

export interface MechanicalStatus {
  engine: string;
  transmission: string;
  suspension: string;
  airConditioning: string;
  frame: string;
}

export interface AuctionReport {
  exteriorGrade: string;
  interiorGrade: string;
  auctionHouse: string;
  lotNumber: string;
  inspectionDate: string;
  inspectorNotes: string;
  mechanicalStatus: MechanicalStatus;
  panelMarks: Partial<Record<BodyPanelKey, string>>;
}

export type AuctionFeedTable = 'main' | 'stats';

export interface AuctionSourceMeta {
  provider: 'auc.auziotraders.com' | 'ajes_api';
  table?: AuctionFeedTable;
  externalLotId: string;
  lotNumber: string;
  auctionHouse: string;
  auctionDate: string;
  auctionTime?: string;
  auctionStatus?: string;
  rawStartPriceJpy: number;
  rawAvgPriceJpy: number;
  rawFinishPriceJpy: number;
  priceBasis: 'start' | 'average' | 'finish' | 'estimated';
  powerHp?: string;
  equipmentRaw?: string;
  inspectorRawInfo?: string;
  auctionSheetUrl?: string;
  fullImageUrls?: string[];
  thumbnailUrls?: string[];
  sourceUrl: string;
}

export interface Vehicle {
  id: string;
  stockCode: string;
  listingType: ListingType;
  auctionDate: string;
  make: string;
  model: string;
  trim: string;
  year: number;
  chassisCode: string;
  mileageKm: number;
  engineCc: number;
  fuelType: FuelType;
  transmission: TransmissionType;
  drivetrain: DrivetrainType;
  steering: SteeringType;
  exteriorColor: string;
  bodyType: BodyType;
  originPort: OriginPort;
  volumeM3: number;
  fobPriceUsd: number;
  status: VehicleStatus;
  featured: boolean;
  images: string[];
  features: string[];
  auctionReport: AuctionReport;
  auctionSourceMeta?: AuctionSourceMeta;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface LiveAuctionMakeOption {
  id: string;
  name: string;
  modelCount: number;
  totalLots: number;
}

export interface LiveAuctionModelOption {
  makeId: string;
  name: string;
  count: number;
}

export interface LiveAuctionHouseOption {
  name: string;
  count: number;
}

export interface LiveAuctionMetaResponse {
  ok: boolean;
  source: string;
  mode: 'live_proxy' | 'ajes_api' | 'unavailable';
  makes: LiveAuctionMakeOption[];
  modelsByMake: Record<string, LiveAuctionModelOption[]>;
  auctions?: LiveAuctionHouseOption[];
  totalEstimatedLots: number;
  syncedAt: string;
  cached: boolean;
  message?: string;
}

export interface LiveAuctionSearchResponse {
  ok: boolean;
  source: string;
  mode: 'live_proxy' | 'ajes_api' | 'unavailable';
  table?: AuctionFeedTable;
  totalMatches: number;
  page: number;
  pageSize: number;
  totalPages: number;
  items: Vehicle[];
  syncedAt: string;
  cached: boolean;
  message?: string;
}

export interface LiveAuctionLotDetailResponse {
  ok: boolean;
  lotId: string;
  table?: AuctionFeedTable;
  mode?: 'live_proxy' | 'ajes_api' | 'unavailable';
  images: string[];
  fullImages: string[];
  thumbnails: string[];
  auctionSheetUrl?: string;
  vehicle?: Vehicle;
  sourceUrl: string;
  cached?: boolean;
  message?: string;
}

export interface LiveAuctionStatusResponse {
  ok: boolean;
  source: string;
  mode: 'live_proxy' | 'ajes_api' | 'unavailable';
  reachable: boolean;
  ajesApiConfigured: boolean;
  makesCount: number;
  totalEstimatedLots: number;
  checkedAt: string;
  message: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: PersistedUserRole;
  department?: string;
  permissions?: RolePermissionsMap;
  companyName: string;
  country: string;
  defaultPortId: string;
  phone: string;
  consigneeAddress: string;
  assignedRepName: string;
  assignedRepEmail: string;
  verified: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SourcingOption {
  id: string;
  title: string;
  auctionHouse: string;
  lotNumber: string;
  grade: string;
  mileageKm: number;
  estFobUsd: number;
  translatedNotes: string;
}

export interface SourcingRequest {
  id: string;
  requestCode: string;
  customerId: string;
  customerName: string;
  customerCompany: string;
  assignedStaffId: string;
  assignedStaffName: string;
  make: string;
  model: string;
  yearMin: number;
  yearMax: number;
  mileageMaxKm: number;
  gradePref: string;
  engineCc: string;
  transmission: string;
  fuelType: string;
  colorPref: string;
  quantity: number;
  maxBudgetUsd: number;
  budgetCurrency: CurrencyCode;
  destinationCountry: string;
  destinationPortId: string;
  sourcingChannel: 'auction' | 'stock' | 'either';
  referenceLinks: string;
  notes: string;
  maxBidAcknowledged: boolean;
  status: 'new' | 'options_sent' | 'quoted' | 'approved' | 'closed';
  options: SourcingOption[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Quotation {
  id: string;
  quoteNumber: string;
  sourcingRequestId: string;
  vehicleId: string;
  vehicleTitle: string;
  stockCode: string;
  customerId: string;
  customerName: string;
  customerCompany: string;
  preparedByStaffId: string;
  preparedByName: string;
  destinationPortId: string;
  destinationPortName: string;
  currency: CurrencyCode;
  fobVehicleUsd: number;
  auctionFeeUsd: number;
  exportDocsUsd: number;
  jevicInspectionUsd: number;
  seaFreightUsd: number;
  marineInsuranceUsd: number;
  totalCifUsd: number;
  authorizedMaxBidUsd: number;
  status: 'draft' | 'sent' | 'approved' | 'declined' | 'expired';
  approvedAt: string;
  approvedByUid: string;
  declineReason: string;
  validUntil: string;
  notes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ExportOrder {
  id: string;
  orderNumber: string;
  trackingCode: string;
  quotationId: string;
  customerId: string;
  customerName: string;
  customerCompany: string;
  vehicleId: string;
  vehicleStockCode: string;
  vehicleTitle: string;
  listingType: ListingType;
  destinationCountry: string;
  destinationPortId: string;
  destinationPortName: string;
  shippingMethod: ShippingMethod;
  fobUsd: number;
  freightUsd: number;
  inspectionUsd: number;
  insuranceUsd: number;
  totalCifUsd: number;
  currency: CurrencyCode;
  authorizedMaxBidUsd: number;
  placedBidUsd: number;
  milestone: TradeOrderMilestone;
  vesselName: string;
  voyageNumber: string;
  blNumber: string;
  etdDate: string;
  etaDate: string;
  scheduleIsEstimate: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface OrderMessage {
  id: string;
  orderId: string;
  customerId: string;
  senderUid: string;
  senderName: string;
  senderRole: PersistedUserRole;
  body: string;
  isInternalStaffOnly: boolean;
  createdAt?: unknown;
}

export type ExportDocType =
  | 'proforma_invoice'
  | 'export_certificate'
  | 'bill_of_lading'
  | 'auction_sheet'
  | 'inspection_report'
  | 'commercial_invoice'
  | 'internal_cost_sheet';

export interface ExportDocument {
  id: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  title: string;
  docType: ExportDocType;
  fileName: string;
  fileUrl: string;
  isCustomerVisible: boolean;
  uploadedByName: string;
  notes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AuditLogEntry {
  id: string;
  actorUid: string;
  actorEmail: string;
  actorRole: UserRole;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  createdAt?: unknown;
}

export interface ShippingPort {
  id: string;
  unLocode?: string;
  name: string;
  country: string;
  countryCode?: string;
  region: ShippingRegion | string;
  corridorNote?: string;
  rateAvailable?: boolean;
  roroRatePerM3Usd: number;
  container20ftUsd: number;
  container40ftUsd: number;
  inspectionName: string;
  inspectionFeeUsd: number;
  transitDaysMin: number;
  transitDaysMax: number;
}

export interface WorldPortOption {
  id: string;
  unLocode: string;
  name: string;
  countryCode: string;
  countryName: string;
  region: string;
  rateAvailable: boolean;
  verifiedPortId?: string;
  corridorNote?: string;
}

export interface WorldCountryOption {
  code: string;
  name: string;
  region: string;
  supportedShipping: boolean;
  ports: WorldPortOption[];
}

export interface LiveExchangeRateState {
  ok: boolean;
  loading: boolean;
  base: 'USD';
  rates: Record<string, number>;
  updatedAt: string | null;
  provider: string;
  message?: string;
}

export interface CifBreakdown {
  fobUsd: number;
  freightUsd: number;
  inspectionUsd: number;
  inspectionLabel: string;
  insuranceUsd: number;
  totalCifUsd: number;
  transitDaysRange: string;
  port: ShippingPort;
  shippingMethod: ShippingMethod;
  includeInsurance: boolean;
  rateAvailable?: boolean;
}

export interface Inquiry {
  id: string;
  trackingCode: string;
  type: 'inquiry' | 'reservation';
  vehicleId: string;
  vehicleStockCode: string;
  vehicleTitle: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  buyerCountry: string;
  destinationPortId: string;
  destinationPortName: string;
  shippingMethod: ShippingMethod;
  includeInsurance: boolean;
  fobPriceUsd: number;
  freightUsd: number;
  inspectionUsd: number;
  insuranceUsd: number;
  quotedCifUsd: number;
  currency: CurrencyCode;
  message: string;
  status: OrderMilestone;
  vesselName: string;
  etaDate: string;
  adminNotes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface OrderStatusRecord {
  trackingCode: string;
  inquiryId: string;
  vehicleStockCode: string;
  vehicleTitle: string;
  destinationPortName: string;
  shippingMethod: ShippingMethod;
  quotedCifUsd: number;
  currency: CurrencyCode;
  milestone: string;
  vesselName: string;
  etaDate: string;
  publicNote: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ExchangeRates {
  JPY: number;
  EUR: number;
  AUD: number;
  GBP: number;
  KES: number;
  ZAR: number;
  NZD: number;
  CAD: number;
  [isoCode: string]: number;
}

export interface CompanySettings {
  companyName: string;
  tagline: string;
  officeAddress: string;
  supportEmail: string;
  whatsappPhone: string;
  bankName: string;
  bankBranch: string;
  accountName: string;
  accountNumber: string;
  swiftCode: string;
  bankAddress: string;
  invoiceValidityDays: number;
  exchangeRates: ExchangeRates;
  updatedAt?: unknown;
}

export interface CompanyStatItem {
  id: string;
  value: number | null;
  suffix: string;
  displayText?: string;
  label: string;
  sublabel: string;
}

export interface LandingServiceItem {
  id: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaTarget: 'catalog' | 'live_auctions' | 'sourcing' | 'shipping' | 'contact' | 'how_to_buy';
  imageKey: 'auction' | 'inspection' | 'shipping' | 'yard';
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface CustomerTestimonial {
  id: string;
  customerName: string;
  country: string;
  vehiclePurchased: string;
  photoUrl: string;
  rating: number;
  reviewText: string;
  verified: boolean;
  approved: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface LandingPageContent {
  promoBannerEnabled: boolean;
  promoBannerText: string;
  promoBannerCtaLabel: string;
  heroHeadline: string;
  heroSecondaryHeadline: string;
  heroDescription: string;
  heroProblemSolution: string;
  heroImageUrl: string;
  stats: CompanyStatItem[];
  services: LandingServiceItem[];
  aboutHeadline: string;
  aboutIntro: string;
  aboutMission: string;
  aboutTransparency: string;
  aboutImageUrl: string;
  faqs: FaqItem[];
  contactPhone: string;
  contactWhatsapp: string;
  contactEmail: string;
  contactAddress: string;
  socialLinks: {
    facebook: string;
    instagram: string;
    youtube: string;
    linkedin: string;
  };
  seoTitle: string;
  seoDescription: string;
  updatedAt?: unknown;
}

export interface QuickSearchCriteria {
  make?: string;
  model?: string;
  yearMin?: string;
  yearMax?: string;
  priceRange?: string;
  bodyType?: string;
  fuel?: string;
  transmission?: string;
  mileageMax?: string;
  steering?: string;
  stockType?: 'ALL' | 'auzio_stock' | 'live_auctions' | 'partner_stock';
}

export type AppView =
  | 'home'
  | 'catalog'
  | 'shipping'
  | 'how_to_buy'
  | 'track'
  | 'customer_portal'
  | 'staff_console';

export interface ProformaDraft {
  invoiceNumber: string;
  issueDate: string;
  validUntilDate: string;
  vehicle: Vehicle;
  cif: CifBreakdown;
  currency: CurrencyCode;
  consigneeName: string;
  consigneeAddress: string;
  consigneePhone: string;
  consigneeEmail: string;
  trackingCode?: string;
}

// =============================================================================
// Enterprise Admin Console Modules (Accounts, HR, Tasks, Messaging, Targets)
// =============================================================================

export type FinanceRecordType = 'invoice' | 'payment' | 'expense';
export type FinanceRecordStatus = 'paid' | 'pending' | 'overdue' | 'reconciled';

export interface FinanceRecord {
  id: string;
  type: FinanceRecordType;
  referenceCode: string;
  orderId: string;
  orderNumber: string;
  counterpartyName: string;
  category: string;
  amountUsd: number;
  currency: CurrencyCode;
  status: FinanceRecordStatus;
  reconciled: boolean;
  transactionDate: string;
  notes: string;
  createdByUid: string;
  createdByName: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface HrEmployee {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  phone: string;
  department: string;
  jobTitle: string;
  status: 'active' | 'on_leave' | 'inactive';
  baseSalaryUsd: number;
  commissionRatePct: number;
  attendanceDaysThisMonth: number;
  leaveDaysRemaining: number;
  performanceRating: number;
  joinedDate: string;
  notes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface HrLeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  leaveType: 'annual' | 'sick' | 'personal' | 'unpaid';
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedByName: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TeamTask {
  id: string;
  title: string;
  description: string;
  department: string;
  assignedToName: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'todo' | 'in_progress' | 'review' | 'done';
  dueDate: string;
  createdByUid: string;
  createdByName: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type TeamChannelId = 'general' | 'sales' | 'operations' | 'accounts' | 'management';

export interface TeamChannelMessage {
  id: string;
  channel: TeamChannelId;
  senderUid: string;
  senderName: string;
  senderRole: PersistedUserRole;
  body: string;
  createdAt?: unknown;
}

export interface SalesTarget {
  id: string;
  staffName: string;
  staffEmail: string;
  period: string;
  targetRevenueUsd: number;
  achievedRevenueUsd: number;
  targetUnits: number;
  soldUnits: number;
  commissionRatePct: number;
  notes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}
