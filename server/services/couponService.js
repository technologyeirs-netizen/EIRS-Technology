const Coupon = require('../model/couponSchema');
const CouponUsage = require('../model/couponUsageSchema');

// GST is NOT charged on orders. The customer pays: cart subtotal - coupon discount.
const GST_RATE = 0;
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * Pure calculation. `subtotal` = cart value after product discounts, before GST.
 * Never returns more than the subtotal.
 */
const computeDiscount = (coupon, subtotal) => {
  const base = Math.max(0, Number(subtotal) || 0);
  let discount = 0;

  if (coupon.discountType === 'percentage') {
    discount = (base * Number(coupon.discountValue)) / 100;
    if (Number(coupon.maxDiscount) > 0) {
      discount = Math.min(discount, Number(coupon.maxDiscount));
    }
  } else {
    discount = Number(coupon.discountValue);
  }

  discount = Math.min(discount, base);
  return round2(Math.max(0, discount));
};

/** Pure: totals for an order given a subtotal and discount. No GST: total = subtotal - discount. */
const computeTotals = (subtotal, discount = 0) => {
  const taxable = round2(Math.max(0, subtotal - discount));
  const gst = round2(taxable * GST_RATE); // always 0 while GST_RATE is 0
  return { subtotal: round2(subtotal), discount: round2(discount), taxable, gst, total: round2(taxable + gst) };
};

/**
 * Pure: checks everything that does not need the DB.
 * Returns null when OK, otherwise a human readable reason.
 */
const getStaticIneligibility = (coupon, subtotal, now = new Date()) => {
  if (!coupon) return 'Invalid coupon code';
  if (!coupon.isActive) return 'This coupon is not active';
  if (now < new Date(coupon.startDate)) return 'This coupon is not valid yet';
  if (now > new Date(coupon.endDate)) return 'This coupon has expired';
  if (coupon.totalUsageLimit > 0 && coupon.usedCount >= coupon.totalUsageLimit) {
    return 'This coupon has reached its usage limit';
  }
  if (subtotal != null && Number(subtotal) < Number(coupon.minOrderAmount || 0)) {
    return `Add items worth ₹${round2(coupon.minOrderAmount - subtotal).toLocaleString('en-IN')} more to use this coupon (minimum order ₹${Number(coupon.minOrderAmount).toLocaleString('en-IN')})`;
  }
  return null;
};

const normalizeCode = (code) => String(code || '').trim().toUpperCase();

/** Full validation incl. per-user limit. Returns { valid, message, coupon, discount, totals } */
const validateCouponForUser = async (code, userId, subtotal) => {
  const clean = normalizeCode(code);
  if (!clean) return { valid: false, message: 'Please enter a coupon code' };

  const coupon = await Coupon.findOne({ code: clean });
  if (!coupon) return { valid: false, message: 'Invalid coupon code' };

  const reason = getStaticIneligibility(coupon, subtotal);
  if (reason) return { valid: false, message: reason, coupon };

  if (userId) {
    const used = await CouponUsage.countDocuments({ couponId: coupon._id, userId });
    if (used >= coupon.maxUsesPerUser) {
      return {
        valid: false,
        message:
          coupon.maxUsesPerUser === 1
            ? 'You have already used this coupon'
            : `You have already used this coupon ${coupon.maxUsesPerUser} times`,
        coupon,
      };
    }
  }

  const discount = computeDiscount(coupon, subtotal);
  if (discount <= 0) return { valid: false, message: 'This coupon gives no discount on your cart', coupon };

  return { valid: true, message: 'Coupon applied', coupon, discount, totals: computeTotals(subtotal, discount) };
};

/**
 * Called once an order is confirmed (payment verified / COD placed).
 * Idempotent per order. Enforces the total limit atomically.
 */
const redeemCoupon = async (order) => {
  if (!order || !order.couponId || !(order.couponDiscount > 0)) return { redeemed: false };

  const already = await CouponUsage.findOne({ orderId: order._id });
  if (already) return { redeemed: true, alreadyRedeemed: true };

  const bumped = await Coupon.findOneAndUpdate(
    {
      _id: order.couponId,
      $or: [{ totalUsageLimit: 0 }, { $expr: { $lt: ['$usedCount', '$totalUsageLimit'] } }],
    },
    { $inc: { usedCount: 1 } },
    { new: true }
  );

  if (!bumped) return { redeemed: false, reason: 'limit-reached' };

  try {
    await CouponUsage.create({
      couponId: order.couponId,
      code: order.couponCode,
      userId: order.userId,
      orderId: order._id,
      discountAmount: order.couponDiscount,
    });
  } catch (err) {
    // duplicate (race) -> undo the increment
    await Coupon.updateOne({ _id: order.couponId }, { $inc: { usedCount: -1 } });
    if (err.code === 11000) return { redeemed: true, alreadyRedeemed: true };
    throw err;
  }
  return { redeemed: true };
};

/** Give the coupon back if a redeemed order gets cancelled. */
const releaseCoupon = async (order) => {
  if (!order || !order.couponId) return;
  const usage = await CouponUsage.findOneAndDelete({ orderId: order._id });
  if (usage) await Coupon.updateOne({ _id: order.couponId, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
};

module.exports = {
  GST_RATE,
  round2,
  computeDiscount,
  computeTotals,
  getStaticIneligibility,
  normalizeCode,
  validateCouponForUser,
  redeemCoupon,
  releaseCoupon,
};
