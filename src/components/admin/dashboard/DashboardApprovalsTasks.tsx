import {
  BellRing,
  Building2,
  Calendar,
  Car,
  Check,
  CheckCircle2,
  CheckSquare,
  ClipboardCheck,
  CreditCard,
  Edit3,
  FileBarChart2,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  Gavel,
  Globe,
  Megaphone,
  MessageSquarePlus,
  PackagePlus,
  Plus,
  Receipt,
  ShieldAlert,
  Ship,
  Upload,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatMoney } from '../../../data/ports';
import type {
  CurrencyCode,
  CustomerTestimonial,
  ExportOrder,
  FinanceRecord,
  HrEmployee,
  HrLeaveRequest,
  Quotation,
  SourcingRequest,
  TeamTask,
  UserProfile,
} from '../../../types/portal';
import { parseRecordDateMs } from './dashboardMetrics';

export interface ApprovalActionHandlers {
  onApprovePayment: (rec: FinanceRecord) => Promise<void>;
  onRejectPayment: (rec: FinanceRecord, reason: string) => Promise<void>;
  onApproveLeave: (req: HrLeaveRequest) => Promise<void>;
  onRejectLeave: (req: HrLeaveRequest, reason: string) => Promise<void>;
  onApproveCustomerVerification: (user: UserProfile) => Promise<void>;
  onRejectCustomerVerification: (user: UserProfile, reason: string) => Promise<void>;
  onApproveTestimonial: (t: CustomerTestimonial) => Promise<void>;
  onRejectTestimonial: (t: CustomerTestimonial, reason: string) => Promise<void>;
  onConvertApprovedQuote: (q: Quotation) => Promise<void>;
  onRequestApprovalInfo: (title: string, targetRef: string, assignee: string) => Promise<void>;
}

