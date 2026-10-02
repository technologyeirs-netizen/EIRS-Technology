const Product = require('../model/productSchema.js');
const Category = require('../model/categorySchema');
const mongoose = require("mongoose");
const { getRatingsMap } = require("../services/reviewStats");

// ─────────────────────────────────────────────────────────────
// Response cache (per unique query). Short TTL + cleared on every write
// (create / update / delete / stock change) so customers always see the
// same catalogue the admin sees.
// ─────────────────────────────────────────────────────────────
const productsCache = new Map();
const CACHE_DURATION = 60 * 1000; // 60 seconds
const MAX_CACHE_ENTRIES = 60;

const invalidateProductCache = () => productsCache.clear();
exports.invalidateProductCache = invalidateProductCache;

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

// Accepts a category _id OR a category name (case-insensitive). Returns null if it doesn't exist.
const resolveCategoryId = async (value) => {
  const v = String(value || "").trim();
  if (!v) return undefined;
  if (OBJECT_ID_RE.test(v)) return v;
  const cat = await Category.findOne({ name: new RegExp(`^${escapeRegex(v)}$`, "i") }).select("_id").lean();
  return cat ? String(cat._id) : null;
};

const sellingPrice = (p) => {
  const price = Number(p.price) || 0;
  const discount = Number(p.discount) || 0;
  return discount > 0 ? price * (1 - discount / 100) : price;
};

