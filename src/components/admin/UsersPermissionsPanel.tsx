import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Lock,
  RotateCcw,
  Save,
  Search,
  Shield,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  ADMIN_MODULES,
  ALL_PERMISSION_ACTIONS,
  DEFAULT_ROLE_PERMISSIONS,
  getEffectivePermissions,
  ROLE_METADATA,
} from '../../data/permissions';
import type {
  AdminModuleKey,
  PermissionAction,
  PersistedUserRole,
  RolePermissionsMap,
  UserProfile,
} from '../../types/portal';

interface UsersPermissionsPanelProps {
  users: UserProfile[];
  currentUserUid?: string;
  canEdit: boolean;
  onUpdateUser: (
    uid: string,
    updates: {
      role: PersistedUserRole;
      verified: boolean;
      assignedRepName: string;
      assignedRepEmail: string;
      department?: string;
      permissions?: RolePermissionsMap;
    }
  ) => Promise<void>;
}

const ALL_ROLES = Object.keys(ROLE_METADATA) as PersistedUserRole[];

export function UsersPermissionsPanel({
  users,
  currentUserUid,
  canEdit,
  onUpdateUser,
}: UsersPermissionsPanelProps) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'STAFF' | 'BUYERS'>('ALL');
  const [expandedUid, setExpandedUid] = useState<string | null>(null);
  const [draftPerms, setDraftPerms] = useState<Record<string, RolePermissionsMap>>({});
  const [savingUid, setSavingUid] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const isStaff = ROLE_METADATA[u.role]?.isStaff;
      if (roleFilter === 'STAFF' && !isStaff) return false;
      if (roleFilter === 'BUYERS' && isStaff) return false;
      if (!q) return true;
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.companyName.toLowerCase().includes(q) ||
        (ROLE_METADATA[u.role]?.label || u.role).toLowerCase().includes(q)
      );
    });
  }, [users, search, roleFilter]);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-950 dark:text-white tracking-tight">
            Users, Roles &amp; Permissions
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Assign department roles and fine-tune per-module View, Create, Edit, Delete, Approve,
            and Export permissions enforced on the backend.
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1">
          {(['ALL', 'STAFF', 'BUYERS'] as const).map((tab) => (
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
              {tab === 'ALL' ? `All (${users.length})` : tab === 'STAFF' ? 'Staff Team' : 'Buyers & Dealers'}
            </button>
          ))}
        </div>
      </div>

      {/* Role Architecture Reference Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {ALL_ROLES.map((rKey) => {
          const meta = ROLE_METADATA[rKey];
          const count = users.filter((u) => u.role === rKey).length;
          return (
            <div
              key={rKey}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-950 dark:text-white truncate">
                  {meta.label}
                </span>
                <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                  {count}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                {meta.description}
              </div>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users by name, email, company, or role..."
          className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
        />
      </div>

      {/* User Directory & Expandable Permission Matrix */}
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
            const currentMatrix =
              draftPerms[user.uid] || getEffectivePermissions(user.role, user);

            return (
              <div
                key={user.uid}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
              >
                <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-bold text-slate-950 dark:text-white">
                        {user.displayName}
                      </span>
                      {user.verified && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                          <CheckCircle2 className="w-3 h-3" />
                          Verified
                        </span>
                      )}
                      {isSelf && (
                        <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300">
                          Your Account
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {user.email} · {user.companyName || meta.department}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
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
                            department: ROLE_METADATA[nextRole].department,
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

                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={async () => {
                        setSavingUid(user.uid);
                        try {
                          await onUpdateUser(user.uid, {
                            role: user.role,
                            verified: !user.verified,
                            assignedRepName: user.assignedRepName || '',
                            assignedRepEmail: user.assignedRepEmail || '',
                            department: user.department || meta.department,
                            permissions: user.permissions,
                          });
                        } finally {
                          setSavingUid(null);
                        }
                      }}
                      className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                    >
                      {user.verified ? 'Revoke Verified' : 'Mark Verified'}
                    </button>

                    {meta.isStaff && (
                      <button
                        type="button"
                        onClick={() => openMatrixForUser(user)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-950 dark:bg-amber-500 text-white dark:text-slate-950 cursor-pointer"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        <span>Permissions</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Granular Module x Action Matrix */}
                {isExpanded && meta.isStaff && (
                  <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
                          <Lock className="w-4 h-4 text-amber-600" />
                          Granular Access Matrix — {user.displayName} ({meta.label})
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Changes are persisted to Firestore and enforced by backend security rules.
                        </p>
                      </div>
                      {canEdit && user.role !== 'admin' && (
                        <div className="flex items-center gap-2">
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
                            Reset to Role Defaults
                          </button>
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
                                  permissions: currentMatrix,
                                });
                              } finally {
                                setSavingUid(null);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer disabled:opacity-60"
                          >
                            <Save className="w-3.5 h-3.5" />
                            {savingUid === user.uid ? 'Saving...' : 'Save Permissions'}
                          </button>
                        </div>
                      )}
                    </div>

                    {user.role === 'admin' && (
                      <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-300">
                        Owner / Super Admin accounts always retain full system access across all 16
                        modules.
                      </div>
                    )}

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
    </div>
  );
}