interface DashboardApprovalsTasksProps {
  staffProfile: UserProfile | null;
  currency: CurrencyCode;
  fxRates: Record<string, number>;
  canApproveAccounts: boolean;
  canApproveHr: boolean;
  canApproveUsers: boolean;
  canApproveCms: boolean;
  canConvertSales: boolean;
  financeRecords: FinanceRecord[];
  leaveRequests: HrLeaveRequest[];
  users: UserProfile[];
  quotations: Quotation[];
  sourcingRequests: SourcingRequest[];
  orders: ExportOrder[];
  testimonials: CustomerTestimonial[];
  teamTasks: TeamTask[];
  hrEmployees: HrEmployee[];
  showApprovals: boolean;
  showTasks: boolean;
  showQuickActions: boolean;
  approvalHandlers: ApprovalActionHandlers;
  onCreateTask: (input: Omit<TeamTask, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateTaskDetails: (
    id: string,
    updates: Partial<Pick<TeamTask, 'title' | 'description' | 'department' | 'assignedToName' | 'priority' | 'status' | 'dueDate'>>
  ) => Promise<void>;
  onQuickAction: (actionId: string) => void;
  onNavigateSection: (section: string) => void;
}

interface UnifiedApprovalItem {
  id: string;
  kind: 'payment' | 'leave' | 'customer_kyc' | 'quote_convert' | 'testimonial';
  typeLabel: string;
  reference: string;
  requestedBy: string;
  department: string;
  dateLabel: string;
  priority: 'high' | 'medium' | 'urgent';
  amountUsd?: number;
  details: string;
  status: string;
  raw: FinanceRecord | HrLeaveRequest | UserProfile | Quotation | CustomerTestimonial;
}

export function DashboardApprovalsTasks({
  staffProfile,
  currency,
  fxRates,
  canApproveAccounts,
  canApproveHr,
  canApproveUsers,
  canApproveCms,
  canConvertSales,
  financeRecords,
  leaveRequests,
  users,
  quotations,
  sourcingRequests,
  orders,
  testimonials,
  teamTasks,
  hrEmployees,
  showApprovals,
  showTasks,
  showQuickActions,
  approvalHandlers,
  onCreateTask,
  onUpdateTaskDetails,
  onQuickAction,
  onNavigateSection,
}: DashboardApprovalsTasksProps) {
  const fmt = (usd: number) => formatMoney(usd, currency, fxRates);
  const todayStr = new Date().toISOString().slice(0, 10);

  // Approvals state
  const [approvalFilter, setApprovalFilter] = useState<'ALL' | UnifiedApprovalItem['kind']>('ALL');
  const [busyApprovalId, setBusyApprovalId] = useState<string | null>(null);
  const [rejectModalItem, setRejectModalItem] = useState<UnifiedApprovalItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [detailModalItem, setDetailModalItem] = useState<UnifiedApprovalItem | null>(null);

  // Tasks state
  const [taskTab, setTaskTab] = useState<
    'my' | 'department' | 'pending' | 'overdue' | 'completed' | 'upcoming' | 'reminders'
  >('pending');
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TeamTask | null>(null);
  const [taskDraft, setTaskDraft] = useState({
    title: '',
    description: '',
    department: staffProfile?.department || 'Operations',
    assignedToName: staffProfile?.displayName || '',
    priority: 'medium' as TeamTask['priority'],
    status: 'todo' as TeamTask['status'],
    dueDate: todayStr,
  });
  const [savingTask, setSavingTask] = useState(false);

  // Build real pending approval queue from live Firestore records
  const pendingApprovals = useMemo<UnifiedApprovalItem[]>(() => {
    const items: UnifiedApprovalItem[] = [];

    if (canApproveAccounts) {
      for (const f of financeRecords.filter(
        (r) => (r.type === 'payment' || r.type === 'expense') && (r.status === 'pending' || r.status === 'overdue')
      )) {
        items.push({
          id: `pay-${f.id}`,
          kind: 'payment',
          typeLabel: f.type === 'payment' ? 'Payment Verification' : 'Expense Approval',
          reference: f.referenceCode || f.orderNumber || f.id,
          requestedBy: f.createdByName || f.counterpartyName,
          department: 'Accounts & Finance',
          dateLabel: f.transactionDate || '—',
          priority: f.status === 'overdue' ? 'urgent' : 'high',
          amountUsd: f.amountUsd,
          details: `${f.counterpartyName} · ${f.category}${f.notes ? ` · ${f.notes}` : ''}`,
          status: f.status.toUpperCase(),
          raw: f,
        });
      }
    }

    if (canApproveHr) {
      for (const lv of leaveRequests.filter((l) => l.status === 'pending')) {
        items.push({
          id: `lv-${lv.id}`,
          kind: 'leave',
          typeLabel: 'Employee Leave Request',
          reference: `${lv.leaveType.toUpperCase()} (${lv.days}d)`,
          requestedBy: lv.employeeName,
          department: lv.department || 'HR',
          dateLabel: `${lv.startDate} → ${lv.endDate}`,
          priority: lv.days >= 5 ? 'high' : 'medium',
          details: lv.reason || 'Standard leave request awaiting HR/Super Admin approval.',
          status: 'PENDING',
          raw: lv,
        });
      }
    }

    if (canApproveUsers) {
      for (const u of users.filter((usr) => (usr.role === 'customer' || usr.role === 'dealer') && !usr.verified)) {
        const ms = parseRecordDateMs(u.createdAt);
        items.push({
          id: `kyc-${u.uid}`,
          kind: 'customer_kyc',
          typeLabel: u.role === 'dealer' ? 'Dealer Verification' : 'Customer KYC Approval',
          reference: u.email,
          requestedBy: u.displayName,
          department: 'CRM & Onboarding',
          dateLabel: ms ? new Date(ms).toISOString().slice(0, 10) : 'Pending KYC',
          priority: u.role === 'dealer' ? 'high' : 'medium',
          details: `${u.companyName || 'Individual Buyer'} · ${u.country || 'Unspecified country'} · ${u.phone || 'No phone'}`,
          status: 'UNVERIFIED',
          raw: u,
        });
      }
    }

    if (canConvertSales) {
      const convertedQuoteIds = new Set(orders.map((o) => o.quotationId).filter(Boolean));
      for (const q of quotations.filter((qt) => qt.status === 'approved' && !convertedQuoteIds.has(qt.id))) {
        items.push({
          id: `qt-${q.id}`,
          kind: 'quote_convert',
          typeLabel: 'Order Conversion & Bid Auth',
          reference: q.quoteNumber,
          requestedBy: q.customerName,
          department: 'Sales & Auctions',
          dateLabel: q.approvedAt ? q.approvedAt.slice(0, 10) : q.validUntil,
          priority: 'high',
          amountUsd: q.totalCifUsd,
          details: `${q.vehicleTitle} · Max Bid Authorized: ${fmt(q.authorizedMaxBidUsd)} · Port: ${q.destinationPortName}`,
          status: 'APPROVED QUOTE',
          raw: q,
        });
      }
    }

    if (canApproveCms) {
      for (const t of testimonials.filter((rev) => !rev.approved)) {
        items.push({
          id: `rev-${t.id}`,
          kind: 'testimonial',
          typeLabel: 'Website Review Publication',
          reference: `${t.rating}★ Review`,
          requestedBy: t.customerName,
          department: 'Website CMS',
          dateLabel: t.country,
          priority: 'medium',
          details: `${t.vehiclePurchased}: "${t.reviewText.slice(0, 140)}"`,
          status: 'PENDING CMS',
          raw: t,
        });
      }
    }

    return items;
  }, [
    canApproveAccounts,
    canApproveHr,
    canApproveUsers,
    canApproveCms,
    canConvertSales,
    financeRecords,
    leaveRequests,
    users,
    quotations,
    orders,
    testimonials,
  ]);

  const filteredApprovals = useMemo(
    () =>
      approvalFilter === 'ALL'
        ? pendingApprovals
        : pendingApprovals.filter((a) => a.kind === approvalFilter),
    [pendingApprovals, approvalFilter]
  );

  const handleApprove = async (item: UnifiedApprovalItem) => {
    setBusyApprovalId(item.id);
    try {
      if (item.kind === 'payment') {
        await approvalHandlers.onApprovePayment(item.raw as FinanceRecord);
      } else if (item.kind === 'leave') {
        await approvalHandlers.onApproveLeave(item.raw as HrLeaveRequest);
      } else if (item.kind === 'customer_kyc') {
        await approvalHandlers.onApproveCustomerVerification(item.raw as UserProfile);
      } else if (item.kind === 'quote_convert') {
        await approvalHandlers.onConvertApprovedQuote(item.raw as Quotation);
      } else if (item.kind === 'testimonial') {
        await approvalHandlers.onApproveTestimonial(item.raw as CustomerTestimonial);
      }
    } finally {
      setBusyApprovalId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectModalItem || !rejectReason.trim()) return;
    setBusyApprovalId(rejectModalItem.id);
    try {
      const reason = rejectReason.trim();
      if (rejectModalItem.kind === 'payment') {
        await approvalHandlers.onRejectPayment(rejectModalItem.raw as FinanceRecord, reason);
      } else if (rejectModalItem.kind === 'leave') {
        await approvalHandlers.onRejectLeave(rejectModalItem.raw as HrLeaveRequest, reason);
      } else if (rejectModalItem.kind === 'customer_kyc') {
        await approvalHandlers.onRejectCustomerVerification(rejectModalItem.raw as UserProfile, reason);
      } else if (rejectModalItem.kind === 'testimonial') {
        await approvalHandlers.onRejectTestimonial(rejectModalItem.raw as CustomerTestimonial, reason);
      } else if (rejectModalItem.kind === 'quote_convert') {
        await approvalHandlers.onRequestApprovalInfo(
          `Hold order conversion for ${rejectModalItem.reference}`,
          reason,
          rejectModalItem.requestedBy
        );
      }
      setRejectModalItem(null);
      setRejectReason('');
    } finally {
      setBusyApprovalId(null);
    }
  };

  // Operational Reminders derived from live collections
  const operationalReminders = useMemo(() => {
    const list: Array<{ id: string; category: string; title: string; due: string; section: string; urgent: boolean }> = [];
    for (const inv of financeRecords.filter((f) => f.type === 'invoice' && (f.status === 'overdue' || f.status === 'pending'))) {
      list.push({
        id: `rem-pay-${inv.id}`,
        category: 'Payment Reminder',
        title: `${inv.referenceCode} (${inv.counterpartyName}) — ${fmt(inv.amountUsd)} ${inv.status}`,
        due: inv.transactionDate || todayStr,
        section: 'accounts',
        urgent: inv.status === 'overdue',
      });
    }
    for (const sr of sourcingRequests.filter((s) => s.status === 'new' || s.status === 'options_sent')) {
      list.push({
        id: `rem-auc-${sr.id}`,
        category: 'Auction Sourcing',
        title: `${sr.requestCode}: ${sr.make} ${sr.model} for ${sr.customerName}`,
        due: todayStr,
        section: 'auctions',
        urgent: sr.status === 'new',
      });
    }
    for (const o of orders.filter((ord) => ['export_docs_ready', 'shipment_booked', 'shipped'].includes(ord.milestone))) {
      list.push({
        id: `rem-ship-${o.id}`,
        category: 'Shipping Milestone',
        title: `${o.orderNumber} (${o.vehicleTitle}) → ${o.destinationPortName}`,
        due: o.etaDate || o.etdDate || todayStr,
        section: 'logistics',
        urgent: Boolean(o.etaDate && o.etaDate < todayStr),
      });
    }
    return list.slice(0, 12);
  }, [financeRecords, sourcingRequests, orders, todayStr]);

  const filteredTasks = useMemo(() => {
    const myName = (staffProfile?.displayName || '').toLowerCase();
    const myDept = (staffProfile?.department || '').toLowerCase();
    const inSevenDays = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

    return teamTasks.filter((t) => {
      if (taskTab === 'my') return myName && t.assignedToName.toLowerCase().includes(myName);
      if (taskTab === 'department') return !myDept || t.department.toLowerCase() === myDept;
      if (taskTab === 'pending') return t.status !== 'done';
      if (taskTab === 'overdue') return t.status !== 'done' && Boolean(t.dueDate && t.dueDate < todayStr);
      if (taskTab === 'completed') return t.status === 'done';
      if (taskTab === 'upcoming')
        return t.status !== 'done' && Boolean(t.dueDate && t.dueDate >= todayStr && t.dueDate <= inSevenDays);
      return true;
    });
  }, [teamTasks, taskTab, staffProfile, todayStr]);

  const openCreateTask = () => {
    setEditingTask(null);
    setTaskDraft({
      title: '',
      description: '',
      department: staffProfile?.department || 'Operations',
      assignedToName: staffProfile?.displayName || hrEmployees[0]?.fullName || '',
      priority: 'medium',
      status: 'todo',
      dueDate: todayStr,
    });
    setTaskModalOpen(true);
  };

  const openEditTask = (t: TeamTask) => {
    setEditingTask(t);
    setTaskDraft({
      title: t.title,
      description: t.description || '',
      department: t.department || 'Operations',
      assignedToName: t.assignedToName || '',
      priority: t.priority,
      status: t.status,
      dueDate: t.dueDate || todayStr,
    });
    setTaskModalOpen(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskDraft.title.trim()) return;
    setSavingTask(true);
    try {
      if (editingTask) {
        await onUpdateTaskDetails(editingTask.id, taskDraft);
      } else {
        await onCreateTask({
          ...taskDraft,
          createdByUid: staffProfile?.uid || 'admin',
          createdByName: staffProfile?.displayName || 'Super Admin',
        });
      }
      setTaskModalOpen(false);
    } finally {
      setSavingTask(false);
    }
  };

  const QUICK_ACTIONS = [
    { id: 'add_customer', label: 'Add Customer', icon: UserPlus, section: 'crm' },
    { id: 'add_lead', label: 'Add Lead', icon: Users, section: 'crm' },
    { id: 'add_vehicle', label: 'Add Vehicle', icon: Car, section: 'inventory' },
    { id: 'create_quotation', label: 'Create Quotation', icon: FilePlus2, section: 'sales' },
    { id: 'create_order', label: 'Create Order', icon: PackagePlus, section: 'orders' },
    { id: 'proforma_invoice', label: 'Proforma Invoice', icon: FileSpreadsheet, section: 'accounts' },
    { id: 'commercial_invoice', label: 'Commercial Invoice', icon: Receipt, section: 'accounts' },
    { id: 'record_payment', label: 'Record Payment', icon: CreditCard, section: 'accounts' },
    { id: 'record_expense', label: 'Record Expense', icon: Building2, section: 'accounts' },
    { id: 'create_shipment', label: 'Create Shipment', icon: Ship, section: 'logistics' },
    { id: 'auction_bid', label: 'Submit Auction Bid', icon: Gavel, section: 'auctions' },
    { id: 'add_employee', label: 'Add Employee', icon: UserPlus, section: 'hr' },
    { id: 'create_user', label: 'Create User', icon: ShieldAlert, section: 'users' },
    { id: 'upload_document', label: 'Upload Document', icon: Upload, section: 'documents' },
    { id: 'create_announcement', label: 'Announcement', icon: Megaphone, section: 'cms' },
    { id: 'generate_report', label: 'Generate Report', icon: FileBarChart2, section: 'reports' },
    { id: 'publish_vehicle', label: 'Publish Vehicle', icon: Globe, section: 'inventory' },
    { id: 'update_website', label: 'Update Website', icon: FileText, section: 'cms' },
  ];

  return (
    <div className="space-y-6">
      {/* ===================================================================== */}
      {/* QUICK ACTIONS COMMAND GRID (All 18 Actions) */}
      {/* ===================================================================== */}
      {showQuickActions && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <h3 className="text-base font-bold text-slate-950 dark:text-white tracking-tight">
                  Executive Quick Actions
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Direct launchpad into authorized creation forms & operational workflows
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {QUICK_ACTIONS.map((qa) => {
              const Icon = qa.icon;
              return (
                <button
                  key={qa.id}
                  type="button"
                  onClick={() => onQuickAction(qa.id)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-amber-500/70 dark:hover:border-amber-500/70 bg-slate-50/50 dark:bg-slate-950/40 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 text-left transition-colors cursor-pointer group"
                >
                  <Icon className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 shrink-0" />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {qa.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* PENDING APPROVALS CENTER */}
      {/* ===================================================================== */}
      {showApprovals && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <h3 className="text-base font-bold text-slate-950 dark:text-white tracking-tight">
                  Pending Approvals Center ({pendingApprovals.length})
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Every approval or rejection persists to Firestore and writes an immutable Audit Log entry
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {(
                [
                  ['ALL', 'All'],
                  ['payment', 'Payments'],
                  ['leave', 'HR Leave'],
                  ['customer_kyc', 'Customer KYC'],
                  ['quote_convert', 'Orders / Quotes'],
                  ['testimonial', 'Website CMS'],
                ] as const
              ).map(([k, lbl]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setApprovalFilter(k)}
                  className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                    approvalFilter === k
                      ? 'bg-slate-950 text-white dark:bg-amber-500 dark:text-slate-950'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {filteredApprovals.length === 0 ? (
            <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-center space-y-1">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                Zero pending approvals in this queue
              </div>
              <div className="text-xs text-slate-500">
                All authorized payment verifications, leave requests, KYC checks, and quotes are up to date.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
              {filteredApprovals.slice(0, 10).map((item) => {
                const isBusy = busyApprovalId === item.id;
                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                          {item.typeLabel} · {item.department}
                        </span>
                        <span
                          className={`font-bold uppercase ${
                            item.priority === 'urgent'
                              ? 'text-rose-600 dark:text-rose-400'
                              : item.priority === 'high'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-slate-500'
                          }`}
                        >
                          {item.priority}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="text-sm font-bold text-slate-950 dark:text-white truncate">
                          {item.reference} — {item.requestedBy}
                        </div>
                        {typeof item.amountUsd === 'number' && item.amountUsd > 0 && (
                          <div className="text-sm font-bold tabular-nums text-slate-950 dark:text-white shrink-0">
                            {fmt(item.amountUsd)}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                        {item.details}
                      </p>
                      <div className="text-[11px] font-mono text-slate-500">
                        Date: {item.dateLabel} · Status: {item.status}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleApprove(item)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        {isBusy ? 'Saving...' : item.kind === 'quote_convert' ? 'Approve & Create Order' : 'Approve'}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          setRejectModalItem(item);
                          setRejectReason('');
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-lg cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => setDetailModalItem(item)}
                        className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                      >
                        View Details
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          void approvalHandlers.onRequestApprovalInfo(
                            `Info requested: ${item.typeLabel} (${item.reference})`,
                            `Follow up with ${item.requestedBy} regarding ${item.details}`,
                            item.requestedBy
                          )
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white cursor-pointer ml-auto"
                      >
                        <MessageSquarePlus className="w-3.5 h-3.5" /> Request Info
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ===================================================================== */}
      {/* TASK & REMINDER MANAGEMENT */}
      {/* ===================================================================== */}
      {showTasks && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <h3 className="text-base font-bold text-slate-950 dark:text-white tracking-tight">
                  Task & Operational Reminder Management
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Create, assign, complete, and reschedule tasks synced live to Firestore
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateTask}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> New Task
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs border-b border-slate-200 dark:border-slate-800 pb-3">
            {(
              [
                ['pending', `Pending (${teamTasks.filter((t) => t.status !== 'done').length})`],
                ['my', 'My Tasks'],
                ['department', 'Department'],
                [
                  'overdue',
                  `Overdue (${teamTasks.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate < todayStr).length})`,
                ],
                ['upcoming', 'Upcoming 7d'],
                ['completed', 'Completed'],
                ['reminders', `Reminders (${operationalReminders.length})`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTaskTab(id)}
                className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                  taskTab === id
                    ? 'bg-slate-950 text-white dark:bg-amber-500 dark:text-slate-950'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {taskTab === 'reminders' ? (
            <div className="space-y-2">
              {operationalReminders.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No active operational reminders.</p>
              ) : (
                operationalReminders.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => onNavigateSection(r.section)}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <BellRing
                        className={`w-4 h-4 shrink-0 ${
                          r.urgent ? 'text-rose-500' : 'text-amber-500'
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold uppercase text-slate-500">{r.category}</div>
                        <div className="text-xs font-semibold text-slate-950 dark:text-white truncate">
                          {r.title}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500 shrink-0">{r.due}</span>
                  </div>
                ))
              )}
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              No tasks in this view. Click <strong>New Task</strong> to assign work.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              {filteredTasks.slice(0, 10).map((t) => {
                const isOverdue = t.status !== 'done' && Boolean(t.dueDate && t.dueDate < todayStr);
                return (
                  <div
                    key={t.id}
                    className="p-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() =>
                          void onUpdateTaskDetails(t.id, {
                            status: t.status === 'done' ? 'todo' : 'done',
                          })
                        }
                        aria-label="Toggle task completion"
                        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer ${
                          t.status === 'done'
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {t.status === 'done' && <Check className="w-3 h-3" />}
                      </button>
                      <div className="min-w-0">
                        <div
                          className={`text-xs font-bold ${
                            t.status === 'done'
                              ? 'line-through text-slate-400'
                              : 'text-slate-950 dark:text-white'
                          }`}
                        >
                          {t.title}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {t.department} · Assigned to {t.assignedToName || 'Unassigned'} · Priority:{' '}
                          <span className="uppercase font-semibold">{t.priority}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 font-mono text-[11px] ${
                          isOverdue
                            ? 'text-rose-600 dark:text-rose-400 font-bold'
                            : 'text-slate-500'
                        }`}
                      >
                        <Calendar className="w-3 h-3" />
                        {t.dueDate || 'No date'}
                      </span>
                      <button
                        type="button"
                        onClick={() => openEditTask(t)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" /> Edit / Reschedule
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Reject Reason Confirmation Modal */}
      {rejectModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-950 dark:text-white">
                Confirm Rejection — {rejectModalItem.reference}
              </h4>
              <button
                type="button"
                onClick={() => setRejectModalItem(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              A mandatory rejection reason is required and will be permanently logged in the Audit Trail.
            </p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter specific reason for rejecting this request..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectModalItem(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!rejectReason.trim() || busyApprovalId === rejectModalItem.id}
                onClick={() => void handleConfirmReject()}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg cursor-pointer"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approval Details Modal */}
      {detailModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-950 dark:text-white">
                {detailModalItem.typeLabel}
              </h4>
              <button
                type="button"
                onClick={() => setDetailModalItem(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs space-y-2 text-slate-700 dark:text-slate-300">
              <div><strong>Reference:</strong> {detailModalItem.reference}</div>
              <div><strong>Requested By:</strong> {detailModalItem.requestedBy}</div>
              <div><strong>Department:</strong> {detailModalItem.department}</div>
              <div><strong>Date:</strong> {detailModalItem.dateLabel}</div>
              {typeof detailModalItem.amountUsd === 'number' && (
                <div><strong>Amount:</strong> {fmt(detailModalItem.amountUsd)}</div>
              )}
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">{detailModalItem.details}</div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setDetailModalItem(null)}
                className="px-3.5 py-1.5 text-xs font-semibold bg-slate-950 text-white dark:bg-amber-500 dark:text-slate-950 rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit / Reschedule Task Modal */}
      {taskModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveTask}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-3.5 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-950 dark:text-white">
                {editingTask ? 'Edit / Reschedule Task' : 'Create & Assign Task'}
              </h4>
              <button
                type="button"
                onClick={() => setTaskModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Task Title</label>
                <input
                  required
                  type="text"
                  value={taskDraft.title}
                  onChange={(e) => setTaskDraft((d) => ({ ...d, title: e.target.value }))}
                  placeholder="e.g., Verify TT remittance for ORD-AUZ-2026-712"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={taskDraft.description}
                  onChange={(e) => setTaskDraft((d) => ({ ...d, description: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Assign To</label>
                  <input
                    type="text"
                    value={taskDraft.assignedToName}
                    onChange={(e) => setTaskDraft((d) => ({ ...d, assignedToName: e.target.value }))}
                    list="staff-assignee-list"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                  <datalist id="staff-assignee-list">
                    {hrEmployees.map((e) => (
                      <option key={e.id} value={e.fullName} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Department</label>
                  <select
                    value={taskDraft.department}
                    onChange={(e) => setTaskDraft((d) => ({ ...d, department: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    {['Management', 'Sales', 'Operations', 'Accounts', 'Logistics', 'HR', 'IT'].map((dep) => (
                      <option key={dep} value={dep}>
                        {dep}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Priority</label>
                  <select
                    value={taskDraft.priority}
                    onChange={(e) =>
                      setTaskDraft((d) => ({ ...d, priority: e.target.value as TeamTask['priority'] }))
                    }
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Status</label>
                  <select
                    value={taskDraft.status}
                    onChange={(e) =>
                      setTaskDraft((d) => ({ ...d, status: e.target.value as TeamTask['status'] }))
                    }
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="review">Review</option>
                    <option value="done">Done</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={taskDraft.dueDate}
                    onChange={(e) => setTaskDraft((d) => ({ ...d, dueDate: e.target.value }))}
                    className="w-full px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTaskModalOpen(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingTask}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg cursor-pointer"
              >
                {savingTask ? 'Saving...' : editingTask ? 'Save Changes' : 'Create Task'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
