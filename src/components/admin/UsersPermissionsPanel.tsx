import {
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  KeyRound,
  Lock,
  Mail,
  RotateCcw,
  Save,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Table2,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  ADMIN_MODULES,
  ALL_PERMISSION_ACTIONS,
  COMPANY_DEPARTMENTS,
  DEFAULT_ROLE_PERMISSIONS,
  DESIGNATION_LABELS,
  getEffectivePermissions,
  resolveRoleFromDepartment,
  ROLE_METADATA,
} from '../../data/permissions';
import type {
  AccountStatus,
  AdminModuleKey,
  DesignationLevel,
  PermissionAction,
  PersistedUserRole,
  RolePermissionsMap,
  StaffInvitation,
  UserProfile,
} from '../../types/portal';

interface UsersPermissionsPanelProps {
  users: UserProfile[];
  staffInvitations: StaffInvitation[];
  currentUserUid?: string;
  currentUserEmail?: string;
  canCreate: boolean;
  canEdit: boolean;
  onUpdateUser: (
    uid: string,
    updates: {
      role: PersistedUserRole;
      verified: boolean;
      assignedRepName: string;
      assignedRepEmail: string;
      department?: string;
      designationLevel?: DesignationLevel;
      employeeCode?: string;
      reportingManagerName?: string;
      accountStatus?: AccountStatus;
      twoFactorRequired?: boolean;
      permissions?: RolePermissionsMap;
    }
  ) => Promise<void>;
  onCreateInvitation: (
    input: Omit<StaffInvitation, 'id' | 'status' | 'acceptedByUid' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onRevokeInvitation: (inviteId: string) => Promise<void>;
}

const ALL_ROLES = Object.keys(ROLE_METADATA) as PersistedUserRole[];

const PERMISSION_REFERENCE_ROWS: Array<{
  area: string;
  owner: 'full' | 'limited' | 'none';
  hr: 'full' | 'limited' | 'none';
  sales: 'full' | 'limited' | 'none';
  accounts: 'full' | 'limited' | 'none';
  customer: 'full' | 'limited' | 'none';
  note: string;
}> = [
  {
    area: 'Employees & Invitations',
    owner: 'full',
    hr: 'full',
    sales: 'none',
    accounts: 'limited',
    customer: 'none',
    note: 'Only Admin/Owner can provision staff invitations or suspend accounts',
  },
  {
    area: 'Customers & CRM Leads',
    owner: 'full',
    hr: 'none',
    sales: 'full',
    accounts: 'limited',
    customer: 'none',
    note: 'Customers can only view their own profile and orders',
  },
  {
    area: 'Sales & Quotations',
    owner: 'full',
    hr: 'none',
    sales: 'full',
    accounts: 'limited',
    customer: 'limited',
    note: 'Sales Executives manage assigned deals; Sales Managers approve ceilings',
  },
  {
    area: 'Company Profit & Margin',
    owner: 'full',
    hr: 'none',
    sales: 'none',
    accounts: 'full',
    customer: 'none',
    note: 'Strictly hidden from Sales, HR, Operations, IT, and Customers',
  },
  {
    area: 'Employee Salaries & Payroll',
    owner: 'full',
    hr: 'full',
    sales: 'none',
    accounts: 'full',
    customer: 'none',
    note: 'Restricted to Owner, Management, HR, and Accounts',
  },
  {
    area: 'Invoices & Billing',
    owner: 'full',
    hr: 'none',
    sales: 'limited',
    accounts: 'full',
    customer: 'limited',
    note: 'Customers download only their own Proforma & Commercial invoices',
  },
  {
    area: 'Payments & Bank Details',
    owner: 'full',
    hr: 'none',
    sales: 'none',
    accounts: 'full',
    customer: 'limited',
    note: 'Corporate bank detail changes require verified authorization & audit log',
  },
  {
    area: 'Vehicle Stock & Auctions',
    owner: 'full',
    hr: 'none',
    sales: 'limited',
    accounts: 'limited',
    customer: 'limited',
    note: 'Operations & Management manage stock publishing and auction bids',
  },
  {
    area: 'Export Orders & Logistics',
    owner: 'full',
    hr: 'none',
    sales: 'limited',
    accounts: 'limited',
    customer: 'limited',
    note: '9-step cross-department collaboration on one unified order record',
  },
  {
    area: 'System Settings & Backups',
    owner: 'full',
    hr: 'none',
    sales: 'none',
    accounts: 'none',
    customer: 'none',
    note: 'Owner, Management, and IT maintain settings, backups, and security logs',
  },
];

function generateEmployeeCode(): string {
  const num = Math.floor(100 + Math.random() * 899);
  return `EMP-2026-${num}`;
}

function MatrixSymbol({ level }: { level: 'full' | 'limited' | 'none' }) {
  if (level === 'full') {
    return (
      <span
        title="Full or authorized access"
        className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-xs"
      >
        ✓
      </span>
    );
  }
  if (level === 'limited') {
    return (
      <span
        title="Limited / own-record access"
        className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold text-xs"
      >
        ◐
      </span>
    );
  }
  return (
    <span
      title="No access"
      className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-bold text-xs"
    >
      —
    </span>
  );
}

export function UsersPermissionsPanel({
  users,
  staffInvitations,
  currentUserUid,
  currentUserEmail,
  canCreate,
  canEdit,
  onUpdateUser,
  onCreateInvitation,
  onRevokeInvitation,
}: UsersPermissionsPanelProps) {
  const [activeTab, setActiveTab] = useState<'directory' | 'invite' | 'invitations' | 'matrix'>(
    'directory'
  );
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'STAFF' | 'BUYERS' | 'SUSPENDED'>('ALL');
  const [expandedUid, setExpandedUid] = useState<string | null>(null);
  const [draftPerms, setDraftPerms] = useState<Record<string, RolePermissionsMap>>({});
  const [draftMeta, setDraftMeta] = useState<
    Record<
      string,
      {
        department: string;
        designationLevel: DesignationLevel;
        employeeCode: string;
        reportingManagerName: string;
        twoFactorRequired: boolean;
      }
    >
  >({});
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Add New Employee Invitation State (3-level permission builder)
  const [invName, setInvName] = useState('');
  const [invCode, setInvCode] = useState(generateEmployeeCode);
  const [invEmail, setInvEmail] = useState('');
  const [invDepartment, setInvDepartment] = useState<string>('Sales');
  const [invDesignation, setInvDesignation] = useState<DesignationLevel>('executive');
  const [invManager, setInvManager] = useState('');
  const [invRequire2FA, setInvRequire2FA] = useState(true);
  const [invPerms, setInvPerms] = useState<RolePermissionsMap>(
    () => ({ ...(DEFAULT_ROLE_PERMISSIONS.sales || {}) })
  );
  const [showCustomInviteMatrix, setShowCustomInviteMatrix] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const computedInviteRole = useMemo(
    () => resolveRoleFromDepartment(invDepartment, invDesignation),
    [invDepartment, invDesignation]
  );

  const staffNames = useMemo(
    () =>
      users
        .filter((u) => ROLE_METADATA[u.role]?.isStaff)
        .map((u) => u.displayName)
        .filter(Boolean),
    [users]
  );

  const pendingInvitesCount = useMemo(
    () => staffInvitations.filter((i) => i.status === 'pending').length,
    [staffInvitations]
  );

  const suspendedUsersCount = useMemo(
    () => users.filter((u) => u.accountStatus === 'suspended').length,
    [users]
  );

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const isStaff = ROLE_METADATA[u.role]?.isStaff;
      if (roleFilter === 'STAFF' && !isStaff) return false;
      if (roleFilter === 'BUYERS' && isStaff) return false;
      if (roleFilter === 'SUSPENDED' && u.accountStatus !== 'suspended') return false;
      if (!q) return true;
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.companyName.toLowerCase().includes(q) ||
        (u.employeeCode || '').toLowerCase().includes(q) ||
        (u.department || '').toLowerCase().includes(q) ||
        (ROLE_METADATA[u.role]?.label || u.role).toLowerCase().includes(q)
      );
    });
  }, [users, search, roleFilter]);

  const handleDepartmentOrDesignationChange = (
    nextDept: string,
    nextDesig: DesignationLevel
  ) => {
    setInvDepartment(nextDept);
    setInvDesignation(nextDesig);
    const nextRole = resolveRoleFromDepartment(nextDept, nextDesig);
    setInvPerms({ ...(DEFAULT_ROLE_PERMISSIONS[nextRole] || {}) });
    setInvRequire2FA(['admin', 'management', 'accounts', 'hr', 'it'].includes(nextRole));
  };

  const toggleInvitePermission = (moduleKey: AdminModuleKey, action: PermissionAction) => {
    setInvPerms((prev) => {
      const curr = prev[moduleKey] || [];
      const next = curr.includes(action) ? curr.filter((a) => a !== action) : [...curr, action];
      return { ...prev, [moduleKey]: next };
    });
  };

  const handleCreateInvitationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError('');
    const normalizedEmail = invEmail.trim().toLowerCase();
    if (!invName.trim() || !normalizedEmail || !normalizedEmail.includes('@')) {
      setInviteError('Please provide the employee name and a valid official company email.');
      return;
    }
    if (
      staffInvitations.some(
        (i) => i.officialEmail.toLowerCase() === normalizedEmail && i.status === 'pending'
      )
    ) {
      setInviteError('A pending invitation already exists for this official email address.');
      return;
    }
    setCreatingInvite(true);
    try {
      await onCreateInvitation({
        employeeName: invName.trim(),
        employeeCode: invCode.trim().toUpperCase() || generateEmployeeCode(),
        officialEmail: normalizedEmail,
        department: invDepartment,
        designationLevel: invDesignation,
        reportingManagerName: invManager.trim(),
        role: computedInviteRole,
        permissions: invPerms,
        twoFactorRequired: invRequire2FA,
        invitedByUid: currentUserUid || 'admin',
        invitedByEmail: currentUserEmail || 'admin@auziotraders.com',
      });
      setInvName('');
      setInvCode(generateEmployeeCode());
      setInvEmail('');
      setInvManager('');
      setActiveTab('invitations');
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Unable to create invitation.');
    } finally {
      setCreatingInvite(false);
    }
  };

  const openMatrixForUser = (user: UserProfile) => {
    if (expandedUid === user.uid) {
      setExpandedUid(null);
      return;
    }
    setExpandedUid(user.uid);
    if (!draftPerms[user.uid]) {
      setDraftPerms((prev) => ({
        ...prev,
        [user.uid]: getEffectivePermissions(user.role, user),
      }));
    }
    if (!draftMeta[user.uid]) {
      setDraftMeta((prev) => ({
        ...prev,
        [user.uid]: {
          department: user.department || ROLE_METADATA[user.role]?.department || 'Sales',
          designationLevel: user.designationLevel || (user.role === 'admin' ? 'director' : 'executive'),
          employeeCode: user.employeeCode || '',
          reportingManagerName: user.reportingManagerName || '',
          twoFactorRequired: Boolean(user.twoFactorRequired),
        },
      }));
    }
  };

  const togglePermission = (
    uid: string,
    moduleKey: AdminModuleKey,
    action: PermissionAction
  ) => {
    setDraftPerms((prev) => {
      const currentMap = prev[uid] || {};
      const currentActions = currentMap[moduleKey] || [];
      const exists = currentActions.includes(action);
      const nextActions = exists
        ? currentActions.filter((a) => a !== action)
        : [...currentActions, action];
      return {
        ...prev,
        [uid]: {
          ...currentMap,
          [moduleKey]: nextActions,
        },
      };
    });
  };

  const copyPortalUrl = (id: string) => {
    try {
      void navigator.clipboard.writeText(window.location.origin);
      setCopiedId(id);
      setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 2500);
    } catch {
      // Clipboard blocked
    }
  };

  return (
    <div className="space-y-6">
      {/* Header + Primary Action Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-950 dark:text-white tracking-tight">
            Employee Accounts, Roles &amp; Permissions
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            3-level access control (Department → Designation Level → Module Permissions),
            invitation-only staff onboarding, and immediate account suspension.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1">
          <button
            type="button"
            onClick={() => setActiveTab('directory')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg cursor-pointer ${
              activeTab === 'directory'
                ? 'bg-slate-950 dark:bg-amber-500 text-white dark:text-slate-950'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Directory ({users.length})
          </button>
          {canCreate && (
            <button
              type="button"
              onClick={() => setActiveTab('invite')}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg cursor-pointer ${
                activeTab === 'invite'
                  ? 'bg-slate-950 dark:bg-amber-500 text-white dark:text-slate-950'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add Employee
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('invitations')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg cursor-pointer ${
              activeTab === 'invitations'
                ? 'bg-slate-950 dark:bg-amber-500 text-white dark:text-slate-950'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            Invitations
            {pendingInvitesCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-amber-500 text-slate-950">
                {pendingInvitesCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg cursor-pointer ${
              activeTab === 'matrix'
                ? 'bg-slate-950 dark:bg-amber-500 text-white dark:text-slate-950'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Table2 className="w-3.5 h-3.5" />
            Permission Matrix
          </button>
        </div>
      </div>

      {/* TAB 1: ADD NEW EMPLOYEE (3-LEVEL PROVISIONING) */}
      {activeTab === 'invite' && canCreate && (
        <form
          onSubmit={handleCreateInvitationSubmit}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-950 dark:text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-600" />
                Add New Employee &amp; Provision Access Invitation
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Employees cannot self-register. Once invited, signing in with their official email
                automatically activates their assigned department dashboard and permissions.
              </p>
            </div>
            <div className="px-3 py-2 rounded-lg bg-slate-950 dark:bg-slate-800 text-white text-xs shrink-0">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">
                Computed Role
              </div>
              <div className="font-bold text-amber-400">
                {ROLE_METADATA[computedInviteRole]?.label}
              </div>
            </div>
          </div>

          {inviteError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-300">
              {inviteError}
            </div>
          )}

          {/* Step 1: Identity */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Employee Full Name *
              </label>
              <input
                type="text"
                required
                value={invName}
                onChange={(e) => setInvName(e.target.value)}
                placeholder="e.g. Hiroshi Sato"
                className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Employee ID *
              </label>
              <input
                type="text"
                required
                value={invCode}
                onChange={(e) => setInvCode(e.target.value)}
                placeholder="EMP-2026-104"
                className="w-full px-3 py-2.5 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Official Company Google Email *
              </label>
              <input
                type="email"
                required
                value={invEmail}
                onChange={(e) => setInvEmail(e.target.value)}
                placeholder="name@auziotraders.com"
                className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Step 2: Department & Designation Level */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Level 1 · Department *
              </label>
              <select
                value={invDepartment}
                onChange={(e) => handleDepartmentOrDesignationChange(e.target.value, invDesignation)}
                className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              >
                {COMPANY_DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Level 2 · Designation Level *
              </label>
              <select
                value={invDesignation}
                onChange={(e) =>
                  handleDepartmentOrDesignationChange(
                    invDepartment,
                    e.target.value as DesignationLevel
                  )
                }
                className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              >
                {(Object.keys(DESIGNATION_LABELS) as DesignationLevel[]).map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {DESIGNATION_LABELS[lvl]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Reporting Manager
              </label>
              <input
                type="text"
                list="auzio-staff-managers"
                value={invManager}
                onChange={(e) => setInvManager(e.target.value)}
                placeholder="e.g. Trade Director"
                className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
              <datalist id="auzio-staff-managers">
                {staffNames.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Security Policy Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={invRequire2FA}
                onChange={(e) => setInvRequire2FA(e.target.checked)}
                className="w-4 h-4 accent-amber-600"
              />
              <KeyRound className="w-4 h-4 text-amber-600" />
              Require 2-Factor Authentication (2FA) on Google Account (Recommended for Admin,
              Accounts &amp; HR)
            </label>
            <button
              type="button"
              onClick={() => setShowCustomInviteMatrix((s) => !s)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5" />
              {showCustomInviteMatrix
                ? 'Hide Level 3 Module Matrix'
                : 'Customize Level 3 Module Permissions'}
            </button>
          </div>

          {/* Step 3: Optional Granular Module Matrix */}
          {showCustomInviteMatrix && (
            <div className="overflow-x-auto bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase">
                  <tr>
                    <th className="px-4 py-2.5">Module</th>
                    {ALL_PERMISSION_ACTIONS.map((act) => (
                      <th key={act} className="px-3 py-2.5 text-center">
                        {act}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {ADMIN_MODULES.map((mod) => {
                    const modActions = invPerms[mod.key] || [];
                    return (
                      <tr key={mod.key} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-2 font-semibold text-slate-900 dark:text-white">
                          {mod.label}
                        </td>
                        {ALL_PERMISSION_ACTIONS.map((act) => (
                          <td key={act} className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={computedInviteRole === 'admin' || modActions.includes(act)}
                              disabled={computedInviteRole === 'admin'}
                              onChange={() => toggleInvitePermission(mod.key, act)}
                              className="w-4 h-4 accent-amber-600 cursor-pointer"
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('directory')}
              className="px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creatingInvite}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg cursor-pointer disabled:opacity-60"
            >
              <UserPlus className="w-4 h-4" />
              {creatingInvite ? 'Creating Invitation...' : 'Create Employee Account & Invitation'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: PENDING & ACCEPTED INVITATIONS */}
      {activeTab === 'invitations' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-950 dark:text-white">
                Provisioned Staff Invitations
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Share the portal login URL with invited employees. Their role activates automatically
                upon verified Google sign-in.
              </p>
            </div>
            {canCreate && (
              <button
                type="button"
                onClick={() => setActiveTab('invite')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                New Employee Invite
              </button>
            )}
          </div>

          {staffInvitations.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
              No employee invitations provisioned yet. Click &ldquo;Add Employee&rdquo; to invite
              your first department team member.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {staffInvitations.map((inv) => (
                <div
                  key={inv.id}
                  className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-950 dark:text-white">
                        {inv.employeeName}
                      </span>
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {inv.employeeCode}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-[11px] font-bold uppercase rounded ${
                          inv.status === 'accepted'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                            : inv.status === 'revoked'
                            ? 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300'
                            : 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300'
                        }`}
                      >
                        {inv.status}
                      </span>
                      {inv.twoFactorRequired && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                          <KeyRound className="w-3 h-3" />
                          2FA Policy
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {inv.officialEmail} · {inv.department} ({DESIGNATION_LABELS[inv.designationLevel]})
                      → <strong className="text-slate-800 dark:text-slate-200">{ROLE_METADATA[inv.role]?.label}</strong>
                      {inv.reportingManagerName ? ` · Reports to ${inv.reportingManagerName}` : ''}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {inv.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() => copyPortalUrl(inv.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          {copiedId === inv.id ? 'Login URL Copied' : 'Copy Login URL'}
                        </button>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => void onRevokeInvitation(inv.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 hover:bg-red-100 cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Revoke
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PERMISSION MATRIX REFERENCE */}
      {activeTab === 'matrix' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-950 dark:text-white">
                Company-Wide Department Permission Matrix
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                ✓ Full or authorized access · ◐ Limited / own-record access · — No access (enforced
                in UI &amp; Firestore security rules)
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase">
                <tr>
                  <th className="px-4 py-3">Business Module / Data Area</th>
                  <th className="px-3 py-3 text-center">Owner</th>
                  <th className="px-3 py-3 text-center">HR</th>
                  <th className="px-3 py-3 text-center">Sales</th>
                  <th className="px-3 py-3 text-center">Accounts</th>
                  <th className="px-3 py-3 text-center">Customer</th>
                  <th className="px-4 py-3">Enforcement Rule</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {PERMISSION_REFERENCE_ROWS.map((row) => (
                  <tr key={row.area} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                      {row.area}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <MatrixSymbol level={row.owner} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <MatrixSymbol level={row.hr} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <MatrixSymbol level={row.sales} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <MatrixSymbol level={row.accounts} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <MatrixSymbol level={row.customer} />
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: ACTIVE & SUSPENDED USER DIRECTORY */}
      {activeTab === 'directory' && (
        <>
          {/* Filter + Search Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, employee ID, email, department, or role..."
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1">
              {(['ALL', 'STAFF', 'BUYERS', 'SUSPENDED'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setRoleFilter(tab)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                    roleFilter === tab
                      ? 'bg-slate-950 dark:bg-amber-500 text-white dark:text-slate-950'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {tab === 'ALL'
                    ? `All (${users.length})`
                    : tab === 'STAFF'
                    ? 'Staff Team'
                    : tab === 'BUYERS'
                    ? 'Buyers & Dealers'
                    : `Suspended (${suspendedUsersCount})`}
                </button>
              ))}
            </div>
          </div>

          {/* User Directory & Expandable 3-Level Permission Editor */}
          <div className="space-y-3">
            {filteredUsers.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center text-sm text-slate-500 dark:text-slate-400">
                <Users className="w-7 h-7 mx-auto mb-2 text-slate-400" />
                No matching user accounts found.
              </div>
            ) : (
              filteredUsers.map((user) => {
                const meta = ROLE_METADATA[user.role] || ROLE_METADATA.customer;
                const isExpanded = expandedUid === user.uid;
                const isSelf = currentUserUid === user.uid;
                const isSuspended = user.accountStatus === 'suspended';
                const currentMatrix =
                  draftPerms[user.uid] || getEffectivePermissions(user.role, user);
                const currentMeta = draftMeta[user.uid] || {
                  department: user.department || meta.department,
                  designationLevel:
                    user.designationLevel || (user.role === 'admin' ? 'director' : 'executive'),
                  employeeCode: user.employeeCode || '',
                  reportingManagerName: user.reportingManagerName || '',
                  twoFactorRequired: Boolean(user.twoFactorRequired),
                };

                return (
                  <div
                    key={user.uid}
                    className={`bg-white dark:bg-slate-900 border rounded-xl overflow-hidden ${
                      isSuspended
                        ? 'border-red-300 dark:border-red-900/70 bg-red-50/20 dark:bg-red-950/10'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-bold text-slate-950 dark:text-white">
                            {user.displayName}
                          </span>
                          {user.employeeCode && (
                            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {user.employeeCode}
                            </span>
                          )}
                          {isSuspended ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300">
                              <ShieldAlert className="w-3 h-3" />
                              Suspended
                            </span>
                          ) : (
                            user.verified && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                                <CheckCircle2 className="w-3 h-3" />
                                Active &amp; Verified
                              </span>
                            )
                          )}
                          {user.twoFactorRequired && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                              <ShieldCheck className="w-3 h-3" />
                              2FA Policy
                            </span>
                          )}
                          {isSelf && (
                            <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300">
                              Your Account
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {user.email} · {user.department || user.companyName || meta.department}
                          {user.designationLevel
                            ? ` (${DESIGNATION_LABELS[user.designationLevel]})`
                            : ''}
                          {user.reportingManagerName
                            ? ` · Manager: ${user.reportingManagerName}`
                            : ''}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          disabled={!canEdit || isSelf}
                          value={user.role}
                          onChange={async (e) => {
                            const nextRole = e.target.value as PersistedUserRole;
                            const nextDefaults = DEFAULT_ROLE_PERMISSIONS[nextRole] || {};
                            setSavingUid(user.uid);
                            try {
                              await onUpdateUser(user.uid, {
                                role: nextRole,
                                verified: user.verified,
                                assignedRepName: user.assignedRepName || '',
                                assignedRepEmail: user.assignedRepEmail || '',
                                department: user.department || ROLE_METADATA[nextRole].department,
                                designationLevel: user.designationLevel,
                                employeeCode: user.employeeCode,
                                reportingManagerName: user.reportingManagerName,
                                accountStatus: user.accountStatus || 'active',
                                twoFactorRequired: user.twoFactorRequired,
                                permissions: nextDefaults,
                              });
                              setDraftPerms((prev) => ({ ...prev, [user.uid]: nextDefaults }));
                            } finally {
                              setSavingUid(null);
                            }
                          }}
                          className="px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white disabled:opacity-60"
                        >
                          {ALL_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_METADATA[r].label}
                            </option>
                          ))}
                        </select>

                        {/* Immediate Suspension / Restore Access */}
                        {!isSelf && canEdit && (
                          <button
                            type="button"
                            disabled={savingUid === user.uid}
                            onClick={async () => {
                              setSavingUid(user.uid);
                              try {
                                await onUpdateUser(user.uid, {
                                  role: user.role,
                                  verified: user.verified,
                                  assignedRepName: user.assignedRepName || '',
                                  assignedRepEmail: user.assignedRepEmail || '',
                                  department: user.department || meta.department,
                                  designationLevel: user.designationLevel,
                                  employeeCode: user.employeeCode,
                                  reportingManagerName: user.reportingManagerName,
                                  accountStatus: isSuspended ? 'active' : 'suspended',
                                  twoFactorRequired: user.twoFactorRequired,
                                  permissions: user.permissions,
                                });
                              } finally {
                                setSavingUid(null);
                              }
                            }}
                            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg cursor-pointer disabled:opacity-50 ${
                              isSuspended
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 hover:bg-red-100'
                            }`}
                          >
                            {isSuspended ? (
                              <>
                                <UserCheck className="w-3.5 h-3.5" />
                                Restore Access
                              </>
                            ) : (
                              <>
                                <Ban className="w-3.5 h-3.5" />
                                Suspend
                              </>
                            )}
                          </button>
                        )}

                        {meta.isStaff && (
                          <button
                            type="button"
                            onClick={() => openMatrixForUser(user)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-950 dark:bg-amber-500 text-white dark:text-slate-950 cursor-pointer"
                          >
                            <Shield className="w-3.5 h-3.5" />
                            <span>Access</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expanded 3-Level Hierarchy & Granular Permission Editor */}
                    {isExpanded && meta.isStaff && (
                      <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-5 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                          <div>
                            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                              Department
                            </label>
                            <select
                              disabled={!canEdit}
                              value={currentMeta.department}
                              onChange={(e) =>
                                setDraftMeta((prev) => ({
                                  ...prev,
                                  [user.uid]: { ...currentMeta, department: e.target.value },
                                }))
                              }
                              className="w-full px-2.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                            >
                              {COMPANY_DEPARTMENTS.map((d) => (
                                <option key={d} value={d}>
                                  {d}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                              Designation Level
                            </label>
                            <select
                              disabled={!canEdit}
                              value={currentMeta.designationLevel}
                              onChange={(e) =>
                                setDraftMeta((prev) => ({
                                  ...prev,
                                  [user.uid]: {
                                    ...currentMeta,
                                    designationLevel: e.target.value as DesignationLevel,
                                  },
                                }))
                              }
                              className="w-full px-2.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                            >
                              {(Object.keys(DESIGNATION_LABELS) as DesignationLevel[]).map((lvl) => (
                                <option key={lvl} value={lvl}>
                                  {DESIGNATION_LABELS[lvl]}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                              Employee ID
                            </label>
                            <input
                              type="text"
                              disabled={!canEdit}
                              value={currentMeta.employeeCode}
                              onChange={(e) =>
                                setDraftMeta((prev) => ({
                                  ...prev,
                                  [user.uid]: { ...currentMeta, employeeCode: e.target.value },
                                }))
                              }
                              placeholder="EMP-2026-001"
                              className="w-full px-2.5 py-2 font-mono rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                            />
                          </div>
                          <div>
                            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                              Reporting Manager
                            </label>
                            <input
                              type="text"
                              disabled={!canEdit}
                              value={currentMeta.reportingManagerName}
                              onChange={(e) =>
                                setDraftMeta((prev) => ({
                                  ...prev,
                                  [user.uid]: {
                                    ...currentMeta,
                                    reportingManagerName: e.target.value,
                                  },
                                }))
                              }
                              placeholder="Manager name"
                              className="w-full px-2.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-4">
                            <div className="text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
                              <Lock className="w-4 h-4 text-amber-600" />
                              Granular Module Matrix — {user.displayName}
                            </div>
                            <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                              <input
                                type="checkbox"
                                disabled={!canEdit}
                                checked={currentMeta.twoFactorRequired}
                                onChange={(e) =>
                                  setDraftMeta((prev) => ({
                                    ...prev,
                                    [user.uid]: {
                                      ...currentMeta,
                                      twoFactorRequired: e.target.checked,
                                    },
                                  }))
                                }
                                className="accent-amber-600"
                              />
                              Require 2FA Policy
                            </label>
                          </div>

                          {canEdit && (
                            <div className="flex items-center gap-2">
                              {user.role !== 'admin' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDraftPerms((prev) => ({
                                      ...prev,
                                      [user.uid]: DEFAULT_ROLE_PERMISSIONS[user.role] || {},
                                    }))
                                  }
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  Reset Defaults
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={savingUid === user.uid}
                                onClick={async () => {
                                  setSavingUid(user.uid);
                                  try {
                                    await onUpdateUser(user.uid, {
                                      role: user.role,
                                      verified: user.verified,
                                      assignedRepName: user.assignedRepName || '',
                                      assignedRepEmail: user.assignedRepEmail || '',
                                      department: currentMeta.department,
                                      designationLevel: currentMeta.designationLevel,
                                      employeeCode: currentMeta.employeeCode,
                                      reportingManagerName: currentMeta.reportingManagerName,
                                      accountStatus: user.accountStatus || 'active',
                                      twoFactorRequired: currentMeta.twoFactorRequired,
                                      permissions: currentMatrix,
                                    });
                                  } finally {
                                    setSavingUid(null);
                                  }
                                }}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer disabled:opacity-60"
                              >
                                <Save className="w-3.5 h-3.5" />
                                {savingUid === user.uid ? 'Saving...' : 'Save Access Profile'}
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="overflow-x-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase">
                              <tr>
                                <th className="px-4 py-2.5">Module</th>
                                {ALL_PERMISSION_ACTIONS.map((act) => (
                                  <th key={act} className="px-3 py-2.5 text-center">
                                    {act}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                              {ADMIN_MODULES.map((mod) => {
                                const modActions = currentMatrix[mod.key] || [];
                                const isBanking = mod.key === 'banking';
                                return (
                                  <tr
                                    key={mod.key}
                                    className={
                                      isBanking
                                        ? 'bg-red-50/40 dark:bg-red-950/20'
                                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                                    }
                                  >
                                    <td className="px-4 py-2.5">
                                      <div className="font-semibold text-slate-900 dark:text-white">
                                        {mod.label}
                                      </div>
                                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                        {mod.department}
                                      </div>
                                    </td>
                                    {ALL_PERMISSION_ACTIONS.map((act) => {
                                      const checked =
                                        user.role === 'admin' || modActions.includes(act);
                                      return (
                                        <td key={act} className="px-3 py-2.5 text-center">
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            disabled={!canEdit || user.role === 'admin'}
                                            onChange={() =>
                                              togglePermission(user.uid, mod.key, act)
                                            }
                                            aria-label={`${mod.label} ${act}`}
                                            className="w-4 h-4 rounded accent-amber-600 cursor-pointer disabled:opacity-50"
                                          />
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
