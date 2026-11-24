import type {
  AdminModuleKey,
  PermissionAction,
  PersistedUserRole,
  RolePermissionsMap,
  UserProfile,
  UserRole,
} from '../types/portal';

export const ALL_PERMISSION_ACTIONS: PermissionAction[] = [
  'view',
  'create',
  'edit',
  'delete',
  'approve',
  'export',
];

export const ADMIN_MODULES: Array<{
  key: AdminModuleKey;
  label: string;
  department: string;
}> = [
  { key: 'dashboard', label: 'Dashboard', department: 'Executive' },
  { key: 'crm', label: 'CRM & Leads', department: 'CRM' },
  { key: 'sales', label: 'Sales & Quotations', department: 'Sales' },
  { key: 'inventory', label: 'Inventory', department: 'Inventory' },
  { key: 'auctions', label: 'Auctions', department: 'Auctions' },
  { key: 'orders', label: 'Orders', department: 'Operations' },
  { key: 'logistics', label: 'Logistics', department: 'Operations' },
  { key: 'accounts', label: 'Accounts & Finance', department: 'Finance' },
  { key: 'banking', label: 'Banking Details', department: 'Finance (Protected)' },
  { key: 'hr', label: 'Human Resources', department: 'HR' },
  { key: 'documents', label: 'Documents', department: 'Documentation' },
  { key: 'reports', label: 'Reports & Tasks', department: 'Analytics' },
  { key: 'cms', label: 'Website CMS', department: 'Marketing' },
  { key: 'ai', label: 'AI & Automation', department: 'Automation' },
  { key: 'users', label: 'Users & Roles', department: 'Administration' },
  { key: 'settings', label: 'Settings & Backups', department: 'Administration' },
];

export const ROLE_METADATA: Record<
  PersistedUserRole,
  { label: string; department: string; description: string; isStaff: boolean }
> = {
  admin: {
    label: 'Owner / Super Admin',
    department: 'Executive',
    description: 'Complete business, security, banking, and permission control',
    isStaff: true,
  },
  management: {
    label: 'Management',
    department: 'Executive',
    description: 'Reports, performance oversight, approvals, and website CMS',
    isStaff: true,
  },
  sales_manager: {
    label: 'Sales Manager',
    department: 'Sales',
    description: 'Sales team targets, quotations, commissions, and CRM pipeline',
    isStaff: true,
  },
  sales: {
    label: 'Sales Executive',
    department: 'Sales',
    description: 'Assigned leads, customer follow-ups, and export quotations',
    isStaff: true,
  },
  accounts: {
    label: 'Accounts & Finance',
    department: 'Finance',
    description: 'Invoices, payments, expenses, P&L, and bank reconciliation',
    isStaff: true,
  },
  operations: {
    label: 'Operations & Logistics',
    department: 'Operations',
    description: 'Inventory, auction bidding, inspections, shipping, and documents',
    isStaff: true,
  },
  hr: {
    label: 'Human Resources',
    department: 'HR',
    description: 'Employee directory, attendance, salaries, and leave approvals',
    isStaff: true,
  },
  it: {
    label: 'IT Department',
    department: 'Technology',
    description: 'Technical settings, API integrations, backups, and security logs',
    isStaff: true,
  },
  dealer: {
    label: 'Dealer Partner',
    department: 'External Buyer',
    description: 'Authorized wholesale stock, auction bidding, and order tracking',
    isStaff: false,
  },
  customer: {
    label: 'Customer',
    department: 'External Buyer',
    description: 'Own sourcing requests, quotations, orders, and export documents',
    isStaff: false,
  },
};

export const STAFF_ROLES: PersistedUserRole[] = [
  'admin',
  'management',
  'sales_manager',
  'sales',
  'accounts',
  'operations',
  'hr',
  'it',
];

const FULL_ACCESS: PermissionAction[] = ['view', 'create', 'edit', 'delete', 'approve', 'export'];

function buildFullMap(): RolePermissionsMap {
  const map: RolePermissionsMap = {};
  for (const mod of ADMIN_MODULES) {
    map[mod.key] = [...FULL_ACCESS];
  }
  return map;
}