exports.createProduct = async (req, res) => {
  try {
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
    invalidateProductCache();

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  } catch (error) {
    console.error("❌ Error creating product:", error.message);
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * GET /auth/products
 * Query: page, limit | all=true | limit=all, category (id or name), subcategory, submenu,
 *        brand, search, minPrice, maxPrice, inStock, sort (newest|price-low-high|price-high-low|top-rated|most-popular)
 * The filters are applied on the SERVER so a category always returns *all* of its products.
 */
exports.getAllProducts = async (req, res) => {
  try {
    const q = req.query;
    const page = Math.max(1, parseInt(q.page, 10) || 1);
    const requestedLimit = parseInt(q.limit, 10);
    const wantsAll =
      q.limit === "all" || q.all === "true" || (Number.isFinite(requestedLimit) && requestedLimit >= 1000);
    const limit = wantsAll ? 0 : Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : 50;

    // Cache key contains EVERY filter (the old key ignored `category`, which returned wrong products)
    const cacheKey = JSON.stringify({
      page,
      limit: wantsAll ? "all" : limit,
      category: q.category || "",
      categoryId: q.categoryId || "",
      subcategory: q.subcategory || "",
      submenu: q.submenu || "",
      brand: q.brand || "",
      search: q.search || "",
      minPrice: q.minPrice || "",
      maxPrice: q.maxPrice || "",
      inStock: q.inStock || "",
      sort: q.sort || "",
    });

    const bypass = q.refresh === "true" || q.bust === "true";
    const cached = productsCache.get(cacheKey);
    if (!bypass && cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      res.set("Cache-Control", "no-cache");
      res.set("X-Cache", "HIT");
      return res.json(cached.data);
    }

    // ---- build filter ----
    const filter = {};
    const categoryInput = q.category || q.categoryId;
    if (categoryInput) {
      const categoryId = await resolveCategoryId(categoryInput);
      if (categoryId === null) {
        // Unknown category -> nothing to show (never silently fall back to "all products")
        return res.json({
          data: [],
          pagination: { total: 0, page, limit: wantsAll ? 0 : limit, pages: 0 },
        });
      }
      filter.category = categoryId;
    }
    if (q.subcategory) filter.subcategory = new RegExp(`^\\s*${escapeRegex(String(q.subcategory).trim())}\\s*$`, "i");
    if (q.submenu) filter.submenu = new RegExp(`^\\s*${escapeRegex(String(q.submenu).trim())}\\s*$`, "i");
    if (q.brand) filter.brand = new RegExp(`^\\s*${escapeRegex(String(q.brand).trim())}\\s*$`, "i");
    if (q.inStock === "true") filter.stock = { $gt: 0 };
    if (q.search && String(q.search).trim()) {
      const rx = new RegExp(escapeRegex(String(q.search).trim()), "i");
      filter.$or = [{ productName: rx }, { brand: rx }, { modelNo: rx }, { description: rx }, { subcategory: rx }];
    }

    let products = await Product.find(filter)
      .populate("category", "name")
      .select("_id productName category subcategory submenu channels brand price image stock modelNo hsn isFeatured discount createdAt")
      .lean()
      .sort({ createdAt: -1 })
      .exec();

    // Price range is applied on the selling price (after product discount)
    const min = q.minPrice !== undefined && q.minPrice !== "" ? parseFloat(q.minPrice) : null;
    const max = q.maxPrice !== undefined && q.maxPrice !== "" ? parseFloat(q.maxPrice) : null;
    if (min !== null || max !== null) {
      products = products.filter((p) => {
        const price = sellingPrice(p);
        return (min === null || price >= min) && (max === null || price <= max);
      });
    }

    // Attach rating + review count from ONE aggregation (no per-card API calls)
    const ratings = await getRatingsMap();
    products.forEach((p) => {
      const r = ratings[String(p._id)];
      p.rating = r ? r.rating : 0;
      p.reviewCount = r ? r.reviewCount : 0;
    });

    switch (q.sort) {
      case "price-low-high":
        products.sort((a, b) => sellingPrice(a) - sellingPrice(b));
        break;
      case "price-high-low":
        products.sort((a, b) => sellingPrice(b) - sellingPrice(a));
        break;
      case "top-rated":
        products.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
        break;
      case "most-popular":
        products.sort((a, b) => b.reviewCount - a.reviewCount || b.rating - a.rating);
        break;
      default:
        break; // newest first (already sorted)
    }

    const total = products.length;
    const pageItems = wantsAll ? products : products.slice((page - 1) * limit, page * limit);

    const response = {
      data: pageItems,
      pagination: {
        total,
        page,
        limit: wantsAll ? total : limit,
        pages: wantsAll ? 1 : Math.ceil(total / limit),
      },
    };

    productsCache.set(cacheKey, { data: response, timestamp: Date.now() });
    if (productsCache.size > MAX_CACHE_ENTRIES) {
      productsCache.delete(productsCache.keys().next().value);
    }

    res.set("Cache-Control", "no-cache");
    res.set("X-Cache", "MISS");
    res.json(response);
  } catch (error) {
    console.error("❌ getAllProducts error:", error);
    res.status(500).json({ message: error.message });
  }
};

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

exports.updateProduct = async (req, res) => {
  try {
    let updateData = { ...req.body };

    if (req.body.category) {
      const categoryDoc = await Category.findById(req.body.category);
      if (categoryDoc) {
        if (req.body.category) {
  updateData.category = req.body.category; // ALWAYS ObjectId
}// ✅ convert ID to name
      }
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!product) return res.status(404).json({ message: 'Product not found' });

    invalidateProductCache();

    res.json(product);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteProduct = async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });
        
        invalidateProductCache();
        
        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get only featured products (for Homepage Top Products)
exports.getFeaturedProducts = async (req, res) => {
    try {
        const products = await Product.find({ isFeatured: true })
        .populate("category", "name") 
            .select('_id productName category subcategory brand price image stock modelNo isFeatured discount')
            .lean()
            .sort({ updatedAt: -1 })
            .exec();
        const ratings = await getRatingsMap();
        products.forEach((p) => {
            const r = ratings[String(p._id)];
            p.rating = r ? r.rating : 0;
            p.reviewCount = r ? r.reviewCount : 0;
        });
        res.json({ success: true, data: products });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Toggle isFeatured on a product (admin only)
exports.toggleFeatured = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

        product.isFeatured = !product.isFeatured;
        await product.save();

        invalidateProductCache();

        res.json({ success: true, isFeatured: product.isFeatured });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all unique subcategories
exports.getAllSubcategories = async (req, res) => {
    try {
        const subcategories = await Product.distinct('subcategory');
        const filteredSubcategories = subcategories.filter(sub => sub && sub.trim() !== '');
        res.json({
            success: true,
            data: filteredSubcategories
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            message: error.message 
        });
    }
};

// Get products by subcategory
exports.getProductsBySubcategory = async (req, res) => {
    try {
        const { subcategory } = req.params;
        const products = await Product.find({ subcategory });
        res.json({
            success: true,
            data: products
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            message: error.message 
        });
    }
};

// Add subcategory to product
exports.addSubcategoryToProduct = async (req, res) => {
    try {
        const { productId } = req.params;
        const { subcategory } = req.body;
        
        if (!subcategory || subcategory.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Subcategory is required'
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
                message: 'Product not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Subcategory added successfully',
            data: product
        });
    } catch (error) {
        res.status(400).json({ 
            success: false,
            message: error.message 
        });
    }
};
