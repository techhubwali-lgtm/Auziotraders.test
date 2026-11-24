import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Database,
  Download,
  Globe,
  Landmark,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Unlock,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { WORLD_CURRENCIES } from '../../data/currencies';
import type {
  AuditLogEntry,
  CompanySettings,
  LiveExchangeRateState,
  UserRole,
} from '../../types/portal';

interface AdminSettingsPanelProps {
  role: UserRole;
  settings: CompanySettings;
  liveFx: LiveExchangeRateState;
  auditLogs: AuditLogEntry[];
  canEditSettings: boolean;
  canViewBanking: boolean;
  canEditBanking: boolean;
  canExport: boolean;
  onRefreshFx: () => void;
  onSaveCompanyProfile: (next: CompanySettings) => Promise<void>;
  onSaveBankingDetails: (next: CompanySettings, verificationReason: string) => Promise<void>;
  onDownloadFullBackup: () => void;
  onSeedDatabase: () => Promise<void>;
  onClearSampleData: () => Promise<void>;
}

const HIGHLIGHT_CURRENCIES = ['JPY', 'EUR', 'GBP', 'AUD', 'KES', 'ZAR', 'NZD', 'CAD', 'AED', 'UGX'];

export function AdminSettingsPanel({
  role,
  settings,
  liveFx,
  auditLogs,
  canEditSettings,
  canViewBanking,
  canEditBanking,
  canExport,
  onRefreshFx,
  onSaveCompanyProfile,
  onSaveBankingDetails,
  onDownloadFullBackup,
  onSeedDatabase,
  onClearSampleData,
}: AdminSettingsPanelProps) {
  const [subTab, setSubTab] = useState<'company' | 'exchange' | 'banking' | 'security'>('company');

  // Company Profile draft (strictly separated from banking & exchange rates)
  const [companyDraft, setCompanyDraft] = useState({
    companyName: settings.companyName,
    tagline: settings.tagline,
    officeAddress: settings.officeAddress,
    supportEmail: settings.supportEmail,
    whatsappPhone: settings.whatsappPhone,
    invoiceValidityDays: settings.invoiceValidityDays,
  });
  const [savingCompany, setSavingCompany] = useState(false);

  // Protected Banking draft (locked by default)
  const [bankingUnlocked, setBankingUnlocked] = useState(false);
  const [bankingDraft, setBankingDraft] = useState({
    bankName: settings.bankName,
    bankBranch: settings.bankBranch,
    accountName: settings.accountName,
    accountNumber: settings.accountNumber,
    swiftCode: settings.swiftCode,
    bankAddress: settings.bankAddress,
  });
  const [confirmSwift, setConfirmSwift] = useState('');
  const [verificationReason, setVerificationReason] = useState('');
  const [bankingError, setBankingError] = useState('');
  const [savingBanking, setSavingBanking] = useState(false);

  // Audit filter
  const [auditSearch, setAuditSearch] = useState('');

  // Dev-only Danger Zone (completely omitted from production builds)
  const isDevAdmin = Boolean(import.meta.env.DEV && role === 'admin');
  const [devPanelOpen, setDevPanelOpen] = useState(false);
  const [devConfirmPhrase, setDevConfirmPhrase] = useState('');
  const [runningDevAction, setRunningDevAction] = useState(false);

  useEffect(() => {
    setCompanyDraft({
      companyName: settings.companyName,
      tagline: settings.tagline,
      officeAddress: settings.officeAddress,
      supportEmail: settings.supportEmail,
      whatsappPhone: settings.whatsappPhone,
      invoiceValidityDays: settings.invoiceValidityDays,
    });
    setBankingDraft({
      bankName: settings.bankName,
      bankBranch: settings.bankBranch,
      accountName: settings.accountName,
      accountNumber: settings.accountNumber,
      swiftCode: settings.swiftCode,
      bankAddress: settings.bankAddress,
    });
  }, [settings]);

  const bankingAuditLogs = useMemo(
    () => auditLogs.filter((l) => l.action === 'banking_details_updated'),
    [auditLogs]
  );

  const filteredAuditLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    if (!q) return auditLogs;
    return auditLogs.filter(
      (l) =>
        l.action.toLowerCase().includes(q) ||
        l.summary.toLowerCase().includes(q) ||
        l.actorEmail.toLowerCase().includes(q) ||
        l.targetType.toLowerCase().includes(q)
    );
  }, [auditLogs, auditSearch]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-950 dark:text-white tracking-tight">
            System &amp; Financial Settings
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Company identity, automated exchange-rate feeds, protected banking controls, and
            security logs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab('company')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg cursor-pointer ${
              subTab === 'company'
                ? 'bg-slate-950 dark:bg-amber-500 text-white dark:text-slate-950'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Company Profile
          </button>
          <button
            type="button"
            onClick={() => setSubTab('exchange')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg cursor-pointer ${
              subTab === 'exchange'
                ? 'bg-slate-950 dark:bg-amber-500 text-white dark:text-slate-950'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <Globe className="w-4 h-4" />
            Exchange Rate API
          </button>
          {canViewBanking && (
            <button
              type="button"
              onClick={() => setSubTab('banking')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg cursor-pointer ${
                subTab === 'banking'
                  ? 'bg-slate-950 dark:bg-amber-500 text-white dark:text-slate-950'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <Landmark className="w-4 h-4" />
              Banking Details
            </button>
          )}
          <button
            type="button"
            onClick={() => setSubTab('security')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg cursor-pointer ${
              subTab === 'security'
                ? 'bg-slate-950 dark:bg-amber-500 text-white dark:text-slate-950'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            Backups &amp; Audit Log
          </button>
        </div>
      </div>

      {/* TAB 1: COMPANY PROFILE */}
      {subTab === 'company' && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!canEditSettings) return;
            setSavingCompany(true);
            try {
              await onSaveCompanyProfile({
                ...settings,
                ...companyDraft,
              });
            } finally {
              setSavingCompany(false);
            }
          }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5 max-w-3xl"
        >
          <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="text-base font-bold text-slate-950 dark:text-white">
              Corporate Export Identity
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Used on official Proforma Invoices, customer portals, and export documentation.
              Corporate banking details are isolated in the protected Banking Details section.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Company Name
              </label>
              <input
                type="text"
                disabled={!canEditSettings}
                value={companyDraft.companyName}
                onChange={(e) =>
                  setCompanyDraft((prev) => ({ ...prev, companyName: e.target.value }))
                }
                className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Invoice Validity (Days)
              </label>
              <input
                type="number"
                min={1}
                max={30}
                disabled={!canEditSettings}
                value={companyDraft.invoiceValidityDays}
                onChange={(e) =>
                  setCompanyDraft((prev) => ({
                    ...prev,
                    invoiceValidityDays: Number(e.target.value),
                  }))
                }
                className="w-full px-3.5 py-2.5 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white disabled:opacity-60"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tagline
              </label>
              <input
                type="text"
                disabled={!canEditSettings}
                value={companyDraft.tagline}
                onChange={(e) =>
                  setCompanyDraft((prev) => ({ ...prev, tagline: e.target.value }))
                }
                className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Export Support Email
              </label>
              <input
                type="email"
                disabled={!canEditSettings}
                value={companyDraft.supportEmail}
                onChange={(e) =>
                  setCompanyDraft((prev) => ({ ...prev, supportEmail: e.target.value }))
                }
                className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                WhatsApp / Desk Phone
              </label>
              <input
                type="text"
                disabled={!canEditSettings}
                value={companyDraft.whatsappPhone}
                onChange={(e) =>
                  setCompanyDraft((prev) => ({ ...prev, whatsappPhone: e.target.value }))
                }
                className="w-full px-3.5 py-2.5 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white disabled:opacity-60"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Registered Japan Office Address
              </label>
              <input
                type="text"
                disabled={!canEditSettings}
                value={companyDraft.officeAddress}
                onChange={(e) =>
                  setCompanyDraft((prev) => ({ ...prev, officeAddress: e.target.value }))
                }
                className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white disabled:opacity-60"
              />
            </div>
          </div>

          {canEditSettings && (
            <button
              type="submit"
              disabled={savingCompany}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-slate-950 dark:bg-amber-500 dark:text-slate-950 rounded-lg cursor-pointer disabled:opacity-60"
            >
              {savingCompany ? 'Saving Profile...' : 'Save Company Profile'}
            </button>
          )}
        </form>
      )}

      {/* TAB 2: AUTOMATIC EXCHANGE-RATE API (ZERO MANUAL RATE INPUTS) */}
      {subTab === 'exchange' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle2
                  className={`w-5 h-5 ${liveFx.ok ? 'text-emerald-500' : 'text-amber-500'}`}
                />
                <h3 className="text-base font-bold text-slate-950 dark:text-white">
                  Automatic Live Exchange-Rate Feed
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Provider: <strong>{liveFx.provider}</strong> · Base Currency: <strong>USD</strong> ·
                Last Synced:{' '}
                <span className="font-mono">
                  {liveFx.updatedAt ? new Date(liveFx.updatedAt).toLocaleString() : 'Not synced yet'}
                </span>
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manual exchange-rate overrides have been disabled to prevent pricing discrepancies.
                All customer-facing multi-currency prices convert automatically from verified USD
                base figures.
              </p>
            </div>
            <button
              type="button"
              onClick={onRefreshFx}
              disabled={liveFx.loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-slate-950 dark:bg-amber-500 dark:text-slate-950 rounded-lg shrink-0 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${liveFx.loading ? 'animate-spin' : ''}`} />
              {liveFx.loading ? 'Syncing...' : 'Sync Live Rates Now'}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
            {HIGHLIGHT_CURRENCIES.map((code) => {
              const info = WORLD_CURRENCIES.find((c) => c.code === code);
              const rate = liveFx.rates[code];
              return (
                <div
                  key={code}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4"
                >
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    1 USD → {code}
                  </div>
                  <div className="text-xl font-extrabold font-mono text-slate-950 dark:text-white mt-1">
                    {typeof rate === 'number' && rate > 0
                      ? rate.toFixed(rate >= 100 ? 2 : 4)
                      : 'Unavailable'}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    {info?.name || code}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: PROTECTED CORPORATE BANKING DETAILS */}
      {subTab === 'banking' && canViewBanking && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-700 dark:text-red-400">
                  <ShieldCheck className="w-4 h-4" />
                  Protected Financial Control · Mandatory Audit Logging
                </div>
                <h3 className="text-lg font-bold text-slate-950 dark:text-white mt-1">
                  Corporate Wire &amp; Remittance Banking Details
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Printed on all customer Proforma Invoices. Only Owner / Super Admin or accounts
                  explicitly granted Banking Edit rights can modify these fields.
                </p>
              </div>
              {canEditBanking && (
                <button
                  type="button"
                  onClick={() => {
                    setBankingUnlocked((prev) => !prev);
                    setBankingError('');
                    setConfirmSwift('');
                    setVerificationReason('');
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg cursor-pointer ${
                    bankingUnlocked
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  {bankingUnlocked ? (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      Lock Fields
                    </>
                  ) : (
                    <>
                      <Unlock className="w-3.5 h-3.5" />
                      Unlock to Edit Banking
                    </>
                  )}
                </button>
              )}
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBankingError('');
                if (!canEditBanking || !bankingUnlocked) return;
                if (confirmSwift.trim().toUpperCase() !== bankingDraft.swiftCode.trim().toUpperCase()) {
                  setBankingError(
                    'SWIFT verification failed. Please re-enter the exact SWIFT / BIC code to confirm.'
                  );
                  return;
                }
                if (verificationReason.trim().length < 8) {
                  setBankingError(
                    'Please provide a clear verification reason (at least 8 characters) for the audit trail.'
                  );
                  return;
                }
                setSavingBanking(true);
                try {
                  await onSaveBankingDetails(
                    { ...settings, ...bankingDraft },
                    verificationReason.trim()
                  );
                  setBankingUnlocked(false);
                  setConfirmSwift('');
                  setVerificationReason('');
                } finally {
                  setSavingBanking(false);
                }
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { key: 'bankName', label: 'Bank Name' },
                  { key: 'bankBranch', label: 'Branch Name' },
                  { key: 'accountName', label: 'Beneficiary Account Name' },
                  { key: 'accountNumber', label: 'Account Number', mono: true },
                  { key: 'swiftCode', label: 'SWIFT / BIC Code', mono: true },
                  { key: 'bankAddress', label: 'Bank Street Address' },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {f.label}
                    </label>
                    <input
                      type="text"
                      required
                      disabled={!bankingUnlocked}
                      value={bankingDraft[f.key as keyof typeof bankingDraft]}
                      onChange={(e) =>
                        setBankingDraft((prev) => ({
                          ...prev,
                          [f.key]: f.key === 'swiftCode' ? e.target.value.toUpperCase() : e.target.value,
                        }))
                      }
                      className={`w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white disabled:opacity-70 ${
                        f.mono ? 'font-mono' : ''
                      }`}
                    />
                  </div>
                ))}
              </div>

              {bankingUnlocked && canEditBanking && (
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 space-y-3">
                  <div className="text-xs font-bold text-red-900 dark:text-red-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    Secondary Verification Required Before Saving
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-red-900 dark:text-red-200 mb-1">
                        Re-enter SWIFT Code ({bankingDraft.swiftCode}) *
                      </label>
                      <input
                        type="text"
                        required
                        value={confirmSwift}
                        onChange={(e) => setConfirmSwift(e.target.value.toUpperCase())}
                        placeholder="Confirm SWIFT / BIC"
                        className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 border border-red-300 dark:border-red-800 rounded-lg text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-red-900 dark:text-red-200 mb-1">
                        Reason for Banking Change (Audit Log) *
                      </label>
                      <input
                        type="text"
                        required
                        value={verificationReason}
                        onChange={(e) => setVerificationReason(e.target.value)}
                        placeholder="e.g. Verified branch transition approved by director"
                        className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-red-300 dark:border-red-800 rounded-lg text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                  {bankingError && (
                    <div className="text-xs font-semibold text-red-700 dark:text-red-300">
                      {bankingError}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={savingBanking}
                    className="px-5 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer disabled:opacity-60"
                  >
                    {savingBanking
                      ? 'Verifying & Saving...'
                      : 'Confirm & Save Verified Banking Details'}
                  </button>
                </div>
              )}
            </form>
          </div>

          <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <h4 className="text-sm font-bold text-slate-950 dark:text-white">
              Banking Change Audit History
            </h4>
            {bankingAuditLogs.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No corporate wire detail modifications have been logged yet. Every future edit will
                appear here permanently.
              </p>
            ) : (
              <div className="space-y-2.5">
                {bankingAuditLogs.slice(0, 8).map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1"
                  >
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {log.actorEmail}
                    </div>
                    <div className="text-slate-600 dark:text-slate-300">{log.summary}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: BACKUPS, SECURITY AUDIT TRAIL & DEV-ONLY CONTROLS */}
      {subTab === 'security' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-amber-600" />
                Database Backup &amp; Export
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Download a complete, timestamped JSON snapshot of your live inventory, customers,
                orders, quotations, finance records, HR, and settings.
              </p>
            </div>
            {canExport && (
              <button
                type="button"
                onClick={onDownloadFullBackup}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-slate-950 dark:bg-amber-500 dark:text-slate-950 rounded-lg shrink-0 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Download Full JSON Backup
              </button>
            )}
          </div>

          {/* Audit Log Viewer */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-950 dark:text-white">
                  Immutable Security Audit Trail ({auditLogs.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tracks logins, permission updates, banking modifications, auction bid checks, and
                  inventory actions.
                </p>
              </div>
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Filter logs by action, actor, summary..."
                className="px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white sm:w-72"
              />
            </div>

            {filteredAuditLogs.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
                No audit log entries match your filter.
              </p>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-[420px] overflow-y-auto">
                {filteredAuditLogs.slice(0, 60).map((log) => (
                  <div
                    key={log.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold uppercase text-amber-700 dark:text-amber-400">
                          {log.action}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-600 dark:text-slate-300 font-medium">
                          {log.actorEmail} ({log.actorRole})
                        </span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-200">{log.summary}</p>
                    </div>
                    <span className="font-mono text-[11px] text-slate-400 shrink-0">
                      {log.targetType}/{log.targetId}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Restricted Developer Environment — Strictly Hidden in Production */}
          {isDevAdmin ? (
            <div className="bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-mono font-bold uppercase text-red-700 dark:text-red-400">
                    Local Development Environment Only
                  </div>
                  <div className="text-sm font-bold text-slate-950 dark:text-white">
                    Database Seed &amp; Reset Controls
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDevPanelOpen((p) => !p)}
                  className="px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 rounded-lg cursor-pointer"
                >
                  {devPanelOpen ? 'Hide Developer Controls' : 'Expand Developer Controls'}
                </button>
              </div>
              {devPanelOpen && (
                <div className="pt-3 border-t border-red-200 dark:border-red-900 space-y-3">
                  <p className="text-xs text-red-900 dark:text-red-200">
                    These controls are automatically stripped from production builds. Type{' '}
                    <code className="font-mono font-bold">CONFIRM-RESET-DEV</code> below to enable.
                  </p>
                  <input
                    type="text"
                    value={devConfirmPhrase}
                    onChange={(e) => setDevConfirmPhrase(e.target.value)}
                    placeholder="Type CONFIRM-RESET-DEV"
                    className="px-3 py-2 text-xs font-mono bg-white dark:bg-slate-950 border border-red-300 dark:border-red-800 rounded-lg text-slate-900 dark:text-white w-64"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={devConfirmPhrase !== 'CONFIRM-RESET-DEV' || runningDevAction}
                      onClick={async () => {
                        setRunningDevAction(true);
                        try {
                          await onSeedDatabase();
                          setDevConfirmPhrase('');
                        } finally {
                          setRunningDevAction(false);
                        }
                      }}
                      className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg disabled:opacity-40 cursor-pointer"
                    >
                      Seed Development Sample Records
                    </button>
                    <button
                      type="button"
                      disabled={devConfirmPhrase !== 'CONFIRM-RESET-DEV' || runningDevAction}
                      onClick={async () => {
                        setRunningDevAction(true);
                        try {
                          await onClearSampleData();
                          setDevConfirmPhrase('');
                        } finally {
                          setRunningDevAction(false);
                        }
                      }}
                      className="px-4 py-2 text-xs font-semibold text-white bg-red-600 rounded-lg disabled:opacity-40 cursor-pointer"
                    >
                      Clear Development Sample Data
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
              Production Safeguard Active: Destructive database reset and sample-data clearing tools
              are disabled in production environments.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
