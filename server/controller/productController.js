const Product = require('../model/productSchema.js');
const Category = require('../model/categorySchema');
const mongoose = require("mongoose");

// =========================
// CACHE (per page/limit/category, refresh every 10 minutes)
// =========================
const productsCache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

const clearProductsCache = () => {
  productsCache.clear();
};

// =========================
// CREATE PRODUCT
// =========================
exports.createProduct = async (req, res) => {
  try {
    console.log("📦 Creating product:", req.body);

    const { category } = req.body;

    if (!mongoose.Types.ObjectId.isValid(category)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID sent",
        received: category,
      });
    }

    const product = new Product({
      ...req.body,
      category: new mongoose.Types.ObjectId(category),
    });

    await product.save();

    // New product added -> old cached lists are stale
    clearProductsCache();

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  } catch (error) {
    console.error("❌ Error creating product:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// =========================
// GET ALL PRODUCTS
// =========================
exports.getAllProducts = async (req, res) => {
  try {
    const now = Date.now();

    const page = parseInt(req.query.page, 10) || 1;
    const requestedLimit = parseInt(req.query.limit, 10);
    const wantsAll =
      req.query.limit === "all" ||
      req.query.all === "true" ||
      (Number.isFinite(requestedLimit) && requestedLimit >= 1000);
    const limit = wantsAll
      ? 0
      : Number.isFinite(requestedLimit) && requestedLimit > 0
        ? requestedLimit
        : 50;
    const skip = wantsAll ? 0 : (page - 1) * limit;
    const shouldBypassCache =
      req.query.refresh === "true" ||
      req.query._t ||
      req.query.bust === "true";

    // Filter (built BEFORE cache key so category is part of the key)
    const filter = {};
    if (req.query.category) {
      if (mongoose.Types.ObjectId.isValid(req.query.category)) {
        filter.category = req.query.category;
      } else {
        console.warn("❌ INVALID category (IGNORED):", req.query.category);
      }
    }

    const cacheKey = `${page}_${wantsAll ? "all" : limit}_${filter.category || "any"}`;

    // ---- Cache check ----
    const cachedPage = productsCache.get(cacheKey);
    if (
      !shouldBypassCache &&
      cachedPage &&
      now - cachedPage.timestamp < CACHE_DURATION
    ) {
      res.set("Cache-Control", "public, max-age=300");
      res.set("X-Cache", "HIT");
      return res.json(cachedPage.data);
    }

    // ---- Always get a fresh, accurate count (fast, and respects filter) ----
    const total = await Product.countDocuments(filter);

    // ---- DB query ----
    const query = Product.find(filter)
      .populate("category", "name")
      .select(
        "_id productName description category subcategory submenu channels brand price image stock modelNo hsn isFeatured discount rating reviewCount"
      )
      .sort({ createdAt: -1, _id: -1 }) // _id tiebreaker keeps pagination stable
      .lean();

    if (!wantsAll && limit > 0) {
      query.skip(skip).limit(limit);
    }

    const products = await query.exec();

    const response = {
      data: products,
      pagination: {
        total,
        page,
        limit: wantsAll ? products.length : limit,
        pages: wantsAll ? 1 : Math.ceil(total / limit),
      },
    };

    // ---- Cache store ----
    productsCache.set(cacheKey, { data: response, timestamp: now });

    if (productsCache.size > 20) {
      const firstKey = productsCache.keys().next().value;
      productsCache.delete(firstKey);
    }

    res.set("Cache-Control", "public, max-age=300");
    res.set("X-Cache", "MISS");
    res.json(response);
  } catch (error) {
    console.error("❌ getAllProducts error:", error);
    res.status(500).json({ message: error.message });
  }
};

// =========================
// GET PRODUCT BY ID
// =========================
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("category", "name")
      .lean()
      .exec();
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// =========================
// UPDATE PRODUCT
// =========================
exports.updateProduct = async (req, res) => {
  try {
    const updateData = { ...req.body };

    // Category is always stored as ObjectId
    if (req.body.category) {
      if (!mongoose.Types.ObjectId.isValid(req.body.category)) {
        return res.status(400).json({ message: "Invalid category ID sent" });
      }
      updateData.category = new mongoose.Types.ObjectId(req.body.category);
    }

    const product = await Product.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!product) return res.status(404).json({ message: 'Product not found' });

    clearProductsCache();

    res.json(product);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// =========================
// DELETE PRODUCT
// =========================
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    clearProductsCache();

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// =========================
// FEATURED PRODUCTS (Homepage Top Products)
// =========================
exports.getFeaturedProducts = async (req, res) => {
  try {
    const products = await Product.find({ isFeatured: true })
      .populate("category", "name")
      .select('_id productName category subcategory brand price image stock modelNo isFeatured discount')
      .lean()
      .sort({ updatedAt: -1 })
      .exec();
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =========================
// TOGGLE FEATURED (admin only)
// =========================
exports.toggleFeatured = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    product.isFeatured = !product.isFeatured;
    await product.save();

    clearProductsCache();

    res.json({ success: true, isFeatured: product.isFeatured });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =========================
// ALL UNIQUE SUBCATEGORIES
// =========================
exports.getAllSubcategories = async (req, res) => {
  try {
    const subcategories = await Product.distinct('subcategory');
    const filteredSubcategories = subcategories.filter(
      (sub) => sub && sub.trim() !== ''
    );
    res.json({ success: true, data: filteredSubcategories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =========================
// PRODUCTS BY SUBCATEGORY
// =========================
exports.getProductsBySubcategory = async (req, res) => {
  try {
    const { subcategory } = req.params;
    const products = await Product.find({ subcategory });
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =========================
// ADD SUBCATEGORY TO PRODUCT
// =========================
exports.addSubcategoryToProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const { subcategory } = req.body;

    if (!subcategory || subcategory.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Subcategory is required',
      });
    }

    const product = await Product.findByIdAndUpdate(
      productId,
      { subcategory: subcategory.trim() },
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    clearProductsCache();

    res.json({
      success: true,
      message: 'Subcategory added successfully',
      data: product,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};