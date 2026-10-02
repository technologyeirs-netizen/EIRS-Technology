import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  FaPlus, FaTicketAlt, FaEdit, FaTrash, FaTimes, FaPercent, FaRupeeSign, FaHistory,
  FaSearch, FaCheckCircle, FaCopy, FaCalendarAlt,
} from 'react-icons/fa';
import AdminLayout from '../components/AdminLayout';
import { couponService } from '../services/api';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const toInputDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const fmt = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const todayStr = () => new Date().toISOString().slice(0, 10);

const EMPTY = {
  code: '', description: '', discountType: 'percentage', discountValue: '',
  minOrderAmount: '', maxDiscount: '', maxUsesPerUser: 1, totalUsageLimit: '',
  startDate: todayStr(), endDate: '', isActive: true,
};

const statusOf = (c) => {
  const now = new Date();
  if (!c.isActive) return { label: 'Inactive', cls: 'bg-slate-100 text-slate-600' };
  if (now > new Date(c.endDate)) return { label: 'Expired', cls: 'bg-rose-50 text-rose-700' };
  if (now < new Date(c.startDate)) return { label: 'Scheduled', cls: 'bg-amber-50 text-amber-700' };
  if (c.totalUsageLimit > 0 && c.usedCount >= c.totalUsageLimit) return { label: 'Exhausted', cls: 'bg-orange-50 text-orange-700' };
  return { label: 'Live', cls: 'bg-emerald-50 text-emerald-700' };
};

