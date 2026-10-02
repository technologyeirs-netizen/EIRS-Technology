import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  FaStar, FaSearch, FaShieldAlt, FaEye, FaEyeSlash, FaEdit, FaTrash, FaTimes,
  FaCheckCircle, FaCommentDots, FaReply,
} from 'react-icons/fa';
import AdminLayout from '../components/AdminLayout';
import { adminReviewService } from '../services/api';

const fmt = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const Stars = ({ value, size = 'text-sm' }) => (
  <span className={`inline-flex gap-0.5 ${size}`}>
    {[1, 2, 3, 4, 5].map((i) => <FaStar key={i} className={i <= value ? 'text-amber-400' : 'text-slate-200'} />)}
  </span>
);

const AdminReviews = () => {
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({ total: 0, hidden: 0, verified: 0, averageRating: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [rating, setRating] = useState('');
  const [status, setStatus] = useState('');
  const [verified, setVerified] = useState('');
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const timer = useRef();

  const flash = (t) => { setToast(t); setTimeout(() => setToast(''), 2500); };

  const load = useCallback(async () => {
    try {
      const res = await adminReviewService.getAll({ search: search.trim() || undefined, rating: rating || undefined, status: status || undefined, verified: verified || undefined });
      setReviews(res.data || []);
      setStats(res.stats || {});
    } catch (e) {
      flash(e?.message || 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  }, [search, rating, status, verified]);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(load, 300);
    return () => clearTimeout(timer.current);
  }, [load]);

  const act = async (fn, okMsg) => {
    try { await fn(); flash(okMsg); load(); } catch (e) { flash(e?.message || 'Action failed'); }
  };

  const save = async (e) => {
    e.preventDefault();
    setError('');
    if (edit.comment.trim() && edit.comment.trim().length < 10) return setError('Comment must be at least 10 characters');
    setSaving(true);
    try {
      await adminReviewService.update(edit._id, { rating: edit.rating, comment: edit.comment, adminReply: edit.adminReply });
      setEdit(null);
      flash('Review updated');
      load();
    } catch (err) {
      setError(err?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const Stat = ({ label, value, tone, icon }) => (
    <div className="card-premium flex items-center gap-4 p-5">
      <span className={`grid h-12 w-12 place-items-center rounded-2xl text-lg ${tone}`}>{icon}</span>
      <div>
        <p className="text-2xl font-extrabold tracking-tight text-slate-900">{value}</p>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      </div>
    </div>
  );

  const Select = ({ value, onChange, children }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-xl border-0 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-500" style={{ margin: 0, width: 'auto' }}>{children}</select>
  );

  return (
    <AdminLayout pageTitle="Customer Reviews" breadcrumbs={[{ label: 'Reviews' }]}>
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <Stat label="Total reviews" value={stats.total ?? 0} icon={<FaCommentDots />} tone="bg-brand-50 text-brand-600" />
          <Stat label="Average rating" value={`${stats.averageRating ?? 0} ★`} icon={<FaStar />} tone="bg-amber-50 text-amber-500" />
          <Stat label="Verified by admin" value={stats.verified ?? 0} icon={<FaShieldAlt />} tone="bg-emerald-50 text-emerald-600" />
          <Stat label="Hidden" value={stats.hidden ?? 0} icon={<FaEyeSlash />} tone="bg-slate-100 text-slate-500" />
        </div>

        <div className="card-premium flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <FaSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by customer, email or comment…" className="input-premium !pl-11" style={{ margin: 0 }} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={rating} onChange={setRating}><option value="">All ratings</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} stars</option>)}</Select>
            <Select value={status} onChange={setStatus}><option value="">All visibility</option><option value="visible">Visible</option><option value="hidden">Hidden</option></Select>
            <Select value={verified} onChange={setVerified}><option value="">All verification</option><option value="true">Verified</option><option value="false">Not verified</option></Select>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">{[0, 1, 2].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-white" />)}</div>
        ) : reviews.length === 0 ? (
          <div className="card-premium grid place-items-center p-14 text-center">
            <FaStar className="mb-3 text-4xl text-slate-200" />
            <p className="text-lg font-extrabold text-slate-900">No reviews found</p>
            <p className="mt-1 text-sm text-slate-500">Reviews from customers who purchased will appear here.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {reviews.map((r) => (
              <li key={r._id} className={`card-premium p-5 transition ${r.isHidden ? 'opacity-70' : ''}`}>
                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="flex items-start gap-3 sm:w-64 sm:shrink-0">
                    {r.productId?.image ? (
                      <img src={r.productId.image} alt="" className="h-14 w-14 shrink-0 rounded-xl bg-slate-50 object-contain ring-1 ring-slate-100" />
                    ) : <div className="h-14 w-14 shrink-0 rounded-xl bg-slate-100" />}
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-bold text-slate-900">{r.productId?.productName || 'Deleted product'}</p>
                      <p className="truncate text-xs text-slate-400">{r.productId?.brand}</p>
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-slate-900">{r.userName}</p>
                      <span className="truncate text-xs text-slate-400">{r.userEmail}</span>
                      {r.verifiedPurchase && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700"><FaCheckCircle /> Purchased</span>}
                      {r.adminVerified && <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700"><FaShieldAlt /> Verified</span>}
                      {r.isHidden && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-600">Hidden</span>}
                    </div>
                    <div className="mt-1 flex items-center gap-2"><Stars value={r.rating} /><span className="text-xs text-slate-400">{fmt(r.createdAt)}</span></div>
                    <p className="mt-2 whitespace-pre-line break-words text-sm text-slate-600">{r.comment || <em className="text-slate-400">No written comment</em>}</p>
                    {r.adminReply && (
                      <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm ring-1 ring-slate-100">
                        <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-brand-700"><FaReply /> Your reply</p>
                        <p className="text-slate-600">{r.adminReply}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-1.5 sm:flex-col">
                    <button onClick={() => act(() => adminReviewService.toggleVerify(r._id), r.adminVerified ? 'Verification removed' : 'Review verified')} className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition sm:flex-none ${r.adminVerified ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}><FaShieldAlt /> {r.adminVerified ? 'Verified' : 'Verify'}</button>
                    <button onClick={() => act(() => adminReviewService.toggleHide(r._id), r.isHidden ? 'Review is now visible' : 'Review hidden')} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 sm:flex-none">{r.isHidden ? <FaEye /> : <FaEyeSlash />} {r.isHidden ? 'Show' : 'Hide'}</button>
                    <button onClick={() => { setError(''); setEdit({ _id: r._id, rating: r.rating, comment: r.comment || '', adminReply: r.adminReply || '', userName: r.userName }); }} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-xs font-bold text-brand-700 hover:bg-brand-100 sm:flex-none"><FaEdit /> Edit</button>
                    <button onClick={() => window.confirm('Delete this review permanently?') && act(() => adminReviewService.remove(r._id), 'Review deleted')} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-100 sm:flex-none"><FaTrash /> Delete</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {edit && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !saving && setEdit(null)} />
          <form onSubmit={save} className="relative flex max-h-[92vh] w-full max-w-lg animate-fade-up flex-col overflow-hidden rounded-t-3xl bg-white shadow-premium-lg sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-lg font-extrabold text-slate-900" style={{ margin: 0 }}>Edit review · {edit.userName}</h3>
              <button type="button" onClick={() => setEdit(null)} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500"><FaTimes /></button>
            </div>
            <div className="space-y-4 overflow-y-auto p-6">
              <div>
                <label className="label-premium">Rating</label>
                <div className="flex gap-1">{[1, 2, 3, 4, 5].map((i) => <button type="button" key={i} onClick={() => setEdit({ ...edit, rating: i })} className="text-3xl"><FaStar className={i <= edit.rating ? 'text-amber-400' : 'text-slate-200'} /></button>)}</div>
              </div>
              <div>
                <label className="label-premium">Comment</label>
                <textarea rows={4} maxLength={500} value={edit.comment} onChange={(e) => setEdit({ ...edit, comment: e.target.value })} className="input-premium resize-none" style={{ margin: 0 }} />
              </div>
              <div>
                <label className="label-premium">Public reply from EIRS (optional)</label>
                <textarea rows={3} maxLength={500} value={edit.adminReply} onChange={(e) => setEdit({ ...edit, adminReply: e.target.value })} placeholder="Thanks for your feedback…" className="input-premium resize-none" style={{ margin: 0 }} />
              </div>
              {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
            </div>
            <div className="flex gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
              <button type="button" onClick={() => setEdit(null)} className="btn-soft flex-1">Cancel</button>
              <button disabled={saving} className="btn-brand flex-1">{saving ? 'Saving…' : 'Save changes'}</button>
            </div>
          </form>
        </div>
      )}

      {toast && <div className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 animate-fade-up rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-premium-lg">{toast}</div>}
    </AdminLayout>
  );
};

export default AdminReviews;
