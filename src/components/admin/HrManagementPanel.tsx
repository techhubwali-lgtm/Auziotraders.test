import {
  CalendarCheck,
  CheckCircle2,
  Plus,
  Trash2,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatMoney } from '../../data/ports';
import type {
  CurrencyCode,
  HrEmployee,
  HrLeaveRequest,
  UserProfile,
} from '../../types/portal';

interface HrManagementPanelProps {
  currency: CurrencyCode;
  fxRates: Record<string, number>;
  staffProfile: UserProfile | null;
  employees: HrEmployee[];
  leaveRequests: HrLeaveRequest[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  onSaveEmployee: (
    input: Omit<HrEmployee, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => Promise<void>;
  onDeleteEmployee: (id: string) => Promise<void>;
  onCreateLeaveRequest: (
    input: Omit<HrLeaveRequest, 'id' | 'status' | 'reviewedByName' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onReviewLeave: (id: string, status: 'approved' | 'rejected') => Promise<void>;
}

const DEPARTMENTS = [
  'Executive & Management',
  'Sales Department',
  'Operations & Logistics',
  'Accounts & Finance',
  'Human Resources',
  'IT & Systems',
  'Auction Purchasing',
];

export function HrManagementPanel({
  currency,
  fxRates,
  staffProfile,
  employees,
  leaveRequests,
  canCreate,
  canDelete,
  canApprove,
  onSaveEmployee,
  onDeleteEmployee,
  onCreateLeaveRequest,
  onReviewLeave,
}: HrManagementPanelProps) {
  const fmt = (usd: number) => formatMoney(usd, currency, fxRates);

  const [subTab, setSubTab] = useState<'employees' | 'leaves'>('employees');
  const [showEmpForm, setShowEmpForm] = useState(false);
  const [showLeaveForm, setShowLeaveForm] = useState(false);

  // Employee Form
  const [empCode, setEmpCode] = useState(`EMP-${Math.floor(100 + Math.random() * 900)}`);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState(DEPARTMENTS[1]);
  const [jobTitle, setJobTitle] = useState('');
  const [baseSalaryUsd, setBaseSalaryUsd] = useState(3200);
  const [commissionRatePct, setCommissionRatePct] = useState(2);
  const [attendanceDays, setAttendanceDays] = useState(21);
  const [leaveRemaining, setLeaveRemaining] = useState(14);
  const [perfRating, setPerfRating] = useState(4.5);
  const [joinedDate, setJoinedDate] = useState(new Date().toISOString().slice(0, 10));

  // Leave Form
  const [lvEmpId, setLvEmpId] = useState('');
  const [lvType, setLvType] = useState<HrLeaveRequest['leaveType']>('annual');
  const [lvStart, setLvStart] = useState(new Date().toISOString().slice(0, 10));
  const [lvEnd, setLvEnd] = useState(new Date().toISOString().slice(0, 10));
  const [lvDays, setLvDays] = useState(2);
  const [lvReason, setLvReason] = useState('');

  const stats = useMemo(() => {
    const activeCount = employees.filter((e) => e.status === 'active').length;
    const monthlyPayrollUsd = employees
      .filter((e) => e.status !== 'inactive')
      .reduce((acc, e) => acc + (e.baseSalaryUsd || 0), 0);
    const pendingLeaves = leaveRequests.filter((l) => l.status === 'pending').length;
    const avgPerf =
      employees.length > 0
        ? (employees.reduce((a, e) => a + e.performanceRating, 0) / employees.length).toFixed(1)
        : '—';
    return { activeCount, monthlyPayrollUsd, pendingLeaves, avgPerf };
  }, [employees, leaveRequests]);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !jobTitle.trim()) return;
    await onSaveEmployee({
      employeeCode: empCode.trim(),
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      department,
      jobTitle: jobTitle.trim(),
      status: 'active',
      baseSalaryUsd,
      commissionRatePct,
      attendanceDaysThisMonth: attendanceDays,
      leaveDaysRemaining: leaveRemaining,
      performanceRating: perfRating,
      joinedDate,
      notes: '',
    });
    setFullName('');
    setEmail('');
    setPhone('');
    setJobTitle('');
    setEmpCode(`EMP-${Math.floor(100 + Math.random() * 900)}`);
    setShowEmpForm(false);
  };

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    const matched = employees.find((emp) => emp.id === lvEmpId);
    await onCreateLeaveRequest({
      employeeId: matched?.id || staffProfile?.uid || 'staff',
      employeeName: matched?.fullName || staffProfile?.displayName || 'Staff Member',
      department: matched?.department || staffProfile?.department || 'Operations',
      leaveType: lvType,
      startDate: lvStart,
      endDate: lvEnd,
      days: lvDays,
      reason: lvReason.trim() || 'Scheduled leave request',
    });
    setLvReason('');
    setShowLeaveForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Human Resources
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Manage employees, departments, attendance, monthly salaries, leave approvals, and
            performance reviews.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSubTab('leaves');
              setShowLeaveForm((v) => !v);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            <CalendarCheck className="w-4 h-4" />
            <span>Submit Leave Request</span>
          </button>
          {canCreate && (
            <button
              type="button"
              onClick={() => {
                setSubTab('employees');
                setShowEmpForm((v) => !v);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-amber-400 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Employee</span>
            </button>
          )}
        </div>
      </div>

      {/* HR KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Active Employees</div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-950 dark:text-white mt-1">
            {stats.activeCount}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Monthly Base Payroll</div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-950 dark:text-white mt-1">
            {fmt(stats.monthlyPayrollUsd)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Pending Leave Requests</div>
          <div className="text-xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1">
            {stats.pendingLeaves}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Avg Performance Rating</div>
          <div className="text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
            {stats.avgPerf} / 5.0
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
        <button
          type="button"
          onClick={() => setSubTab('employees')}
          className={`px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
            subTab === 'employees'
              ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          Employees, Attendance &amp; Payroll ({employees.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('leaves')}
          className={`px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
            subTab === 'leaves'
              ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          Leave Requests ({leaveRequests.length})
        </button>
      </div>

      {/* Add Employee Form */}
      {showEmpForm && canCreate && (
        <form
          onSubmit={handleAddEmployee}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 text-xs"
        >
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Register New Employee
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Employee ID
              </label>
              <input
                type="text"
                required
                value={empCode}
                onChange={(e) => setEmpCode(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Kenji Takahashi"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Work Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@auziotraders.com"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Department
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Job Title *
              </label>
              <input
                type="text"
                required
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Export Sales Executive"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Base Monthly Salary (USD)
              </label>
              <input
                type="number"
                min={0}
                value={baseSalaryUsd}
                onChange={(e) => setBaseSalaryUsd(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Commission % / Joined Date
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  max={50}
                  value={commissionRatePct}
                  onChange={(e) => setCommissionRatePct(Number(e.target.value))}
                  className="px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                />
                <input
                  type="date"
                  value={joinedDate}
                  onChange={(e) => setJoinedDate(e.target.value)}
                  className="px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Attendance Days (Month)
              </label>
              <input
                type="number"
                min={0}
                max={31}
                value={attendanceDays}
                onChange={(e) => setAttendanceDays(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Leave Balance (Days)
              </label>
              <input
                type="number"
                min={0}
                max={60}
                value={leaveRemaining}
                onChange={(e) => setLeaveRemaining(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Performance Score (1–5)
              </label>
              <input
                type="number"
                step="0.1"
                min={1}
                max={5}
                value={perfRating}
                onChange={(e) => setPerfRating(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full py-2 px-4 rounded-lg bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-bold cursor-pointer"
              >
                Save Employee Record
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Leave Request Form */}
      {showLeaveForm && (
        <form
          onSubmit={handleSubmitLeave}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3 text-xs"
        >
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            New Employee Leave Request
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Employee
              </label>
              <select
                value={lvEmpId}
                onChange={(e) => setLvEmpId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                <option value="">Myself ({staffProfile?.displayName || 'Staff'})</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.fullName} ({e.department})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Leave Type
              </label>
              <select
                value={lvType}
                onChange={(e) => setLvType(e.target.value as HrLeaveRequest['leaveType'])}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                <option value="annual">Annual Leave</option>
                <option value="sick">Sick Leave</option>
                <option value="personal">Personal Leave</option>
                <option value="unpaid">Unpaid Leave</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={lvStart}
                onChange={(e) => setLvStart(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={lvEnd}
                onChange={(e) => setLvEnd(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Total Days
              </label>
              <input
                type="number"
                min={1}
                max={90}
                value={lvDays}
                onChange={(e) => setLvDays(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={lvReason}
              onChange={(e) => setLvReason(e.target.value)}
              placeholder="Reason or handover coverage notes..."
              className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 px-5 py-2 rounded-lg bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Submit Leave</span>
            </button>
          </div>
        </form>
      )}

      {/* Employees Directory Table */}
      {subTab === 'employees' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          {employees.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <Users className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                No employee records added yet
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Add team members to track department payroll, attendance, leave balances, and
                performance ratings.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Employee</th>
                    <th className="px-4 py-3 font-semibold">Department &amp; Role</th>
                    <th className="px-4 py-3 font-semibold text-right">Monthly Salary</th>
                    <th className="px-4 py-3 font-semibold text-right">Attendance</th>
                    <th className="px-4 py-3 font-semibold text-right">Leave Bal.</th>
                    <th className="px-4 py-3 font-semibold text-right">Rating</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {emp.fullName}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          {emp.employeeCode} {emp.email ? `· ${emp.email}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {emp.department}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {emp.jobTitle}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                        {fmt(emp.baseSalaryUsd)}
                        {emp.commissionRatePct > 0 && (
                          <div className="text-[10px] font-normal text-slate-500">
                            +{emp.commissionRatePct}% comm.
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {emp.attendanceDaysThisMonth}d
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {emp.leaveDaysRemaining}d
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {emp.performanceRating.toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => void onDeleteEmployee(emp.id)}
                            aria-label="Delete employee"
                            className="text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Leave Requests Table */}
      {subTab === 'leaves' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          {leaveRequests.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400">
              No leave requests logged yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {leaveRequests.map((lv) => (
                <div key={lv.id} className="p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">
                      {lv.employeeName} ·{' '}
                      <span className="font-normal text-slate-500 dark:text-slate-400">
                        {lv.department}
                      </span>
                    </div>
                    <div className="text-slate-600 dark:text-slate-300 mt-0.5 capitalize">
                      {lv.leaveType} leave · {lv.startDate} to {lv.endDate} ({lv.days} days)
                    </div>
                    {lv.reason && (
                      <div className="text-slate-500 dark:text-slate-400 mt-0.5">{lv.reason}</div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {lv.status === 'pending' && canApprove ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void onReviewLeave(lv.id, 'approved')}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void onReviewLeave(lv.id, 'rejected')}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </>
                    ) : (
                      <span
                        className={`font-semibold capitalize ${
                          lv.status === 'approved'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : lv.status === 'rejected'
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {lv.status}
                        {lv.reviewedByName ? ` by ${lv.reviewedByName}` : ''}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
