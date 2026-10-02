const mongoose = require('mongoose');
const { Schema } = mongoose;

// One document per redeemed coupon (created when an order is confirmed / paid).
const couponUsageSchema = new Schema(
  {
    couponId: { type: Schema.Types.ObjectId, ref: 'Coupon', required: true, index: true },
    code: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    discountAmount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

couponUsageSchema.index({ couponId: 1, userId: 1 });

module.exports = mongoose.model('CouponUsage', couponUsageSchema);
