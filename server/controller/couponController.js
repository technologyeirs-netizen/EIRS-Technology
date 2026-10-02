const mongoose = require('mongoose');
const Coupon = require('../model/couponSchema');
const CouponUsage = require('../model/couponUsageSchema');
const {
  computeDiscount,
  getStaticIneligibility,
  normalizeCode,
  validateCouponForUser,
} = require('../services/couponService');

const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const buildPayload = (body) => ({
  code: normalizeCode(body.code),
  description: String(body.description || '').trim(),
  discountType: body.discountType,
  discountValue: num(body.discountValue),
  minOrderAmount: num(body.minOrderAmount),
  maxDiscount: num(body.maxDiscount),
  maxUsesPerUser: Math.max(1, Math.floor(num(body.maxUsesPerUser, 1))),
  totalUsageLimit: Math.max(0, Math.floor(num(body.totalUsageLimit))),
  startDate: body.startDate ? new Date(body.startDate) : undefined,
  endDate: body.endDate ? endOfDay(body.endDate) : undefined,
  isActive: body.isActive === undefined ? true : Boolean(body.isActive),
});

// End date picked from a calendar means "valid through the end of that day"
const endOfDay = (value) => {
  const d = new Date(value);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) d.setUTCHours(23, 59, 59, 999);
  return d;
};

const errorResponse = (res, error) => {
  if (error.code === 11000) {
    return res.status(400).json({ success: false, message: 'A coupon with this code already exists' });
  }
  if (error.name === 'ValidationError') {
    const message = Object.values(error.errors).map((e) => e.message).join(', ');
    return res.status(400).json({ success: false, message });
  }
  return res.status(500).json({ success: false, message: error.message || 'Server error' });
};

/* ───────────── ADMIN ───────────── */

exports.getAllCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: coupons });
  } catch (error) {
    errorResponse(res, error);
  }
};

exports.createCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.create(buildPayload(req.body));
    res.status(201).json({ success: true, message: 'Coupon created', data: coupon });
  } catch (error) {
    errorResponse(res, error);
  }
};

exports.updateCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found' });

    const payload = buildPayload({ ...coupon.toObject(), ...req.body });
    // usedCount is never editable from the form
    Object.assign(coupon, payload);
    await coupon.save();
    res.json({ success: true, message: 'Coupon updated', data: coupon });
  } catch (error) {
    errorResponse(res, error);
  }
};

exports.toggleCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found' });
    coupon.isActive = !coupon.isActive;
    await coupon.save();
    res.json({ success: true, data: coupon });
  } catch (error) {
    errorResponse(res, error);
  }
};

exports.deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found' });
    // Usage history is kept (orders still reference the code)
    res.json({ success: true, message: 'Coupon deleted' });
  } catch (error) {
    errorResponse(res, error);
  }
};

exports.getCouponUsage = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid coupon id' });
    }
    const usage = await CouponUsage.find({ couponId: req.params.id })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json({ success: true, data: usage });
  } catch (error) {
    errorResponse(res, error);
  }
};

/* ───────────── CUSTOMER ───────────── */

/**
 * Coupons a customer can see. Only currently-valid, active coupons.
 * `subtotal` (optional) tells the customer how far they are from unlocking each one.
 * If logged in (optionalAuth), coupons the user already exhausted are marked.
 */
exports.getAvailableCoupons = async (req, res) => {
  try {
    const now = new Date();
    const subtotal = req.query.subtotal !== undefined ? num(req.query.subtotal) : null;

    const coupons = await Coupon.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    })
      .sort({ createdAt: -1 })
      .lean();

    let usageMap = {};
    if (req.user?.id && coupons.length) {
      const usage = await CouponUsage.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(req.user.id),
            couponId: { $in: coupons.map((c) => c._id) },
          },
        },
        { $group: { _id: '$couponId', n: { $sum: 1 } } },
      ]);
      usageMap = Object.fromEntries(usage.map((u) => [String(u._id), u.n]));
    }

    const data = coupons
      .filter((c) => !(c.totalUsageLimit > 0 && c.usedCount >= c.totalUsageLimit))
      .filter((c) => (usageMap[String(c._id)] || 0) < c.maxUsesPerUser)
      .map((c) => {
        const reason = getStaticIneligibility(c, subtotal);
        return {
          _id: c._id,
          code: c.code,
          description: c.description,
          discountType: c.discountType,
          discountValue: c.discountValue,
          minOrderAmount: c.minOrderAmount,
          maxDiscount: c.maxDiscount,
          endDate: c.endDate,
          applicable: subtotal === null ? null : !reason,
          reason: subtotal === null ? null : reason,
          estimatedDiscount: subtotal === null || reason ? null : computeDiscount(c, subtotal),
        };
      });

    res.json({ success: true, data });
  } catch (error) {
    errorResponse(res, error);
  }
};

exports.validateCoupon = async (req, res) => {
  try {
    const { code, subtotal } = req.body;
    const result = await validateCouponForUser(code, req.user.id, num(subtotal));

    if (!result.valid) {
      return res.status(400).json({ success: false, message: result.message });
    }

    res.json({
      success: true,
      message: `Coupon ${result.coupon.code} applied! You saved ₹${result.discount.toLocaleString('en-IN')}`,
      data: {
        code: result.coupon.code,
        discountType: result.coupon.discountType,
        discountValue: result.coupon.discountValue,
        discountAmount: result.discount,
        totals: result.totals,
      },
    });
  } catch (error) {
    errorResponse(res, error);
  }
};
