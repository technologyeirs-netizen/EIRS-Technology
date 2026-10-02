import React, { useEffect, useState, useCallback } from 'react';
import { FaTicketAlt, FaCheckCircle, FaTimes, FaChevronDown, FaLock } from 'react-icons/fa';
import { couponService } from '../services/api';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const describeCoupon = (c) =>
  c.discountType === 'percentage'
    ? `${c.discountValue}% OFF${c.maxDiscount > 0 ? ` (up to ${inr(c.maxDiscount)})` : ''}`
    : `${inr(c.discountValue)} OFF`;

/**
 * Props:
 *  subtotal        cart value after product discounts, before GST
 *  applied         { code, discountAmount } | null
 *  onApply(applied) / onRemove()
 */
const CouponBox = ({ subtotal, applied, onApply, onRemove }) => {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [available, setAvailable] = useState([]);
  const [open, setOpen] = useState(true);

  const roundedSubtotal = Math.round(Number(subtotal) || 0);

  useEffect(() => {
    let alive = true;
    couponService
      .getAvailable(roundedSubtotal)
      .then((r) => alive && setAvailable(r.data || []))
      .catch(() => alive && setAvailable([]));
    return () => { alive = false; };
  }, [roundedSubtotal]);

  const apply = useCallback(
    async (value) => {
      const c = String(value ?? code).trim();
      if (!c) return setError('Enter a coupon code');
      setBusy(true);
      setError('');
      try {
        const res = await couponService.validate(c, subtotal);
        onApply({ code: res.data.code, discountAmount: res.data.discountAmount, message: res.message });
        setCode('');
      } catch (e) {
        setError(e.message || 'Could not apply coupon');
      } finally {
        setBusy(false);
      }
    },
    [code, subtotal, onApply]
  );

  return (
    <div className="tw-root rounded-2xl border border-dashed border-brand-300 bg-brand-50/50 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
        <FaTicketAlt className="text-brand-600" /> Apply Coupon
      </div>

      {applied ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-200">
          <div className="flex min-w-0 items-center gap-3">
            <FaCheckCircle className="shrink-0 text-lg text-emerald-600" />
            <div className="min-w-0">
              <p className="break-words text-sm font-extrabold tracking-wide text-emerald-800">{applied.code} applied</p>
              <p className="text-xs text-emerald-700">You saved {inr(applied.discountAmount)}</p>
            </div>
          </div>
          <button onClick={onRemove} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-emerald-700 hover:bg-emerald-100" aria-label="Remove coupon">
            <FaTimes />
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && apply()}
              placeholder="ENTER CODE"
              className="input-premium !uppercase tracking-widest"
              style={{ margin: 0 }}
            />
            <button onClick={() => apply()} disabled={busy} className="btn-brand shrink-0 !px-5">
              {busy ? '...' : 'Apply'}
            </button>
          </div>
          {error && <p className="mt-2 text-xs font-semibold text-rose-600">{error}</p>}
        </>
      )}

      {available.length > 0 && (
        <div className="mt-3">
          <button onClick={() => setOpen((p) => !p)} className="flex w-full items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-500">
            Available offers ({available.length})
            <FaChevronDown className={`transition ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <ul className="mt-2 space-y-2">
              {available.map((c) => {
                const locked = c.applicable === false;
                const isApplied = applied?.code === c.code;
                return (
                  <li key={c._id} className={`relative overflow-hidden rounded-xl bg-white p-3 ring-1 ${locked ? 'ring-slate-200' : 'ring-brand-200'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-extrabold tracking-widest ${locked ? 'bg-slate-100 text-slate-500' : 'bg-brand-100 text-brand-700'}`}>
                          {c.code}
                        </span>
                        <p className="mt-1 text-sm font-bold text-slate-900">{describeCoupon(c)}</p>
                        <p className="text-xs text-slate-500">
                          {c.description || (c.minOrderAmount > 0 ? `On orders above ${inr(c.minOrderAmount)}` : 'No minimum order')}
                        </p>
                        {locked && c.reason && (
                          <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-amber-600"><FaLock className="text-[10px]" /> {c.reason}</p>
                        )}
                        {!locked && c.estimatedDiscount > 0 && !isApplied && (
                          <p className="mt-1 text-xs font-semibold text-emerald-600">Save {inr(c.estimatedDiscount)} on this order</p>
                        )}
                      </div>
                      <button
                        disabled={locked || isApplied || busy}
                        onClick={() => apply(c.code)}
                        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition ${isApplied ? 'bg-emerald-100 text-emerald-700' : locked ? 'cursor-not-allowed bg-slate-100 text-slate-400' : 'bg-brand-600 text-white hover:bg-brand-700'}`}
                      >
                        {isApplied ? 'Applied' : 'Apply'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default CouponBox;