export const DEFAULT_ROLE_PERMISSIONS: Record<PersistedUserRole, RolePermissionsMap> = {
  admin: buildFullMap(),
  management: {
    dashboard: ['view', 'export'],
    crm: ['view', 'edit', 'approve', 'export'],
    sales: ['view', 'create', 'edit', 'approve', 'export'],
    inventory: ['view', 'create', 'edit', 'approve', 'export'],
    auctions: ['view', 'edit', 'approve', 'export'],
    orders: ['view', 'edit', 'approve', 'export'],
    logistics: ['view', 'edit', 'approve', 'export'],
    accounts: ['view', 'approve', 'export'],
    banking: ['view'],
    hr: ['view', 'approve', 'export'],
    documents: ['view', 'create', 'edit', 'approve', 'export'],
    reports: ['view', 'create', 'export'],
    cms: ['view', 'create', 'edit', 'delete', 'approve'],
    ai: ['view', 'create'],
    users: ['view', 'edit'],
    settings: ['view', 'export'],
  },
  sales_manager: {
    dashboard: ['view', 'export'],
    crm: ['view', 'create', 'edit', 'approve', 'export'],
    sales: ['view', 'create', 'edit', 'approve', 'export'],
    inventory: ['view', 'export'],
    auctions: ['view', 'create', 'edit', 'approve'],
    orders: ['view', 'create', 'edit', 'export'],
    logistics: ['view'],
    accounts: ['view'],
    banking: [],
    hr: [],
    documents: ['view', 'create'],
    reports: ['view', 'create', 'export'],
    cms: ['view'],
    ai: ['view', 'create'],
    users: ['view'],
    settings: [],
  },
  sales: {
    dashboard: ['view'],
    crm: ['view', 'create', 'edit'],
    sales: ['view', 'create', 'edit'],
    inventory: ['view'],
    auctions: ['view', 'create'],
    orders: ['view'],
    logistics: ['view'],
    accounts: [],
    banking: [],
    hr: [],
    documents: ['view'],
    reports: ['view'],
    cms: [],
    ai: ['view', 'create'],
    users: [],
    settings: [],
  },
  accounts: {
    dashboard: ['view', 'export'],
    crm: ['view'],
    sales: ['view', 'export'],
    inventory: ['view'],
    auctions: ['view'],
    orders: ['view', 'edit', 'export'],
    logistics: ['view'],
    accounts: ['view', 'create', 'edit', 'approve', 'export'],
    banking: ['view'],
    hr: ['view'],
    documents: ['view', 'create', 'export'],
    reports: ['view', 'export'],
    cms: [],
    ai: ['view', 'create'],
    users: [],
    settings: ['view'],
  },
  operations: {
    dashboard: ['view'],
    crm: ['view'],
    sales: ['view'],
    inventory: ['view', 'create', 'edit', 'export'],
    auctions: ['view', 'create', 'edit', 'approve'],
    orders: ['view', 'create', 'edit', 'export'],
    logistics: ['view', 'create', 'edit', 'approve', 'export'],
    accounts: [],
    banking: [],
    hr: [],
    documents: ['view', 'create', 'edit', 'delete', 'export'],
    reports: ['view', 'create'],
    cms: [],
    ai: ['view', 'create'],
    users: [],
    settings: [],
  },
  hr: {
    dashboard: ['view'],
    crm: [],
    sales: [],
    inventory: [],
    auctions: [],
    orders: [],
    logistics: [],
    accounts: ['view'],
    banking: [],
    hr: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
    documents: ['view', 'create'],
    reports: ['view', 'create', 'export'],
    cms: [],
    ai: ['view', 'create'],
    users: ['view'],
    settings: [],
  },
  it: {
    dashboard: ['view'],
    crm: [],
    sales: [],
    inventory: ['view'],
    auctions: ['view'],
    orders: ['view'],
    logistics: ['view'],
    accounts: [],
    banking: [],
    hr: [],
    documents: ['view'],
    reports: ['view', 'export'],
    cms: ['view', 'edit'],
    ai: ['view', 'create'],
    users: ['view', 'edit'],
    settings: ['view', 'edit', 'export'],
  },
  dealer: {},
  customer: {},
};

export function isStaffRole(role: UserRole): boolean {
  return role !== 'visitor' && role !== 'customer' && role !== 'dealer';
}

export function getEffectivePermissions(
  role: UserRole,
  profile?: UserProfile | null
): RolePermissionsMap {
  if (role === 'visitor') return {};
  if (role === 'admin') return buildFullMap();

  const defaults = DEFAULT_ROLE_PERMISSIONS[role] || {};
  const custom = profile?.permissions;
  if (!custom) return defaults;

  const merged: RolePermissionsMap = { ...defaults };
  for (const mod of ADMIN_MODULES) {
    if (Array.isArray(custom[mod.key])) {
      merged[mod.key] = custom[mod.key];
    }
  }
  return merged;
}

export function hasModulePermission(
  role: UserRole,
  profile: UserProfile | null | undefined,
  moduleKey: AdminModuleKey,
  action: PermissionAction
): boolean {
  if (profile?.accountStatus === 'suspended') return false;
  if (role === 'admin') return true;
  const perms = getEffectivePermissions(role, profile);
  const actions = perms[moduleKey] || [];
  return actions.includes(action);
}

