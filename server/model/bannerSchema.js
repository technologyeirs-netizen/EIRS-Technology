const mongoose = require('mongoose');
const { Schema } = mongoose;

// Banners power the mobile app's home-screen carousel/banner strip.
// They are app-only — the website does not read this collection.
const bannerSchema = new Schema(
    {
        title: {
            type: String,
            trim: true,
            default: '',
        },
        subtitle: {
            type: String,
            trim: true,
            default: '',
        },
        image: {
            type: String,
            required: [true, 'Banner image is required'],
        },
        imagePublicId: {
            type: String,
            default: '',
        },
        // Where tapping the banner should take the app user.
        linkType: {
            type: String,
            enum: ['none', 'product', 'category', 'subcategory', 'service', 'url'],
            default: 'none',
        },
        linkValue: {
            // productId / categoryId / subcategoryId / serviceId / external url,
            // depending on linkType. Kept as a plain string so the app can decide
            // how to resolve it.
            type: String,
            trim: true,
            default: '',
        },
        placement: {
            // 'home_carousel' = big rotating banner, 'promo_strip' = smaller banner grid
            type: String,
            enum: ['home_carousel', 'promo_strip'],
            default: 'home_carousel',
        },
        sortOrder: {
            type: Number,
            default: 0,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        startsAt: {
            type: Date,
            default: null,
        },
        endsAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

bannerSchema.index({ placement: 1, isActive: 1, sortOrder: 1 });

module.exports = mongoose.model('Banner', bannerSchema, 'banners');
