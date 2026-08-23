const mongoose = require('mongoose');
const Banner = require('../model/bannerSchema');
const { cloudinary } = require('../config/cloudinary');

// ── PUBLIC (used by the app) ────────────────────────────────────────────────
// GET /api/app/banners?placement=home_carousel
// Returns only active banners, whose start/end window (if set) is current,
// sorted for display. No auth required — the app calls this on launch.
exports.getActiveBanners = async (req, res) => {
    try {
        const { placement } = req.query;
        const now = new Date();

        const query = {
            isActive: true,
            $and: [
                { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
                { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
            ],
        };
        if (placement) query.placement = placement;

        const banners = await Banner.find(query).sort({ sortOrder: 1, createdAt: -1 });

        return res.status(200).json({ success: true, count: banners.length, banners });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ── ADMIN ────────────────────────────────────────────────────────────────
// GET /api/app/banners/admin/all — every banner, active or not
exports.getAllBannersAdmin = async (req, res) => {
    try {
        const banners = await Banner.find({}).sort({ placement: 1, sortOrder: 1, createdAt: -1 });
        return res.status(200).json({ success: true, count: banners.length, banners });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.createBanner = async (req, res) => {
    try {
        const data = req.body;

        if (!data.image) {
            return res.status(400).json({ success: false, message: 'Banner image is required' });
        }

        const banner = await Banner.create({
            title: data.title || '',
            subtitle: data.subtitle || '',
            image: data.image,
            imagePublicId: data.imagePublicId || '',
            linkType: data.linkType || 'none',
            linkValue: data.linkValue || '',
            placement: data.placement || 'home_carousel',
            sortOrder: Number(data.sortOrder) || 0,
            isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
            startsAt: data.startsAt || null,
            endsAt: data.endsAt || null,
        });

        return res.status(201).json({ success: true, message: 'Banner created successfully', banner });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateBanner = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid banner id' });
        }

        const data = req.body;
        const updatePayload = {
            title: data.title,
            subtitle: data.subtitle,
            image: data.image,
            imagePublicId: data.imagePublicId,
            linkType: data.linkType,
            linkValue: data.linkValue,
            placement: data.placement,
            sortOrder: data.sortOrder !== undefined ? Number(data.sortOrder) : undefined,
            isActive: data.isActive,
            startsAt: data.startsAt,
            endsAt: data.endsAt,
        };
        Object.keys(updatePayload).forEach(
            (key) => updatePayload[key] === undefined && delete updatePayload[key]
        );

        const banner = await Banner.findByIdAndUpdate(req.params.id, updatePayload, {
            new: true,
            runValidators: true,
        });

        if (!banner) {
            return res.status(404).json({ success: false, message: 'Banner not found' });
        }

        return res.status(200).json({ success: true, message: 'Banner updated successfully', banner });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteBanner = async (req, res) => {
    try {
        const banner = await Banner.findByIdAndDelete(req.params.id);
        if (!banner) {
            return res.status(404).json({ success: false, message: 'Banner not found' });
        }

        if (banner.imagePublicId) {
            await cloudinary.uploader.destroy(banner.imagePublicId).catch(() => {});
        }

        return res.status(200).json({ success: true, message: 'Banner deleted successfully' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// PUT /api/app/banners/reorder  Body: { order: [{ id, sortOrder }] }
exports.reorderBanners = async (req, res) => {
    try {
        const { order } = req.body;
        if (!Array.isArray(order)) {
            return res.status(400).json({ success: false, message: 'order must be an array' });
        }

        await Promise.all(
            order.map(({ id, sortOrder }) =>
                mongoose.Types.ObjectId.isValid(id)
                    ? Banner.findByIdAndUpdate(id, { sortOrder: Number(sortOrder) || 0 })
                    : Promise.resolve()
            )
        );

        return res.status(200).json({ success: true, message: 'Order updated' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
