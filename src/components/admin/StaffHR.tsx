import { useState, useEffect, useCallback } from 'react';
import { Plus, ChevronLeft, ChevronRight, CheckCircle, XCircle, DollarSign, Calendar, TrendingUp, Banknote, AlertCircle } from 'lucide-react';
import { db } from '../../db/database';
import { useAppStore } from '../../store/useAppStore';
import { logActivity } from '../../utils/logger';
import type { User as UserType, StaffLeave, StaffAdvance, LeaveType } from '../../types';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';
import toast from 'react-hot-toast';

const LEAVE_LABELS: Record<LeaveType, string> = {
  sick:    'Sick Leave (Paid)',
  casual:  'Casual Leave (Paid)',
  annual:  'Annual Leave (Paid)',
  lop:     'LOP (Unpaid)',
};
const LEAVE_COLORS: Record<LeaveType, string> = {
  sick:   'bg-blue-100 text-blue-700',
  casual: 'bg-green-100 text-green-700',
  annual: 'bg-purple-100 text-purple-700',
  lop:    'bg-red-100 text-red-700',
};

function pad(n: number) { return String(n).padStart(2, '0'); }
function isoDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function monthKey(year: number, month: number) { return `${year}-${pad(month + 1)}`; }

export default function StaffHR() {
  const session = useAppStore(s => s.session);
  const currencySymbol = useAppStore(s => s.currencySymbol);

  const [staff, setStaff] = useState<UserType[]>([]);
  const [selected, setSelected] = useState<UserType | null>(null);
  const [leaves, setLeaves] = useState<StaffLeave[]>([]);
  const [advances, setAdvances] = useState<StaffAdvance[]>([]);
  const [tab, setTab] = useState<'overview' | 'leaves' | 'advances' | 'payroll'>('overview');

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  // Salary edit
  const [editSalary, setEditSalary] = useState(false);
  const [salaryForm, setSalaryForm] = useState({ monthlySalary: '', workingDaysPerMonth: '26', joiningDate: '' });

  // Leave modal
  const [leaveModal, setLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ date: isoDate(now), leaveType: 'sick' as LeaveType, reason: '', approved: true });
  const [deleteLeave, setDeleteLeave] = useState<StaffLeave | null>(null);

  // Advance modal
  const [advanceModal, setAdvanceModal] = useState(false);
  const [advanceForm, setAdvanceForm] = useState({ date: isoDate(now), amount: '', reason: '', notes: '' });
  const [deleteAdvance, setDeleteAdvance] = useState<StaffAdvance | null>(null);

  // Performance
  const [perf, setPerf] = useState({ orders: 0, revenue: 0 });

  const loadStaff = async () => {
    const all = await db.users.toArray();
    setStaff(all);
    if (!selected && all.length > 0) setSelected(all[0]);
  };

  const loadData = useCallback(async () => {
    if (!selected?.id) return;
    const mk = monthKey(year, month);
    const [ls, adv] = await Promise.all([
      db.staffLeaves.where('userId').equals(selected.id).toArray(),
      db.staffAdvances.where('userId').equals(selected.id).toArray(),
    ]);
    setLeaves(ls.filter(l => l.date.startsWith(mk)));
    setAdvances(adv);

    // Performance this month
    const orders = await db.orders
      .filter(o => o.userId === selected.id && !!o.paymentMethod && o.paymentMethod !== 'pending' && o.status !== 'voided' && o.createdAt?.startsWith(mk))
      .toArray();
    setPerf({ orders: orders.length, revenue: orders.reduce((s, o) => s + o.total, 0) });
  }, [selected, year, month]);

  useEffect(() => { loadStaff(); }, []);
  useEffect(() => {
    if (selected) {
      setSalaryForm({
        monthlySalary: String(selected.monthlySalary ?? ''),
        workingDaysPerMonth: String(selected.workingDaysPerMonth ?? 26),
        joiningDate: selected.joiningDate ?? '',
      });
      loadData();
    }
  }, [selected, year, month]);

  const saveSalary = async () => {
    if (!selected?.id || !session) return;
    const updates = {
      monthlySalary: parseFloat(salaryForm.monthlySalary) || 0,
      workingDaysPerMonth: parseInt(salaryForm.workingDaysPerMonth) || 26,
      joiningDate: salaryForm.joiningDate || undefined,
    };
    await db.users.update(selected.id, updates);
    await logActivity(session.id, session.name, session.role, 'staff', 'Salary Updated', `${selected.name}: ${currencySymbol} ${updates.monthlySalary}/mo`);
    setSelected({ ...selected, ...updates });
    setStaff(prev => prev.map(s => s.id === selected.id ? { ...s, ...updates } : s));
    setEditSalary(false);
    toast.success('Salary info saved');
  };

  const addLeave = async () => {
    if (!selected?.id || !session) return;
    const existing = leaves.find(l => l.date === leaveForm.date);
    if (existing) { toast.error('Leave already recorded for this date'); return; }
    await db.staffLeaves.add({
      userId: selected.id,
      userName: selected.name,
      date: leaveForm.date,
      leaveType: leaveForm.leaveType,
      reason: leaveForm.reason,
      approved: leaveForm.approved,
      createdAt: new Date().toISOString(),
      createdBy: session.name,
    });
    await logActivity(session.id, session.name, session.role, 'staff', 'Leave Added',
      `${selected.name} | ${leaveForm.date} | ${leaveForm.leaveType}`);
    setLeaveModal(false);
    loadData();
    toast.success('Leave recorded');
  };

  const removeLeave = async () => {
    if (!deleteLeave || !session) return;
    await db.staffLeaves.delete(deleteLeave.id!);
    await logActivity(session.id, session.name, session.role, 'staff', 'Leave Removed', `${selected?.name} | ${deleteLeave.date}`);
    setDeleteLeave(null);
    loadData();
  };

  const addAdvance = async () => {
    if (!selected?.id || !session) return;
    const amount = parseFloat(advanceForm.amount);
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
    await db.staffAdvances.add({
      userId: selected.id,
      userName: selected.name,
      amount,
      date: advanceForm.date,
      reason: advanceForm.reason,
      notes: advanceForm.notes,
      repaid: false,
      createdAt: new Date().toISOString(),
      createdBy: session.name,
    });
    await logActivity(session.id, session.name, session.role, 'staff', 'Advance Added',
      `${selected.name} | ${currencySymbol} ${amount}`);
    setAdvanceModal(false);
    setAdvanceForm({ date: isoDate(now), amount: '', reason: '', notes: '' });
    loadData();
    toast.success('Advance recorded');
  };

  const markAdvanceRepaid = async (adv: StaffAdvance) => {
    if (!session) return;
    await db.staffAdvances.update(adv.id!, { repaid: true, repaidDate: isoDate(now) });
    await logActivity(session.id, session.name, session.role, 'staff', 'Advance Repaid', `${selected?.name} | ${currencySymbol} ${adv.amount}`);
    loadData();
    toast.success('Advance marked as repaid');
  };

  const removeAdvance = async () => {
    if (!deleteAdvance || !session) return;
    await db.staffAdvances.delete(deleteAdvance.id!);
    await logActivity(session.id, session.name, session.role, 'staff', 'Advance Removed', `${selected?.name}`);
    setDeleteAdvance(null);
    loadData();
  };

  // Payroll calculation
  const salary = selected?.monthlySalary ?? 0;
  const workingDays = selected?.workingDaysPerMonth ?? 26;
  const dailyRate = workingDays > 0 ? salary / workingDays : 0;
  const lopDays = leaves.filter(l => l.leaveType === 'lop' && l.approved).length;
  const lopDeduction = lopDays * dailyRate;
  const pendingAdvances = advances.filter(a => !a.repaid).reduce((s, a) => s + a.amount, 0);
  const netSalary = Math.max(0, salary - lopDeduction - pendingAdvances);

  const monthLabel = new Date(year, month).toLocaleDateString('en', { month: 'long', year: 'numeric' });
  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  // Mini calendar for leave display
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const leaveByDate: Record<string, StaffLeave> = {};
  leaves.forEach(l => { leaveByDate[l.date] = l; });

  return (
    <div className="p-6 h-full flex flex-col">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Staff HR & Payroll</h1>

      <div className="flex gap-5 flex-1 overflow-hidden">
        {/* Staff list */}
        <div className="w-48 shrink-0 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-y-auto">
          <div className="p-3 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">Staff</div>
          {staff.map(s => (
            <button key={s.id} onClick={() => setSelected(s)}
              className={`w-full text-left px-3 py-2.5 border-l-2 transition-all ${selected?.id === s.id ? 'border-amber-500 bg-amber-50' : 'border-transparent hover:bg-gray-50'}`}>
              <div className={`font-medium text-sm ${selected?.id === s.id ? 'text-amber-700' : 'text-gray-700'}`}>{s.name}</div>
              <div className="text-xs text-gray-400 capitalize">{s.role}</div>
              {s.monthlySalary ? <div className="text-xs text-green-600">{currencySymbol} {s.monthlySalary.toLocaleString()}/mo</div> : <div className="text-xs text-gray-300">No salary set</div>}
            </button>
          ))}
        </div>

        {/* Main content */}
        {selected ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-800">{selected.name}</h2>
                <span className="text-sm text-gray-500 capitalize">{selected.role}{selected.joiningDate ? ` · Joined ${selected.joiningDate}` : ''}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-sm font-semibold text-gray-700 w-36 text-center">{monthLabel}</span>
                <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-4">
              {(['overview', 'leaves', 'advances', 'payroll'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${tab === t ? 'bg-amber-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}>
                  {t}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {/* Overview */}
              {tab === 'overview' && (
                <div className="space-y-4">
                  {/* Salary card */}
                  <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-700 flex items-center gap-2"><DollarSign className="w-4 h-4 text-green-500" /> Salary Info</h3>
                      <button onClick={() => setEditSalary(!editSalary)} className="text-xs text-amber-600 hover:underline font-medium">
                        {editSalary ? 'Cancel' : 'Edit'}
                      </button>
                    </div>
                    {editSalary ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-medium text-gray-600">Monthly Salary ({currencySymbol})</label>
                            <input type="number" value={salaryForm.monthlySalary} onChange={e => setSalaryForm(f => ({ ...f, monthlySalary: e.target.value }))}
                              placeholder="0" className="w-full mt-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-600">Working Days/Month</label>
                            <input type="number" value={salaryForm.workingDaysPerMonth} onChange={e => setSalaryForm(f => ({ ...f, workingDaysPerMonth: e.target.value }))}
                              className="w-full mt-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600">Joining Date</label>
                          <input type="date" value={salaryForm.joiningDate} onChange={e => setSalaryForm(f => ({ ...f, joiningDate: e.target.value }))}
                            className="w-full mt-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                        </div>
                        <button onClick={saveSalary} className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold">Save Salary Info</button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center p-3 bg-green-50 rounded-xl">
                          <div className="text-lg font-bold text-green-700">{currencySymbol} {(salary).toLocaleString()}</div>
                          <div className="text-xs text-gray-500">Monthly Salary</div>
                        </div>
                        <div className="text-center p-3 bg-blue-50 rounded-xl">
                          <div className="text-lg font-bold text-blue-700">{currencySymbol} {Math.round(dailyRate).toLocaleString()}</div>
                          <div className="text-xs text-gray-500">Daily Rate</div>
                        </div>
                        <div className="text-center p-3 bg-amber-50 rounded-xl">
                          <div className="text-lg font-bold text-amber-700">{workingDays}</div>
                          <div className="text-xs text-gray-500">Working Days</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Performance this month */}
                  <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-amber-500" /> Performance — {monthLabel}</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-amber-50 rounded-xl text-center">
                        <div className="text-2xl font-bold text-amber-700">{perf.orders}</div>
                        <div className="text-xs text-gray-500">Orders Processed</div>
                      </div>
                      <div className="p-3 bg-purple-50 rounded-xl text-center">
                        <div className="text-lg font-bold text-purple-700">{currencySymbol} {perf.revenue.toLocaleString()}</div>
                        <div className="text-xs text-gray-500">Revenue Generated</div>
                      </div>
                    </div>
                  </div>

                  {/* This month summary */}
                  <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><Calendar className="w-4 h-4 text-blue-500" /> {monthLabel} Summary</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-gray-500">Leaves this month</span><span className="font-semibold">{leaves.length}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">LOP (unpaid) days</span><span className="font-semibold text-red-600">{lopDays}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">LOP deduction</span><span className="font-semibold text-red-600">- {currencySymbol} {Math.round(lopDeduction).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Pending advances</span><span className="font-semibold text-orange-600">- {currencySymbol} {pendingAdvances.toLocaleString()}</span></div>
                      <div className="flex justify-between border-t border-gray-100 pt-2 font-bold text-base"><span>Net Salary</span><span className="text-green-700">{currencySymbol} {Math.round(netSalary).toLocaleString()}</span></div>
                    </div>
                  </div>
                </div>
              )}

              {/* Leaves */}
              {tab === 'leaves' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-700">{leaves.length} leave(s) in {monthLabel}</h3>
                    <button onClick={() => { setLeaveForm({ date: isoDate(now), leaveType: 'sick', reason: '', approved: true }); setLeaveModal(true); }}
                      className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium">
                      <Plus className="w-4 h-4" /> Add Leave
                    </button>
                  </div>

                  {/* Calendar grid */}
                  <div className="bg-white rounded-2xl border border-gray-100 p-4">
                    <div className="grid grid-cols-7 gap-1 mb-1">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                      {Array.from({ length: daysInMonth }, (_, i) => {
                        const d = i + 1;
                        const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
                        const leave = leaveByDate[dateStr];
                        return (
                          <div key={d} className={`aspect-square flex flex-col items-center justify-center rounded-lg text-xs font-medium cursor-pointer hover:bg-gray-50 transition-all ${leave ? LEAVE_COLORS[leave.leaveType] : 'text-gray-700'}`}
                            onClick={() => { setLeaveForm({ date: dateStr, leaveType: 'sick', reason: '', approved: true }); setLeaveModal(true); }}
                            title={leave ? `${LEAVE_LABELS[leave.leaveType]}: ${leave.reason}` : 'Click to add leave'}>
                            {d}
                            {leave && <span className="text-[9px] leading-none">{leave.leaveType.toUpperCase()}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Leave list */}
                  {leaves.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
                      {leaves.map(l => (
                        <div key={l.id} className="flex items-center gap-3 px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LEAVE_COLORS[l.leaveType]}`}>{l.leaveType.toUpperCase()}</span>
                          <span className="text-sm font-medium text-gray-700">{l.date}</span>
                          <span className="text-sm text-gray-500 flex-1">{l.reason || '—'}</span>
                          {l.approved ? <CheckCircle className="w-4 h-4 text-green-500" /> : <AlertCircle className="w-4 h-4 text-orange-400" />}
                          <button onClick={() => setDeleteLeave(l)} className="text-gray-300 hover:text-red-400">
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Advances */}
              {tab === 'advances' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-700">Salary Advances</h3>
                      <p className="text-xs text-gray-400">Pending: {currencySymbol} {pendingAdvances.toLocaleString()}</p>
                    </div>
                    <button onClick={() => setAdvanceModal(true)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium">
                      <Plus className="w-4 h-4" /> Add Advance
                    </button>
                  </div>

                  {advances.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">
                      <Banknote className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No advances recorded</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
                      {advances.sort((a, b) => b.date.localeCompare(a.date)).map(adv => (
                        <div key={adv.id} className="flex items-center gap-3 px-4 py-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-800">{currencySymbol} {adv.amount.toLocaleString()}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${adv.repaid ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                {adv.repaid ? 'Repaid' : 'Pending'}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500">{adv.date} · {adv.reason || 'No reason given'}</div>
                            {adv.repaidDate && <div className="text-xs text-green-600">Repaid on {adv.repaidDate}</div>}
                          </div>
                          {!adv.repaid && (
                            <button onClick={() => markAdvanceRepaid(adv)} className="text-xs px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg font-medium">
                              Mark Repaid
                            </button>
                          )}
                          <button onClick={() => setDeleteAdvance(adv)} className="text-gray-300 hover:text-red-400">
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Payroll summary */}
              {tab === 'payroll' && (
                <div className="space-y-4">
                  {!salary ? (
                    <div className="bg-amber-50 rounded-2xl border border-amber-200 p-6 text-center">
                      <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
                      <p className="font-semibold text-amber-800">No salary configured</p>
                      <p className="text-sm text-amber-600 mt-1">Go to Overview tab and set the monthly salary first.</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-3">
                      <h3 className="font-bold text-gray-800 text-lg border-b border-gray-100 pb-3">
                        Payroll — {monthLabel}
                        <span className="block text-sm font-normal text-gray-500 mt-0.5">{selected.name} · {selected.role}</span>
                      </h3>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between py-1"><span className="text-gray-600">Gross Monthly Salary</span><span className="font-semibold">{currencySymbol} {salary.toLocaleString()}</span></div>
                        <div className="flex justify-between py-1"><span className="text-gray-600">Daily Rate ({currencySymbol} {salary.toLocaleString()} ÷ {workingDays} days)</span><span>{currencySymbol} {Math.round(dailyRate).toLocaleString()}</span></div>

                        <div className="border-t border-gray-100 pt-2">
                          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Deductions</div>
                          <div className="flex justify-between py-1 text-red-600"><span>LOP Days ({lopDays} × {currencySymbol} {Math.round(dailyRate).toLocaleString()})</span><span>- {currencySymbol} {Math.round(lopDeduction).toLocaleString()}</span></div>
                          <div className="flex justify-between py-1 text-orange-600"><span>Salary Advance Deduction</span><span>- {currencySymbol} {pendingAdvances.toLocaleString()}</span></div>
                        </div>

                        <div className="border-t-2 border-gray-200 pt-3 flex justify-between font-bold text-lg">
                          <span>Net Payable</span>
                          <span className="text-green-700">{currencySymbol} {Math.round(netSalary).toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 space-y-1">
                        <div>Leave breakdown: {leaves.filter(l => l.leaveType === 'sick').length} sick · {leaves.filter(l => l.leaveType === 'casual').length} casual · {leaves.filter(l => l.leaveType === 'annual').length} annual · {lopDays} LOP</div>
                        <div>Performance: {perf.orders} orders · {currencySymbol} {perf.revenue.toLocaleString()} revenue</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">Select a staff member</div>
        )}
      </div>

      {/* Add Leave Modal */}
      <Modal open={leaveModal} onClose={() => setLeaveModal(false)} title="Record Leave" size="sm">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Date</label>
            <input type="date" value={leaveForm.date} onChange={e => setLeaveForm(f => ({ ...f, date: e.target.value }))}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Leave Type</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {(Object.entries(LEAVE_LABELS) as [LeaveType, string][]).map(([type, label]) => (
                <button key={type} onClick={() => setLeaveForm(f => ({ ...f, leaveType: type }))}
                  className={`py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${leaveForm.leaveType === type ? `border-current ${LEAVE_COLORS[type]}` : 'border-gray-200 text-gray-600'}`}>
                  {label}
                </button>
              ))}
            </div>
            {leaveForm.leaveType === 'lop' && <p className="text-xs text-red-500 mt-1">LOP will auto-deduct {currencySymbol} {Math.round(dailyRate).toLocaleString()} from this month's salary.</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Reason</label>
            <input value={leaveForm.reason} onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="Optional reason"
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="approved" checked={leaveForm.approved} onChange={e => setLeaveForm(f => ({ ...f, approved: e.target.checked }))} className="w-4 h-4 accent-amber-500" />
            <label htmlFor="approved" className="text-sm font-medium text-gray-700">Approved</label>
          </div>
          <button onClick={addLeave} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold">Record Leave</button>
        </div>
      </Modal>

      {/* Add Advance Modal */}
      <Modal open={advanceModal} onClose={() => setAdvanceModal(false)} title="Record Salary Advance" size="sm">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Date</label>
            <input type="date" value={advanceForm.date} onChange={e => setAdvanceForm(f => ({ ...f, date: e.target.value }))}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Amount ({currencySymbol}) *</label>
            <input type="number" min="1" value={advanceForm.amount} onChange={e => setAdvanceForm(f => ({ ...f, amount: e.target.value }))}
              placeholder="0"
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Reason</label>
            <input value={advanceForm.reason} onChange={e => setAdvanceForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="Reason for advance"
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Notes</label>
            <input value={advanceForm.notes} onChange={e => setAdvanceForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Additional notes"
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </div>
          <button onClick={addAdvance} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold">Record Advance</button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteLeave} title="Remove Leave" message={`Remove leave entry for ${deleteLeave?.date}?`}
        confirmLabel="Remove" danger onConfirm={removeLeave} onCancel={() => setDeleteLeave(null)} />
      <ConfirmDialog open={!!deleteAdvance} title="Remove Advance" message={`Remove advance of ${currencySymbol} ${deleteAdvance?.amount}?`}
        confirmLabel="Remove" danger onConfirm={removeAdvance} onCancel={() => setDeleteAdvance(null)} />
    </div>
  );
}
