import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaStar, FaCheckCircle, FaShieldAlt, FaTrash, FaEdit, FaLock, FaReply } from 'react-icons/fa';
import { reviewService } from '../services/api';

const Stars = ({ value, size = 'text-base' }) => (
  <span className={`inline-flex gap-0.5 ${size}`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <FaStar key={i} className={i <= Math.round(value) ? 'text-amber-400' : 'text-slate-200'} />
    ))}
  </span>
);

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

const ProductReviews = ({ productId, user, onChanged }) => {
  const [data, setData] = useState({ reviews: [], averageRating: 0, totalReviews: 0, distribution: {} });
  const [loading, setLoading] = useState(true);
  const [eligibility, setEligibility] = useState(null); // { canReview, hasReviewed, message }
  const [mine, setMine] = useState(null);
  const [filter, setFilter] = useState(0);

  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const userId = user?._id || user?.id;

  const load = useCallback(async () => {
    try {
      const res = await reviewService.getProductReviews(productId);
      setData(res);
    } catch (_) {
      /* keep old data */
    } finally {
      setLoading(false);
    }
    if (userId) {
      try {
        const [elig, own] = await Promise.all([
          reviewService.canReview(productId),
          reviewService.getUserProductReview(productId),
        ]);
        setEligibility(elig);
        setMine(own.review || null);
      } catch (_) {
        setEligibility(null);
      }
    }
  }, [productId, userId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (mine) { setRating(mine.rating); setComment(mine.comment || ''); }
    else { setRating(0); setComment(''); }
  }, [mine]);

  const submit = async (e) => {
    e.preventDefault();
    setMsg({ type: '', text: '' });
    if (!rating) return setMsg({ type: 'error', text: 'Please select a star rating' });
    if (comment.trim() && comment.trim().length < 10) return setMsg({ type: 'error', text: 'Comment must be at least 10 characters' });
    setBusy(true);
    try {
      const res = await reviewService.addReview({ productId, rating, comment: comment.trim() });
      setMsg({ type: 'success', text: res.message || 'Thanks for your review!' });
      await load();
      onChanged && onChanged();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Could not save your review' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete your review?')) return;
    try {
      await reviewService.deleteReview(id);
      setMine(null);
      setMsg({ type: 'success', text: 'Review deleted' });
      await load();
      onChanged && onChanged();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Could not delete review' });
    }
  };

  const visible = useMemo(
    () => (filter ? data.reviews.filter((r) => r.rating === filter) : data.reviews),
    [data.reviews, filter]
  );
  const max = Math.max(1, ...Object.values(data.distribution || {}).map(Number));
  const active = rating || 0;
  const shownStars = hover || active;

  return (
    <section className="tw-root font-sans">
      <div className="mb-6 flex items-end justify-between">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900" style={{ margin: 0 }}>Customer Reviews</h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Summary + form */}
        <div className="space-y-6">
          <div className="card-premium p-6">
            {data.totalReviews === 0 ? (
              <div className="py-4 text-center">
                <Stars value={0} size="text-2xl" />
                <p className="mt-2 text-sm font-semibold text-slate-500">No reviews yet</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4">
                  <span className="text-5xl font-extrabold tracking-tight text-slate-900">{Number(data.averageRating).toFixed(1)}</span>
                  <div>
                    <Stars value={data.averageRating} size="text-lg" />
                    <p className="mt-1 text-sm text-slate-500">{data.totalReviews} review{data.totalReviews > 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="mt-5 space-y-2">
                  {[5, 4, 3, 2, 1].map((s) => {
                    const n = Number(data.distribution?.[s] || 0);
                    return (
                      <button key={s} onClick={() => setFilter(filter === s ? 0 : s)} className={`flex w-full items-center gap-3 rounded-lg px-1 py-0.5 text-xs font-semibold transition ${filter === s ? 'bg-brand-50' : 'hover:bg-slate-50'}`}>
                        <span className="w-6 text-slate-600">{s}★</span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <span className="block h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400" style={{ width: `${(n / max) * 100}%` }} />
                        </span>
                        <span className="w-6 text-right text-slate-400">{n}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="card-premium p-6">
            <h3 className="mb-1 text-base font-extrabold text-slate-900" style={{ margin: 0 }}>{mine ? 'Your review' : 'Write a review'}</h3>

            {!userId ? (
              <div className="mt-3 text-center">
                <p className="mb-4 text-sm text-slate-500">Sign in to share your experience.</p>
                <Link to="/signin" className="btn-brand">Login to review</Link>
              </div>
            ) : eligibility && !eligibility.canReview ? (
              <div className="mt-3 flex gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200">
                <FaLock className="mt-0.5 shrink-0" />
                <p>Only customers who have purchased this product can write a review. Your review will appear here once your order is confirmed.</p>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-3 space-y-4">
                <div>
                  <div className="mb-1 flex items-center gap-1" onMouseLeave={() => setHover(0)}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <button type="button" key={i} onMouseEnter={() => setHover(i)} onClick={() => setRating(i)} aria-label={`${i} star`} className="p-0.5 text-3xl transition hover:scale-110">
                        <FaStar className={i <= shownStars ? 'text-amber-400' : 'text-slate-200'} />
                      </button>
                    ))}
                    {shownStars > 0 && <span className="ml-2 text-sm font-bold text-slate-600">{LABELS[shownStars]}</span>}
                  </div>
                </div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={500}
                  rows={4}
                  placeholder="What did you like or dislike? (optional, min 10 characters)"
                  className="input-premium resize-none"
                  style={{ margin: 0 }}
                />
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{comment.length}/500</span>
                  {mine && (
                    <button type="button" onClick={() => remove(mine._id)} className="inline-flex items-center gap-1 font-semibold text-rose-500 hover:text-rose-700"><FaTrash /> Delete</button>
                  )}
                </div>
                {msg.text && (
                  <p className={`rounded-lg px-3 py-2 text-sm font-semibold ${msg.type === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{msg.text}</p>
                )}
                <button disabled={busy} className="btn-brand w-full">{busy ? 'Saving…' : mine ? 'Update review' : 'Submit review'}</button>
              </form>
            )}
          </div>
        </div>

        {/* List */}
        <div>
          {filter > 0 && (
            <button onClick={() => setFilter(0)} className="mb-4 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700">Showing {filter}★ reviews · Clear</button>
          )}
          {loading ? (
            <div className="space-y-4">{[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100" />)}</div>
          ) : visible.length === 0 ? (
            <div className="card-premium grid place-items-center p-12 text-center">
              <FaStar className="mb-3 text-4xl text-slate-200" />
              <p className="font-bold text-slate-700">{filter ? 'No reviews with this rating' : 'Be the first to review this product'}</p>
              <p className="mt-1 text-sm text-slate-400">Verified buyers can share their experience here.</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {visible.map((r) => {
                const own = String(r.userId) === String(userId);
                return (
                  <li key={r._id} className={`card-premium animate-fade-up p-5 ${own ? 'ring-2 ring-brand-200' : ''}`}>
                    <div className="flex items-start gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600 text-base font-bold text-white">
                        {(r.userName || 'U').charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="font-bold text-slate-900">{r.userName}{own && <span className="ml-2 text-xs font-semibold text-brand-600">(You)</span>}</p>
                          {r.verifiedPurchase && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700"><FaCheckCircle /> Verified Purchase</span>
                          )}
                          {r.adminVerified && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700"><FaShieldAlt /> Verified by EIRS</span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <Stars value={r.rating} size="text-sm" />
                          <span className="text-xs text-slate-400">{fmtDate(r.createdAt)}{r.updatedAt && r.updatedAt !== r.createdAt ? ' · edited' : ''}</span>
                        </div>
                        {r.comment && <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-slate-600">{r.comment}</p>}
                        {r.adminReply && (
                          <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm ring-1 ring-slate-100">
                            <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-brand-700"><FaReply /> Response from EIRS Technology</p>
                            <p className="text-slate-600">{r.adminReply}</p>
                          </div>
                        )}
                      </div>
                      {own && (
                        <button onClick={() => document.querySelector('textarea')?.focus()} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-brand-600" aria-label="Edit review"><FaEdit /></button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
};

export default ProductReviews;