export const COMPANY_DEPARTMENTS = [
  'Owner & Management',
  'Administration',
  'Human Resources',
  'Sales',
  'Accounts',
  'Operations',
  'IT & Development',
] as const;

export type CompanyDepartment = (typeof COMPANY_DEPARTMENTS)[number];

export const DESIGNATION_LABELS: Record<
  'director' | 'manager' | 'executive' | 'assistant',
  string
> = {
  director: 'Owner / Director',
  manager: 'Manager',
  executive: 'Executive',
  assistant: 'Assistant',
};

export function resolveRoleFromDepartment(
  department: string,
  designation: 'director' | 'manager' | 'executive' | 'assistant'
): PersistedUserRole {
  switch (department) {
    case 'Owner & Management':
      return designation === 'director' ? 'admin' : 'management';
    case 'Administration':
      return 'management';
    case 'Human Resources':
      return 'hr';
    case 'Sales':
      return designation === 'manager' || designation === 'director' ? 'sales_manager' : 'sales';
    case 'Accounts':
      return 'accounts';
    case 'Operations':
      return 'operations';
    case 'IT & Development':
      return 'it';
    default:
      return 'sales';
  }
}

export function canViewCompanyProfit(
  role: UserRole,
  profile?: UserProfile | null
): boolean {
  if (profile?.accountStatus === 'suspended') return false;
  return (
    role === 'admin' ||
    role === 'management' ||
    role === 'accounts' ||
    hasModulePermission(role, profile, 'accounts', 'approve')
  );
}

export function canViewSalaries(
  role: UserRole,
  profile?: UserProfile | null
): boolean {
  if (profile?.accountStatus === 'suspended') return false;
  return (
    role === 'admin' ||
    role === 'management' ||
    role === 'hr' ||
    role === 'accounts' ||
    hasModulePermission(role, profile, 'hr', 'view')
  );
}

export const DEPARTMENT_DASHBOARD_META: Record<
  PersistedUserRole,
  {
    dashboardTitle: string;
    subtitle: string;
    primaryModules: AdminModuleKey[];
  }
> = {
  admin: {
    dashboardTitle: 'Owner Executive Dashboard',
    subtitle: 'Complete business overview: revenue, actual profit, expenses, approvals, and governance.',
    primaryModules: ['dashboard', 'accounts', 'sales', 'orders', 'hr', 'users', 'settings'],
  },
  management: {
    dashboardTitle: 'Admin & Management Dashboard',
    subtitle: 'Department oversight, employee administration, approvals, security logs, and reports.',
    primaryModules: ['dashboard', 'users', 'reports', 'sales', 'orders', 'cms', 'settings'],
  },
  hr: {
    dashboardTitle: 'Human Resources Dashboard',
    subtitle: 'Employee profiles, attendance, leave approvals, payroll, and team performance.',
    primaryModules: ['dashboard', 'hr', 'reports', 'documents'],
  },
  sales_manager: {
    dashboardTitle: 'Sales Management Dashboard',
    subtitle: 'Leads pipeline, customer & dealer accounts, deal approvals, targets, and commissions.',
    primaryModules: ['dashboard', 'crm', 'sales', 'auctions', 'orders', 'reports'],
  },
  sales: {
    dashboardTitle: 'Sales Executive Dashboard',
    subtitle: 'Assigned buyer inquiries, follow-ups, CIF quotations, and active vehicle stock.',
    primaryModules: ['dashboard', 'crm', 'sales', 'inventory', 'auctions'],
  },
  accounts: {
    dashboardTitle: 'Accounts & Finance Dashboard',
    subtitle: 'Invoices, verified payments, outstanding balances, expenses, salaries, and profit & loss.',
    primaryModules: ['dashboard', 'accounts', 'orders', 'documents', 'reports'],
  },
  operations: {
    dashboardTitle: 'Operations & Logistics Dashboard',
    subtitle: 'Auction purchasing, yard inventory, vehicle inspections, vessel bookings, and export docs.',
    primaryModules: ['dashboard', 'inventory', 'auctions', 'orders', 'logistics', 'documents'],
  },
  it: {
    dashboardTitle: 'IT & Systems Dashboard',
    subtitle: 'Website CMS, live API integrations, AI automation, backups, and security audit trail.',
    primaryModules: ['dashboard', 'cms', 'ai', 'users', 'settings', 'reports'],
  },
  dealer: {
    dashboardTitle: 'Dealer Partner Dashboard',
    subtitle: 'Wholesale stock, auction bidding, quotations, and shipment tracking.',
    primaryModules: [],
  },
  customer: {
    dashboardTitle: 'Customer Portal Dashboard',
    subtitle: 'Browse vehicles, request quotations, track shipments, and download export documents.',
    primaryModules: [],
  },
};

