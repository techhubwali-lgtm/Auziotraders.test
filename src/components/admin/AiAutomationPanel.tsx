import {
  Bot,
  Check,
  Copy,
  Download,
  FileSearch,
  Mail,
  Send,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { auth } from '../../lib/firebase';
import type {
  ExportOrder,
  FinanceRecord,
  Inquiry,
  Quotation,
  SourcingRequest,
  UserProfile,
  Vehicle,
} from '../../types/portal';

type AiToolMode = 'daily_report' | 'sales_followup' | 'document_extract' | 'business_chat';

interface AiAutomationPanelProps {
  vehicles: Vehicle[];
  users: UserProfile[];
  sourcingRequests: SourcingRequest[];
  quotations: Quotation[];
  orders: ExportOrder[];
  inquiries: Inquiry[];
  financeRecords: FinanceRecord[];
  initialTool?: AiToolMode;
  initialPrompt?: string;
}

export function AiAutomationPanel({
  vehicles,
  users,
  sourcingRequests,
  quotations,
  orders,
  inquiries,
  financeRecords,
  initialTool = 'daily_report',
  initialPrompt = '',
}: AiAutomationPanelProps) {
  const [tool, setTool] = useState<AiToolMode>(initialTool);
  const [prompt, setPrompt] = useState(
    initialPrompt ||
      'Generate today’s executive Daily Business Report covering revenue, pending quotations, shipping pipeline, and top 3 priorities.'
  );
  const [selectedInquiryId, setSelectedInquiryId] = useState(inquiries[0]?.id || '');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const buildLiveSnapshot = (): string => {
    const totalOrderCif = orders.reduce((acc, o) => acc + (o.totalCifUsd || 0), 0);
    const paidFinance = financeRecords
      .filter((r) => r.type !== 'expense' && (r.status === 'paid' || r.status === 'reconciled'))
      .reduce((acc, r) => acc + r.amountUsd, 0);
    const expenses = financeRecords
      .filter((r) => r.type === 'expense')
      .reduce((acc, r) => acc + r.amountUsd, 0);
    const overdue = financeRecords
      .filter((r) => r.status === 'overdue')
      .reduce((acc, r) => acc + r.amountUsd, 0);

    return [
      `Date: ${new Date().toISOString().slice(0, 10)}`,
      `Inventory: ${vehicles.filter((v) => v.status === 'available').length} available, ${vehicles.filter((v) => v.status === 'reserved').length} reserved, ${vehicles.filter((v) => v.status === 'sold').length} sold.`,
      `Customers & Dealers: ${users.filter((u) => u.role === 'customer' || u.role === 'dealer').length} registered accounts.`,
      `Inquiries: ${inquiries.length} total (${inquiries.filter((i) => i.status === 'received').length} newly received).`,
      `Sourcing Requests: ${sourcingRequests.length} total (${sourcingRequests.filter((r) => r.status === 'new').length} new).`,
      `Quotations: ${quotations.length} total (${quotations.filter((q) => q.status === 'sent').length} sent awaiting reply, ${quotations.filter((q) => q.status === 'approved').length} approved).`,
      `Export Orders: ${orders.length} total, aggregate CIF $${totalOrderCif.toLocaleString()} USD.`,
      `Active Shipments: ${orders.filter((o) => ['vehicle_in_yard', 'export_docs_ready', 'shipment_booked', 'shipped'].includes(o.milestone)).length}.`,
      `Finance Ledger: Paid/Reconciled Inflows $${paidFinance.toLocaleString()} USD, Expenses $${expenses.toLocaleString()} USD, Overdue Receivables $${overdue.toLocaleString()} USD.`,
    ].join('\n');
  };

  const handleSelectTool = (next: AiToolMode) => {
    setTool(next);
    setError('');
    if (next === 'daily_report') {
      setPrompt(
        'Generate today’s executive Daily Business Report covering revenue, pending quotations, shipping pipeline, and top 3 priorities.'
      );
    } else if (next === 'sales_followup') {
      const inq = inquiries.find((i) => i.id === selectedInquiryId) || inquiries[0];
      if (inq) {
        setPrompt(
          `Draft a professional email and short WhatsApp follow-up for ${inq.buyerName} (${inq.buyerCountry}) regarding ${inq.vehicleTitle} (${inq.vehicleStockCode}) shipping to ${inq.destinationPortName}. Their message was: "${inq.message}".`
        );
      } else {
        setPrompt(
          'Draft a professional follow-up email and WhatsApp message for an international car buyer who requested a CIF quotation to Mombasa, Kenya.'
        );
      }
    } else if (next === 'document_extract') {
      setPrompt('');
    } else {
      setPrompt('What are our biggest immediate revenue opportunities and operational risks based on today’s live pipeline?');
    }
  };

  const handleRunAi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);
    setError('');
    setOutput('');
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        setError('Please sign in with your verified staff account to run the AI Assistant.');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/admin/ai-assist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          task: tool,
          prompt: prompt.trim(),
          contextSummary: tool === 'document_extract' ? '' : buildLiveSnapshot(),
        }),
      });
      const data = (await res.json()) as { ok: boolean; output?: string; error?: string };
      if (!data.ok || !data.output) {
        setError(data.error || 'Could not generate AI response.');
      } else {
        setOutput(data.output);
      }
    } catch {
      setError('Network error while contacting the AI Assistant service.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    if (!output) return;
    const blob = new Blob([output], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auzio-ai-${tool}-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          AI &amp; Automation Hub
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Generate automated daily business reports, customer follow-up drafts, export document
          extractions, and operational answers grounded in live company data.
        </p>
      </div>

      {/* Mode Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {(
          [
            {
              id: 'daily_report',
              title: 'Daily Business Report',
              desc: 'Executive summary of live sales, finance & shipments',
              icon: Sparkles,
            },
            {
              id: 'sales_followup',
              title: 'Sales Follow-Up Writer',
              desc: 'Email & WhatsApp follow-up drafts for active leads',
              icon: Mail,
            },
            {
              id: 'document_extract',
              title: 'Document Extractor',
              desc: 'Parse auction sheets, B/Ls, and export invoices',
              icon: FileSearch,
            },
            {
              id: 'business_chat',
              title: 'Business Assistant',
              desc: 'Ask questions across live operations & KPIs',
              icon: Bot,
            },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = tool === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectTool(item.id)}
              className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                active
                  ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 border-slate-900 dark:border-amber-500'
                  : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <Icon className="w-5 h-5 mb-2" />
              <div className="text-sm font-bold">{item.title}</div>
              <div
                className={`text-xs mt-1 ${
                  active ? 'opacity-85' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {item.desc}
              </div>
            </button>
          );
        })}
      </div>

      {/* Prompt Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <form
          onSubmit={handleRunAi}
          className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
        >
          {tool === 'sales_followup' && inquiries.length > 0 && (
            <div className="text-xs">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Pick an Active Lead to Pre-fill
              </label>
              <select
                value={selectedInquiryId}
                onChange={(e) => {
                  setSelectedInquiryId(e.target.value);
                  const inq = inquiries.find((i) => i.id === e.target.value);
                  if (inq) {
                    setPrompt(
                      `Draft a professional email and short WhatsApp follow-up for ${inq.buyerName} (${inq.buyerCountry}) regarding ${inq.vehicleTitle} (${inq.vehicleStockCode}) shipping to ${inq.destinationPortName}. Their message was: "${inq.message}".`
                    );
                  }
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                {inquiries.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.trackingCode} — {i.buyerName} ({i.vehicleTitle})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="text-xs">
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {tool === 'document_extract'
                ? 'Paste Auction Sheet, Bill of Lading, or Commercial Invoice Text'
                : 'Instruction / Business Question'}
            </label>
            <textarea
              rows={8}
              required
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                tool === 'document_extract'
                  ? 'Paste Japanese auction sheet notes, chassis/VIN, B/L details, or invoice text here...'
                  : 'Ask the AI assistant...'
              }
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-amber-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-400 text-white dark:text-slate-950 font-bold text-xs cursor-pointer disabled:opacity-60"
          >
            <Send className="w-4 h-4" />
            <span>{loading ? 'Analyzing Live Data...' : 'Run AI Assistant'}</span>
          </button>
        </form>

        {/* AI Output Panel */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              Generated Output
            </div>
            {output && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadMarkdown}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 pt-4">
            {error && (
              <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
                {error}
              </div>
            )}
            {!error && !output && !loading && (
              <div className="h-56 flex flex-col items-center justify-center text-center text-xs text-slate-500 dark:text-slate-400">
                <Bot className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-2" />
                <p>Select a workflow on the left and click &ldquo;Run AI Assistant&rdquo;.</p>
                <p className="mt-1">
                  All reports use live company metrics from Firestore — zero invented numbers.
                </p>
              </div>
            )}
            {loading && (
              <div className="space-y-3 animate-pulse">
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-full" />
                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-5/6" />
                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-4/6" />
              </div>
            )}
            {output && (
              <div className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200 leading-relaxed max-h-[440px] overflow-y-auto pr-1">
                {output}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