const Field = ({ label, hint, children }) => (
  <div>
    <label className="label-premium">{label}</label>
    {children}
    {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
  </div>
);

const AdminCoupons = () => {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [modal, setModal] = useState(null); // null | { id?, form }
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [usage, setUsage] = useState(null); // { coupon, rows }
  const [toast, setToast] = useState('');

  const flash = (t) => { setToast(t); setTimeout(() => setToast(''), 2600); };

  const load = useCallback(async () => {
    try {
      const res = await couponService.adminGetAll();
      setCoupons(res.data || []);
    } catch (e) {
      flash(e.message || 'Failed to load coupons');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const live = coupons.filter((c) => statusOf(c).label === 'Live').length;
    return {
      total: coupons.length,
      live,
      redeemed: coupons.reduce((s, c) => s + (c.usedCount || 0), 0),
      expired: coupons.filter((c) => statusOf(c).label === 'Expired').length,
    };
  }, [coupons]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return coupons.filter((c) => {
      if (term && !`${c.code} ${c.description}`.toLowerCase().includes(term)) return false;
      const st = statusOf(c).label.toLowerCase();
      if (filter !== 'all' && st !== filter) return false;
      return true;
    });
  }, [coupons, q, filter]);

  const openCreate = () => { setFormError(''); setModal({ form: { ...EMPTY } }); };
  const openEdit = (c) => {
    setFormError('');
    setModal({
      id: c._id,
      form: {
        code: c.code, description: c.description || '', discountType: c.discountType, discountValue: c.discountValue,
        minOrderAmount: c.minOrderAmount || '', maxDiscount: c.maxDiscount || '', maxUsesPerUser: c.maxUsesPerUser,
        totalUsageLimit: c.totalUsageLimit || '', startDate: toInputDate(c.startDate), endDate: toInputDate(c.endDate), isActive: c.isActive,
      },
    });
  };
  const setField = (k, v) => setModal((m) => ({ ...m, form: { ...m.form, [k]: v } }));

  const save = async (e) => {
    e.preventDefault();
    const f = modal.form;
    setFormError('');
    if (!f.code.trim()) return setFormError('Coupon code is required');
    if (!(Number(f.discountValue) > 0)) return setFormError('Enter a discount value greater than 0');
    if (f.discountType === 'percentage' && Number(f.discountValue) > 100) return setFormError('Percentage cannot exceed 100');
    if (!f.startDate || !f.endDate) return setFormError('Select start and end date');
    if (f.endDate < f.startDate) return setFormError('End date must be after start date');
    setSaving(true);
    try {
      const body = { ...f, code: f.code.trim().toUpperCase() };
      if (modal.id) await couponService.adminUpdate(modal.id, body);
      else await couponService.adminCreate(body);
      setModal(null);
      flash(modal.id ? 'Coupon updated' : 'Coupon created');
      load();
    } catch (err) {
      setFormError(err.message || 'Could not save coupon');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (c) => {
    setCoupons((cs) => cs.map((x) => (x._id === c._id ? { ...x, isActive: !x.isActive } : x)));
    try { await couponService.adminToggle(c._id); } catch { load(); }
  };
  const remove = async (c) => {
    if (!window.confirm(`Delete coupon ${c.code}?`)) return;
    try { await couponService.adminDelete(c._id); flash('Coupon deleted'); load(); } catch (e) { flash(e.message || 'Delete failed'); }
  };
  const showUsage = async (c) => {
    setUsage({ coupon: c, rows: null });
    try { const r = await couponService.adminUsage(c._id); setUsage({ coupon: c, rows: r.data || [] }); }
    catch { setUsage({ coupon: c, rows: [] }); }
  };
  const copy = (code) => { navigator.clipboard?.writeText(code); flash(`Copied ${code}`); };

  const discountLabel = (c) => (c.discountType === 'percentage' ? `${c.discountValue}%` : inr(c.discountValue));

  const StatCard = ({ label, value, icon, tone }) => (
    <div className="card-premium flex items-center gap-4 p-5">
      <span className={`grid h-12 w-12 place-items-center rounded-2xl text-lg ${tone}`}>{icon}</span>
      <div>
        <p className="text-2xl font-extrabold tracking-tight text-slate-900">{value}</p>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      </div>
    </div>
  );

  const f = modal?.form;

  return (
    <AdminLayout pageTitle="Coupons" breadcrumbs={[{ label: 'Coupons' }]}>
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard label="Total coupons" value={stats.total} icon={<FaTicketAlt />} tone="bg-brand-50 text-brand-600" />
          <StatCard label="Live now" value={stats.live} icon={<FaCheckCircle />} tone="bg-emerald-50 text-emerald-600" />
          <StatCard label="Times redeemed" value={stats.redeemed} icon={<FaHistory />} tone="bg-amber-50 text-amber-600" />
          <StatCard label="Expired" value={stats.expired} icon={<FaCalendarAlt />} tone="bg-rose-50 text-rose-600" />
        </div>

        <div className="card-premium p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <FaSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search coupon code…" className="input-premium !pl-11" style={{ margin: 0 }} />
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 lg:pb-0">
              {['all', 'live', 'scheduled', 'expired', 'inactive', 'exhausted'].map((s) => (
                <button key={s} onClick={() => setFilter(s)} className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold capitalize transition ${filter === s ? 'bg-brand-600 text-white shadow-glow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{s}</button>
              ))}
            </div>
            <button onClick={openCreate} className="btn-brand shrink-0"><FaPlus /> New coupon</button>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-56 animate-pulse rounded-2xl bg-white" />)}</div>
        ) : list.length === 0 ? (
          <div className="card-premium grid place-items-center p-14 text-center">
            <span className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-2xl text-brand-600"><FaTicketAlt /></span>
            <p className="text-lg font-extrabold text-slate-900">{coupons.length ? 'No coupons match' : 'No coupons yet'}</p>
            <p className="mb-5 mt-1 text-sm text-slate-500">Create a discount code for your customers.</p>
            {!coupons.length && <button onClick={openCreate} className="btn-brand"><FaPlus /> Create first coupon</button>}
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {list.map((c) => {
              const st = statusOf(c);
              const pct = c.totalUsageLimit > 0 ? Math.min(100, (c.usedCount / c.totalUsageLimit) * 100) : 0;
              return (
                <article key={c._id} className="card-premium group relative overflow-hidden">
                  <div className="flex items-stretch">
                    <div className={`flex w-28 shrink-0 flex-col items-center justify-center bg-gradient-to-br px-3 py-6 text-white ${c.isActive ? 'from-brand-600 to-violet-600' : 'from-slate-400 to-slate-500'}`}>
                      {c.discountType === 'percentage' ? <FaPercent className="mb-1 opacity-70" /> : <FaRupeeSign className="mb-1 opacity-70" />}
                      <p className="text-3xl font-extrabold leading-none">{c.discountType === 'percentage' ? c.discountValue : Number(c.discountValue).toLocaleString('en-IN')}</p>
                      <p className="mt-1 text-[11px] font-bold uppercase tracking-widest opacity-80">{c.discountType === 'percentage' ? '% OFF' : 'FLAT OFF'}</p>
                    </div>
                    <div className="min-w-0 flex-1 p-5">
                      <div className="flex items-start justify-between gap-2">
                        <button onClick={() => copy(c.code)} title="Copy code" className="inline-flex items-center gap-2 rounded-lg border border-dashed border-brand-300 bg-brand-50 px-2.5 py-1 font-mono text-sm font-extrabold tracking-widest text-brand-700">
                          {c.code} <FaCopy className="text-[10px] opacity-60" />
                        </button>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${st.cls}`}>{st.label}</span>
                      </div>
                      {c.description && <p className="mt-2 line-clamp-2 text-sm text-slate-500">{c.description}</p>}
                      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                        <dt className="text-slate-400">Min order</dt><dd className="text-right font-bold text-slate-700">{c.minOrderAmount > 0 ? inr(c.minOrderAmount) : '—'}</dd>
                        <dt className="text-slate-400">Max discount</dt><dd className="text-right font-bold text-slate-700">{c.discountType === 'flat' ? discountLabel(c) : c.maxDiscount > 0 ? inr(c.maxDiscount) : 'No cap'}</dd>
                        <dt className="text-slate-400">Per user</dt><dd className="text-right font-bold text-slate-700">{c.maxUsesPerUser}×</dd>
                        <dt className="text-slate-400">Valid</dt><dd className="text-right font-bold text-slate-700">{fmt(c.startDate)} – {fmt(c.endDate)}</dd>
                      </dl>
                    </div>
                  </div>
                  <div className="border-t border-slate-100 px-5 py-3">
                    <div className="mb-1.5 flex justify-between text-xs font-semibold text-slate-500">
                      <span>Used {c.usedCount}{c.totalUsageLimit > 0 ? ` / ${c.totalUsageLimit}` : ' (unlimited)'}</span>
                      {c.totalUsageLimit > 0 && <span>{Math.round(pct)}%</span>}
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500" style={{ width: `${c.totalUsageLimit > 0 ? pct : Math.min(100, c.usedCount * 5)}%` }} />
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-600">
                        <span className={`relative h-5 w-9 rounded-full transition ${c.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${c.isActive ? 'left-[18px]' : 'left-0.5'}`} />
                          <input type="checkbox" className="sr-only" checked={c.isActive} onChange={() => toggle(c)} />
                        </span>
                        {c.isActive ? 'Active' : 'Inactive'}
                      </label>
                      <div className="flex gap-1">
                        <button onClick={() => showUsage(c)} title="Usage history" className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><FaHistory /></button>
                        <button onClick={() => openEdit(c)} title="Edit" className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-brand-50 hover:text-brand-600"><FaEdit /></button>
                        <button onClick={() => remove(c)} title="Delete" className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600"><FaTrash /></button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      {modal && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !saving && setModal(null)} />
          <form onSubmit={save} className="relative flex max-h-[95vh] w-full max-w-2xl animate-fade-up flex-col overflow-hidden rounded-t-3xl bg-white shadow-premium-lg sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-lg font-extrabold text-slate-900" style={{ margin: 0 }}>{modal.id ? 'Edit coupon' : 'New coupon'}</h3>
              <button type="button" onClick={() => setModal(null)} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500"><FaTimes /></button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Coupon code">
                  <input value={f.code} onChange={(e) => setField('code', e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))} maxLength={20} placeholder="SAVE20" className="input-premium font-mono font-bold tracking-widest" style={{ margin: 0 }} />
                </Field>
                <Field label="Discount type">
                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
                    {[['percentage', 'Percentage', <FaPercent key="p" />], ['flat', 'Flat amount', <FaRupeeSign key="r" />]].map(([v, l, ic]) => (
                      <button type="button" key={v} onClick={() => setField('discountType', v)} className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-bold transition ${f.discountType === v ? 'bg-white text-brand-700 shadow' : 'text-slate-500'}`}>{ic}{l}</button>
                    ))}
                  </div>
                </Field>
              </div>

              <Field label="Description (shown to customers)">
                <input value={f.description} onChange={(e) => setField('description', e.target.value)} maxLength={120} placeholder="Get 20% off on your first order" className="input-premium" style={{ margin: 0 }} />
              </Field>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label={f.discountType === 'percentage' ? 'Discount value (%)' : 'Discount value (₹)'}>
                  <input type="number" min="1" max={f.discountType === 'percentage' ? 100 : undefined} value={f.discountValue} onChange={(e) => setField('discountValue', e.target.value)} className="input-premium" style={{ margin: 0 }} />
                </Field>
                <Field label="Minimum order (₹)" hint="0 = no minimum">
                  <input type="number" min="0" value={f.minOrderAmount} onChange={(e) => setField('minOrderAmount', e.target.value)} placeholder="0" className="input-premium" style={{ margin: 0 }} />
                </Field>
                <Field label="Max discount (₹)" hint={f.discountType === 'percentage' ? '0 = no cap' : 'Only for % coupons'}>
                  <input type="number" min="0" disabled={f.discountType === 'flat'} value={f.discountType === 'flat' ? '' : f.maxDiscount} onChange={(e) => setField('maxDiscount', e.target.value)} placeholder="0" className="input-premium disabled:bg-slate-50 disabled:opacity-60" style={{ margin: 0 }} />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Max uses per customer">
                  <input type="number" min="1" value={f.maxUsesPerUser} onChange={(e) => setField('maxUsesPerUser', e.target.value)} className="input-premium" style={{ margin: 0 }} />
                </Field>
                <Field label="Total uses limit" hint="0 = unlimited">
                  <input type="number" min="0" value={f.totalUsageLimit} onChange={(e) => setField('totalUsageLimit', e.target.value)} placeholder="0" className="input-premium" style={{ margin: 0 }} />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Start date">
                  <input type="date" value={f.startDate} onChange={(e) => setField('startDate', e.target.value)} className="input-premium" style={{ margin: 0 }} />
                </Field>
                <Field label="End date">
                  <input type="date" min={f.startDate} value={f.endDate} onChange={(e) => setField('endDate', e.target.value)} className="input-premium" style={{ margin: 0 }} />
                </Field>
              </div>

              <label className="flex cursor-pointer items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-slate-800">Active</p>
                  <p className="text-xs text-slate-500">Inactive coupons are hidden and cannot be used</p>
                </div>
                <span className={`relative h-6 w-11 rounded-full transition ${f.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${f.isActive ? 'left-[22px]' : 'left-0.5'}`} />
                  <input type="checkbox" className="sr-only" checked={f.isActive} onChange={(e) => setField('isActive', e.target.checked)} />
                </span>
              </label>

              {f.discountValue > 0 && (
                <div className="rounded-xl bg-brand-50 p-4 text-sm text-brand-800 ring-1 ring-brand-100">
                  <span className="font-bold">Preview: </span>
                  {f.discountType === 'percentage' ? `${f.discountValue}% off` : `${inr(f.discountValue)} off`}
                  {Number(f.minOrderAmount) > 0 ? ` on orders above ${inr(f.minOrderAmount)}` : ''}
                  {f.discountType === 'percentage' && Number(f.maxDiscount) > 0 ? `, up to ${inr(f.maxDiscount)}` : ''}.
                </div>
              )}
              {formError && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{formError}</p>}
            </div>

            <div className="flex gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
              <button type="button" onClick={() => setModal(null)} className="btn-soft flex-1">Cancel</button>
              <button disabled={saving} className="btn-brand flex-1">{saving ? 'Saving…' : modal.id ? 'Save changes' : 'Create coupon'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Usage modal */}
      {usage && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setUsage(null)} />
          <div className="relative flex max-h-[85vh] w-full max-w-lg animate-fade-up flex-col overflow-hidden rounded-t-3xl bg-white shadow-premium-lg sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-lg font-extrabold text-slate-900" style={{ margin: 0 }}>Usage · {usage.coupon.code}</h3>
              <button onClick={() => setUsage(null)} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500"><FaTimes /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {usage.rows === null ? <p className="p-6 text-center text-slate-400">Loading…</p> : usage.rows.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-400">Nobody has used this coupon yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {usage.rows.map((u) => (
                    <li key={u._id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-800">{u.userId?.name || 'Customer'}</p>
                        <p className="truncate text-xs text-slate-400">{u.userId?.email} · {fmt(u.createdAt)}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">− {inr(u.discountAmount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && <div className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 animate-fade-up rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-premium-lg">{toast}</div>}
    </AdminLayout>
  );
};

export default AdminCoupons;
