const mongoose = require('mongoose');
const { Schema } = mongoose;

const couponSchema = new Schema(
  {
    code: {
      type: String,
      required: [true, 'Coupon code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      match: [/^[A-Z0-9_-]{3,20}$/, 'Code must be 3-20 characters (A-Z, 0-9, - or _)'],
    },
    description: { type: String, trim: true, default: '' },

    // percentage => discountValue is a % (1-100); flat => discountValue is a rupee amount
    discountType: {
      type: String,
      enum: ['percentage', 'flat'],
      required: [true, 'Discount type is required'],
    },
    discountValue: {
      type: Number,
      required: [true, 'Discount value is required'],
      min: [1, 'Discount value must be at least 1'],
    },

    // Cart subtotal (after product discounts, before GST) must be >= this to use the coupon
    minOrderAmount: { type: Number, default: 0, min: 0 },

    // Cap for percentage coupons. 0 = no cap
    maxDiscount: { type: Number, default: 0, min: 0 },

    // How many times ONE customer can use this coupon
    maxUsesPerUser: { type: Number, default: 1, min: 1 },

    // How many times the coupon can be used in total (all customers). 0 = unlimited
    totalUsageLimit: { type: Number, default: 0, min: 0 },

    usedCount: { type: Number, default: 0, min: 0 },

    startDate: { type: Date, required: [true, 'Start date is required'] },
    endDate: { type: Date, required: [true, 'End date is required'] },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

couponSchema.pre('validate', function () {
  if (this.discountType === 'percentage' && this.discountValue > 100) {
    this.invalidate('discountValue', 'Percentage discount cannot exceed 100');
  }
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    this.invalidate('endDate', 'End date must be after start date');
  }
});

module.exports = mongoose.model('Coupon', couponSchema);
