import {
  CheckSquare,
  Download,
  FileBarChart2,
  Hash,
  MessageSquare,
  Plus,
  Send,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatMoney, TRADE_MILESTONE_META } from '../../data/ports';
import type {
  CurrencyCode,
  ExportOrder,
  FinanceRecord,
  Inquiry,
  TeamChannelId,
  TeamChannelMessage,
  TeamTask,
  UserProfile,
  Vehicle,
} from '../../types/portal';

interface ReportsTasksHubPanelProps {
  currency: CurrencyCode;
  fxRates: Record<string, number>;
  staffProfile: UserProfile | null;
  vehicles: Vehicle[];
  orders: ExportOrder[];
  inquiries: Inquiry[];
  financeRecords: FinanceRecord[];
  teamTasks: TeamTask[];
  teamMessages: TeamChannelMessage[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  onCreateTask: (input: Omit<TeamTask, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateTaskStatus: (id: string, status: TeamTask['status']) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  onPostTeamMessage: (channel: TeamChannelId, body: string) => Promise<void>;
  onDownloadFullBackup: () => void;
}

const CHANNELS: Array<{ id: TeamChannelId; label: string; desc: string }> = [
  { id: 'general', label: 'general', desc: 'Company-wide announcements & daily sync' },
  { id: 'sales', label: 'sales', desc: 'Quotations, leads, and dealer desk updates' },
  { id: 'operations', label: 'operations', desc: 'Auctions, JEVIC inspections, vessel bookings' },
  { id: 'accounts', label: 'accounts', desc: 'TT remittances, reconciliations & invoicing' },
  { id: 'management', label: 'management', desc: 'Leadership approvals & strategy' },
];

const TASK_COLUMNS: Array<{ key: TeamTask['status']; label: string }> = [
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Completed' },
];

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsTasksHubPanel({
  currency,
  fxRates,
  staffProfile,
  vehicles,
  orders,
  inquiries,
  financeRecords,
  teamTasks,
  teamMessages,
  canCreate,
  canEdit,
  canDelete,
  canExport,
  onCreateTask,
  onUpdateTaskStatus,
  onDeleteTask,
  onPostTeamMessage,
  onDownloadFullBackup,
}: ReportsTasksHubPanelProps) {
  const fmt = (usd: number) => formatMoney(usd, currency, fxRates);
  const [subTab, setSubTab] = useState<'reports' | 'tasks' | 'messaging'>('reports');

  // Task Composer
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [tTitle, setTTitle] = useState('');
  const [tDesc, setTDesc] = useState('');
  const [tDept, setTDept] = useState('Operations');
  const [tAssignee, setTAssignee] = useState(staffProfile?.displayName || '');
  const [tPriority, setTPriority] = useState<TeamTask['priority']>('medium');
  const [tDue, setTDue] = useState(new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10));
  const [savingTask, setSavingTask] = useState(false);

  // Team Messaging
  const [activeChannel, setActiveChannel] = useState<TeamChannelId>('general');
  const [msgBody, setMsgBody] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  const marketSummary = useMemo(() => {
    const map = new Map<string, { count: number; totalCifUsd: number }>();
    for (const o of orders) {
      const key = o.destinationCountry || o.destinationPortName || 'Unspecified';
      const curr = map.get(key) || { count: 0, totalCifUsd: 0 };
      curr.count += 1;
      curr.totalCifUsd += o.totalCifUsd || 0;
      map.set(key, curr);
    }
    return Array.from(map.entries())
      .map(([market, data]) => ({ market, ...data }))
      .sort((a, b) => b.totalCifUsd - a.totalCifUsd);
  }, [orders]);

  const inventoryValueUsd = useMemo(
    () =>
      vehicles
        .filter((v) => v.status === 'available' || v.status === 'reserved')
        .reduce((sum, v) => sum + (v.fobPriceUsd || 0), 0),
    [vehicles]
  );

  const channelMessages = useMemo(
    () => teamMessages.filter((m) => m.channel === activeChannel),
    [teamMessages, activeChannel]
  );

  const todayStamp = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-950 dark:text-white tracking-tight">
            Reports, Tasks &amp; Team Hub
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Export live business reports, coordinate employee tasks, and collaborate across
            department channels.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab('reports')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg cursor-pointer ${
              subTab === 'reports'
                ? 'bg-slate-950 dark:bg-amber-500 text-white dark:text-slate-950'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <FileBarChart2 className="w-4 h-4" />
            Business Reports
          </button>
          <button
            type="button"
            onClick={() => setSubTab('tasks')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg cursor-pointer ${
              subTab === 'tasks'
                ? 'bg-slate-950 dark:bg-amber-500 text-white dark:text-slate-950'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            Task Board ({teamTasks.filter((t) => t.status !== 'done').length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('messaging')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg cursor-pointer ${
              subTab === 'messaging'
                ? 'bg-slate-950 dark:bg-amber-500 text-white dark:text-slate-950'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Team Messaging
          </button>
        </div>
      </div>

      {/* SUBTAB 1: REPORTS & EXPORTS */}
      {subTab === 'reports' && (
        <div className="space-y-6">
          {/* Export Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Export Orders Report
                </div>
                <div className="text-2xl font-extrabold font-mono text-slate-950 dark:text-white mt-1">
                  {orders.length} Orders
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Full CIF breakdown, vessel, B/L number, and milestone status.
                </p>
              </div>
              {canExport && (
                <button
                  type="button"
                  onClick={() =>
                    downloadCsv(
                      `auzio-orders-${todayStamp}.csv`,
                      [
                        'Order #',
                        'Tracking Code',
                        'Customer',
                        'Vehicle',
                        'Port',
                        'Total CIF USD',
                        'Stage',
                        'Vessel',
                        'B/L Number',
                      ],
                      orders.map((o) => [
                        o.orderNumber,
                        o.trackingCode,
                        o.customerCompany || o.customerName,
                        o.vehicleTitle,
                        o.destinationPortName,
                        String(o.totalCifUsd),
                        TRADE_MILESTONE_META[o.milestone]?.shortLabel || o.milestone,
                        o.vesselName,
                        o.blNumber,
                      ])
                    )
                  }
                  className="inline-flex items-center justify-center gap-1.5 w-full py-2 text-xs font-semibold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Orders CSV
                </button>
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Inventory Valuation
                </div>
                <div className="text-2xl font-extrabold font-mono text-slate-950 dark:text-white mt-1">
                  {fmt(inventoryValueUsd)}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {vehicles.filter((v) => v.status !== 'archived').length} active stock units across
                  yard &amp; auction inventory.
                </p>
              </div>
              {canExport && (
                <button
                  type="button"
                  onClick={() =>
                    downloadCsv(
                      `auzio-inventory-${todayStamp}.csv`,
                      ['Stock Code', 'Year', 'Make', 'Model', 'Chassis', 'Mileage km', 'FOB USD', 'Status'],
                      vehicles.map((v) => [
                        v.stockCode,
                        String(v.year),
                        v.make,
                        v.model,
                        v.chassisCode,
                        String(v.mileageKm),
                        String(v.fobPriceUsd),
                        v.status,
                      ])
                    )
                  }
                  className="inline-flex items-center justify-center gap-1.5 w-full py-2 text-xs font-semibold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Inventory CSV
                </button>
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Finance &amp; Ledger
                </div>
                <div className="text-2xl font-extrabold font-mono text-slate-950 dark:text-white mt-1">
                  {financeRecords.length} Entries
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Invoices, TT payments, operational expenses, and bank reconciliation status.
                </p>
              </div>
              {canExport && (
                <button
                  type="button"
                  onClick={() =>
                    downloadCsv(
                      `auzio-finance-${todayStamp}.csv`,
                      ['Ref', 'Type', 'Counterparty', 'Category', 'Amount USD', 'Status', 'Reconciled', 'Date'],
                      financeRecords.map((r) => [
                        r.referenceCode,
                        r.type,
                        r.counterpartyName,
                        r.category,
                        String(r.amountUsd),
                        r.status,
                        r.reconciled ? 'Yes' : 'No',
                        r.transactionDate,
                      ])
                    )
                  }
                  className="inline-flex items-center justify-center gap-1.5 w-full py-2 text-xs font-semibold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Finance CSV
                </button>
              )}
            </div>

            <div className="bg-slate-950 text-white rounded-xl p-5 flex flex-col justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-amber-400">
                  Full Database Backup
                </div>
                <div className="text-2xl font-extrabold font-mono mt-1">JSON Snapshot</div>
                <p className="text-xs text-slate-400 mt-1">
                  Archive all active orders, stock, customers, finance records, HR, and settings.
                </p>
              </div>
              {canExport && (
                <button
                  type="button"
                  onClick={onDownloadFullBackup}
                  className="inline-flex items-center justify-center gap-1.5 w-full py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export JSON Backup
                </button>
              )}
            </div>
          </div>

          {/* Export Market Breakdown */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-950 dark:text-white">
                Export Volume by Destination Market
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {inquiries.length} public inquiries logged
              </span>
            </div>
            {marketSummary.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-4">
                No export orders recorded yet. Market volume analytics appear automatically as
                orders are created.
              </p>
            ) : (
              <div className="space-y-3">
                {marketSummary.map((row) => {
                  const maxVal = marketSummary[0]?.totalCifUsd || 1;
                  const widthPct = Math.max(8, Math.round((row.totalCifUsd / maxVal) * 100));
                  return (
                    <div key={row.market} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {row.market}
                        </span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          {row.count} unit{row.count === 1 ? '' : 's'} · {fmt(row.totalCifUsd)}
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-slate-900 dark:bg-amber-500 rounded-full"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 2: EMPLOYEE TASK BOARD */}
      {subTab === 'tasks' && (
        <div className="space-y-5">
          {canCreate && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowTaskForm((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                {showTaskForm ? 'Close Task Form' : 'New Team Task'}
              </button>
            </div>
          )}

          {showTaskForm && canCreate && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSavingTask(true);
                try {
                  await onCreateTask({
                    title: tTitle,
                    description: tDesc,
                    department: tDept,
                    assignedToName: tAssignee || staffProfile?.displayName || 'Team Member',
                    priority: tPriority,
                    status: 'todo',
                    dueDate: tDue,
                    createdByUid: staffProfile?.uid || 'staff',
                    createdByName: staffProfile?.displayName || 'Staff',
                  });
                  setTTitle('');
                  setTDesc('');
                  setShowTaskForm(false);
                } finally {
                  setSavingTask(false);
                }
              }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Task Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={tTitle}
                    onChange={(e) => setTTitle(e.target.value)}
                    placeholder="e.g. Confirm JEVIC booking for ORD-AUZ-2026-201"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Department
                  </label>
                  <select
                    value={tDept}
                    onChange={(e) => setTDept(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option>Operations</option>
                    <option>Sales</option>
                    <option>Accounts</option>
                    <option>Auctions</option>
                    <option>HR</option>
                    <option>IT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={tPriority}
                    onChange={(e) => setTPriority(e.target.value as TeamTask['priority'])}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Assigned To
                  </label>
                  <input
                    type="text"
                    value={tAssignee}
                    onChange={(e) => setTAssignee(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={tDue}
                    onChange={(e) => setTDue(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={tDesc}
                    onChange={(e) => setTDesc(e.target.value)}
                    placeholder="Additional context or linked order number..."
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={savingTask}
                className="px-5 py-2 text-sm font-semibold text-white bg-slate-950 dark:bg-amber-500 dark:text-slate-950 rounded-lg cursor-pointer"
              >
                {savingTask ? 'Creating...' : 'Create Task'}
              </button>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {TASK_COLUMNS.map((col) => {
              const colTasks = teamTasks.filter((t) => t.status === col.key);
              return (
                <div
                  key={col.key}
                  className="bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-3"
                >
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      {col.label}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                      {colTasks.length}
                    </span>
                  </div>
                  {colTasks.length === 0 ? (
                    <div className="text-xs text-slate-400 text-center py-6">No tasks</div>
                  ) : (
                    colTasks.map((task) => (
                      <div
                        key={task.id}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 space-y-2 shadow-2xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-bold uppercase rounded ${
                              task.priority === 'urgent'
                                ? 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300'
                                : task.priority === 'high'
                                  ? 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {task.priority}
                          </span>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => void onDeleteTask(task.id)}
                              aria-label="Delete task"
                              className="text-slate-400 hover:text-red-600 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="text-sm font-semibold text-slate-950 dark:text-white leading-snug">
                          {task.title}
                        </div>
                        {task.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {task.description}
                          </p>
                        )}
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex justify-between pt-1">
                          <span>{task.assignedToName}</span>
                          <span className="font-mono">{task.dueDate}</span>
                        </div>
                        {canEdit && (
                          <select
                            value={task.status}
                            onChange={(e) =>
                              void onUpdateTaskStatus(task.id, e.target.value as TeamTask['status'])
                            }
                            aria-label="Move task status"
                            className="w-full mt-1 px-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-200"
                          >
                            {TASK_COLUMNS.map((opt) => (
                              <option key={opt.key} value={opt.key}>
                                Move to: {opt.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUBTAB 3: INTERNAL TEAM MESSAGING */}
      {subTab === 'messaging' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-1">
            <div className="px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Department Channels
            </div>
            {CHANNELS.map((ch) => {
              const count = teamMessages.filter((m) => m.channel === ch.id).length;
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setActiveChannel(ch.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer ${
                    activeChannel === ch.id
                      ? 'bg-slate-950 dark:bg-amber-500 text-white dark:text-slate-950 font-semibold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5" />
                    {ch.label}
                  </span>
                  <span className="text-xs font-mono opacity-75">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col h-[500px]">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
              <div className="text-sm font-bold text-slate-950 dark:text-white">
                #{activeChannel}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {CHANNELS.find((c) => c.id === activeChannel)?.desc}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {channelMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-slate-400">
                  No messages in #{activeChannel} yet. Start the department conversation below.
                </div>
              ) : (
                channelMessages.map((m) => (
                  <div
                    key={m.id}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/60 space-y-1"
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-slate-950 dark:text-white">
                        {m.senderName}
                      </span>
                      <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {m.senderRole.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                      {m.body}
                    </p>
                  </div>
                ))
              )}
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!msgBody.trim()) return;
                setSendingMsg(true);
                try {
                  await onPostTeamMessage(activeChannel, msgBody.trim());
                  setMsgBody('');
                } finally {
                  setSendingMsg(false);
                }
              }}
              className="p-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2"
            >
              <input
                type="text"
                value={msgBody}
                onChange={(e) => setMsgBody(e.target.value)}
                placeholder={`Message #${activeChannel}...`}
                className="flex-1 px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
              <button
                type="submit"
                disabled={sendingMsg || !msgBody.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-slate-950 dark:bg-amber-500 dark:text-slate-950 rounded-lg cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
