import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FaTimes,
  FaSearch,
  FaSortAmountDown,
  FaTag,
  FaThLarge,
  FaChevronDown,
  FaFilter,
  FaBoxOpen,
} from "react-icons/fa";
import { productService } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useCategoryFilter } from "../context/CategoryFilterContext";
import CheckoutModal from "../components/CheckoutModal";
import ProductCard from "../components/ProductCard";
import CategorySidebar from "../components/CategorySidebar";
import "../styles/ProductsPage.css";

const ITEMS_PER_PAGE = 15;
const FETCH_LIMIT = 50; // per-request size; we loop through ALL pages
const MAX_PAGES = 100; // safety stop

const API_ROOT = (
  process.env.REACT_APP_API_URL || "http://localhost:5000"
).replace(/\/$/, "");
const API_BASE = `${API_ROOT}/api`;

const SORT_OPTIONS = [
  { value: "", label: "Relevance" },
  { value: "price-low-high", label: "Price: Low to High" },
  { value: "price-high-low", label: "Price: High to Low" },
  { value: "top-rated", label: "Top Rated" },
  { value: "most-popular", label: "Most Popular" },
];

/* ----------------------------- helpers ----------------------------- */

const norm = (v) => String(v ?? "").trim().toLowerCase();

// Response kisi bhi shape mein ho, array nikaal do
const toArray = (res) => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  if (Array.isArray(res?.products)) return res.products;
  return [];
};

// Backend se total / totalPages nikaalo (agar de raha ho)
const getMeta = (res) => {
  const src = res?.pagination || res?.data?.pagination || res || {};
  return {
    total: src.total ?? src.totalProducts ?? src.totalItems ?? res?.total ?? null,
    totalPages: src.totalPages ?? src.pages ?? res?.totalPages ?? null,
  };
};

// Saare pages fetch karke ek array bana do (duplicates hata ke)
const fetchAllPages = async (fetcher) => {
  const map = new Map();
  let page = 1;

  while (page <= MAX_PAGES) {
    const res = await fetcher(page, FETCH_LIMIT);
    const arr = toArray(res);
    if (arr.length === 0) break;

    const before = map.size;
    arr.forEach((p) => map.set(String(p._id ?? `${page}-${map.size}`), p));

    // Naya kuch nahi aaya => backend page ignore kar raha hai, ruk jao
    if (map.size === before) break;

    const { total, totalPages } = getMeta(res);
    if (totalPages && page >= totalPages) break;
    if (total && map.size >= total) break;

    page += 1;
  }
  return Array.from(map.values());
};

// Sabse reliable tareeka: backend ko seedha hit karo, limit=1000 => saare
// products ek hi request mein (productService / pagination / count cache bypass)
const fetchEverything = async (fallbackFetcher) => {
  let direct = [];
  let directTotal = null;

  try {
    const res = await fetch(`${API_BASE}/products?limit=1000&_t=${Date.now()}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const json = await res.json();
      direct = toArray(json);
      directTotal = getMeta(json).total;
    }
  } catch {
    // fallback neeche
  }

  console.log("DIRECT FETCH:", direct.length, "backend total:", directTotal);

  // Direct fetch ne poora data diya to yahin khatam
  if (direct.length > 0 && (!directTotal || direct.length >= directTotal)) {
    return direct;
  }

  // Warna page-by-page fallback
  const paged = await fetchAllPages(fallbackFetcher);
  console.log("PAGED FETCH:", paged.length);
  return paged.length >= direct.length ? paged : direct;
};

// Product ki category/subcategory populated object ho ya plain id/name -
// dono cases ke liye comparable keys nikaalo
const refKeys = (ref) => {
  if (!ref) return [];
  if (typeof ref === "object")
    return [ref._id, ref.name].filter(Boolean).map(norm);
  return [norm(ref)];
};

/* ----------------------------- component ----------------------------- */

const ProductsPage = () => {
  const [searchParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [subcategoriesData, setSubcategoriesData] = useState([]);
  const { user } = useAuth();
  const { isSidebarOpen, closeSidebar } = useCategoryFilter();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(() => {
    const saved = sessionStorage.getItem("pp_currentPage");
    const savedPage = saved ? parseInt(saved, 10) : 1;
    return Number.isInteger(savedPage) && savedPage > 0 ? savedPage : 1;
  });

  const [searchTerm, setSearchTerm] = useState("");
  // selectedCategory: normally category _id (URL se name aaye to categories
  // load hone ke baad _id mein convert ho jata hai)
  const [selectedCategory, setSelectedCategory] = useState(() => {
    const c = searchParams.get("category");
    return c ? decodeURIComponent(c) : "";
  });
  const [selectedSubcategory, setSelectedSubcategory] = useState(() => {
    const s = searchParams.get("subcategory");
    return s ? decodeURIComponent(s) : "";
  });
  const [selectedSubmenu, setSelectedSubmenu] = useState(() => {
    const sm = searchParams.get("submenu");
    return sm ? decodeURIComponent(sm) : "";
  });
  const [selectedBrand, setSelectedBrand] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [selectedSidebarCategories, setSelectedSidebarCategories] = useState(
    new Set(),
  );
  const [isFromSidebar] = useState(
    () => searchParams.get("fromSidebar") === "true",
  );

  const [openDropdown, setOpenDropdown] = useState(null);
  const [showPricePanel, setShowPricePanel] = useState(false);

  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [buyNowQuantity, setBuyNowQuantity] = useState(1);

  /* ---------------------------- data fetching ---------------------------- */

  const fetchProducts = useCallback(async () => {
    try {
      const all = await fetchEverything((p, l) =>
        productService.getProductsFresh(p, l),
      );
      console.log("TOTAL PRODUCTS LOADED:", all.length);
      setProducts(all);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProductsFresh = useCallback(async () => {
    try {
      const all = await fetchEverything((p, l) =>
        productService.getProductsFresh(p, l),
      );
      if (all.length > 0) {
        setProducts(all);
        localStorage.removeItem("products_dirty");
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchCategoriesAndSubcategories = useCallback(async () => {
    try {
      const [catRes, subRes] = await Promise.all([
        productService.getCategories
          ? productService.getCategories()
          : fetch(`${API_BASE}/categories`).then((res) => res.json()),
        productService.getSubcategories
          ? productService.getSubcategories()
          : fetch(`${API_BASE}/subcategories`).then((res) => res.json()),
      ]);

      setCategories(toArray(catRes));
      setSubcategoriesData(toArray(subRes));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchCategoriesAndSubcategories();

    const interval = setInterval(fetchProductsFresh, 5 * 60 * 1000);

    const handleVisibility = () => {
      if (
        document.visibilityState === "visible" &&
        localStorage.getItem("products_dirty") === "true"
      ) {
        fetchProductsFresh();
      }
    };
    const handleStorage = (e) => {
      if (e.key === "products_dirty" && e.newValue === "true") {
        fetchProductsFresh();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("storage", handleStorage);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("storage", handleStorage);
    };
  }, [fetchProducts, fetchProductsFresh, fetchCategoriesAndSubcategories]);

  /* ---------------------------- URL -> state ---------------------------- */

  useEffect(() => {
    const searchQuery = searchParams.get("search");
    setSearchTerm(searchQuery ? decodeURIComponent(searchQuery) : "");

    const categoryFromUrl = searchParams.get("category");
    if (categoryFromUrl) {
      setSelectedCategory(decodeURIComponent(categoryFromUrl));

      const sub = searchParams.get("subcategory");
      setSelectedSubcategory(sub ? decodeURIComponent(sub) : "");

      const submenu = searchParams.get("submenu");
      setSelectedSubmenu(submenu ? decodeURIComponent(submenu) : "");

      setSelectedBrand("");
      setSelectedSidebarCategories(new Set());
    } else {
      setSelectedCategory("");
      setSelectedSubcategory("");
      setSelectedSubmenu("");
    }
  }, [searchParams]);

  // URL se category NAME aaya ho to categories load hone par _id mein badlo
  useEffect(() => {
    if (!selectedCategory || categories.length === 0) return;
    const match = categories.find(
      (c) =>
        String(c._id) === String(selectedCategory) ||
        norm(c.name) === norm(selectedCategory),
    );
    if (match && String(match._id) !== String(selectedCategory)) {
      setSelectedCategory(String(match._id));
    }
  }, [categories, selectedCategory]);

  /* ---------------------------- derived data ---------------------------- */

  const selectedCategoryObj = useMemo(() => {
    if (!selectedCategory) return null;
    return (
      categories.find(
        (c) =>
          String(c._id) === String(selectedCategory) ||
          norm(c.name) === norm(selectedCategory),
      ) || null
    );
  }, [categories, selectedCategory]);

  // Selected category ke subcategories (dropdown ke liye)
  const subcategories = useMemo(() => {
    if (!selectedCategoryObj) return [];
    return subcategoriesData.filter((sub) => {
      const catId =
        typeof sub.category === "object" ? sub.category?._id : sub.category;
      return String(catId) === String(selectedCategoryObj._id);
    });
  }, [selectedCategoryObj, subcategoriesData]);

  const uniqueBrands = useMemo(
    () => [...new Set(products.map((p) => p.brand).filter(Boolean))].sort(),
    [products],
  );

  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Sidebar multi-select categories (name ya id dono chalega)
    if (selectedSidebarCategories.size > 0) {
      const wanted = new Set(
        Array.from(selectedSidebarCategories).map((c) => norm(c)),
      );
      result = result.filter((p) =>
        refKeys(p.category).some((k) => wanted.has(k)),
      );
    }

    // Category
    if (selectedCategory) {
      const keys = new Set(
        selectedCategoryObj
          ? [selectedCategoryObj._id, selectedCategoryObj.name]
              .filter(Boolean)
              .map(norm)
          : [norm(selectedCategory)],
      );
      result = result.filter((p) =>
        refKeys(p.category).some((k) => keys.has(k)),
      );
    }

    // Subcategory (name se select hota hai; product mein name/id/object kuch bhi ho)
    if (selectedSubcategory) {
      const subObj = subcategoriesData.find(
        (s) => norm(s.name) === norm(selectedSubcategory),
      );
      const keys = new Set(
        [norm(selectedSubcategory), subObj ? norm(subObj._id) : null].filter(
          Boolean,
        ),
      );
      result = result.filter((p) =>
        refKeys(p.subcategory).some((k) => keys.has(k)),
      );
    }

    // Submenu
    if (selectedSubmenu) {
      result = result.filter(
        (p) => p.submenu && norm(p.submenu) === norm(selectedSubmenu),
      );
    }

    // Brand
    if (!isFromSidebar && selectedBrand) {
      result = result.filter((p) => p.brand && norm(p.brand) === norm(selectedBrand));
    }

    // Search
    if (!isFromSidebar && searchTerm.trim()) {
      const q = norm(searchTerm);
      result = result.filter((p) => {
        const catName =
          typeof p.category === "object" ? p.category?.name : p.category;
        return (
          norm(p.productName).includes(q) ||
          norm(p.description).includes(q) ||
          norm(p.brand).includes(q) ||
          norm(catName).includes(q)
        );
      });
    }

    // Price
    if (minPrice || maxPrice) {
      const min = minPrice ? parseFloat(minPrice) : 0;
      const max = maxPrice ? parseFloat(maxPrice) : Infinity;
      result = result.filter((p) => {
        const price = parseFloat(p.price) || 0;
        return price >= min && price <= max;
      });
    }

    // Sort
    switch (sortBy) {
      case "price-low-high":
        result.sort((a, b) => (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0));
        break;
      case "price-high-low":
        result.sort((a, b) => (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0));
        break;
      case "most-popular":
        result.sort((a, b) => {
          const d = (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0);
          return d !== 0 ? d : (b.reviewCount || 0) - (a.reviewCount || 0);
        });
        break;
      case "top-rated":
        result.sort((a, b) => (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0));
        break;
      default:
        break;
    }

    return result;
  }, [
    products,
    subcategoriesData,
    searchTerm,
    selectedCategory,
    selectedCategoryObj,
    selectedSubcategory,
    selectedSubmenu,
    selectedBrand,
    selectedSidebarCategories,
    minPrice,
    maxPrice,
    sortBy,
    isFromSidebar,
  ]);

  /* ---------------------------- pagination ---------------------------- */

  // Filter/search/sort badalne par hi page 1 par jao
  const filterFingerprint = JSON.stringify({
    searchTerm,
    selectedCategory: selectedCategoryObj?._id || selectedCategory,
    selectedSubcategory,
    selectedSubmenu,
    selectedBrand,
    sidebar: Array.from(selectedSidebarCategories).sort(),
    minPrice,
    maxPrice,
    sortBy,
  });
  const prevFilterFingerprintRef = useRef(null);
  useEffect(() => {
    if (prevFilterFingerprintRef.current === null) {
      prevFilterFingerprintRef.current = filterFingerprint;
      return;
    }
    if (prevFilterFingerprintRef.current !== filterFingerprint) {
      prevFilterFingerprintRef.current = filterFingerprint;
      setCurrentPage(1);
    }
  }, [filterFingerprint]);

  useEffect(() => {
    try {
      sessionStorage.setItem("pp_currentPage", String(currentPage));
    } catch {
      // ignore
    }
  }, [currentPage]);

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);

  // Products load hone se pehle page clamp mat karo
  useEffect(() => {
    if (!loading && totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage, loading]);

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedProducts = useMemo(
    () => filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE),
    [filteredProducts, startIndex],
  );

  /* ---------------------------- actions ---------------------------- */

  const activeFiltersCount = [
    selectedCategory,
    selectedSubcategory,
    selectedBrand,
    minPrice,
    maxPrice,
    sortBy,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedCategory("");
    setSelectedSubcategory("");
    setSelectedBrand("");
    setSelectedSubmenu("");
    setMinPrice("");
    setMaxPrice("");
    setSortBy("");
    setSelectedSidebarCategories(new Set());
    setCurrentPage(1);
    setOpenDropdown(null);
    setShowPricePanel(false);
  };

  const handleSidebarCategorySelect = useCallback((categoryName) => {
    setSelectedSidebarCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryName)) next.delete(categoryName);
      else next.add(categoryName);
      return next;
    });
    setCurrentPage(1);
  }, []);

  const toggleDropdown = (name) => {
    setOpenDropdown((prev) => (prev === name ? null : name));
    if (name !== "price") setShowPricePanel(false);
  };
  const stopPropagation = (e) => e.stopPropagation();

  useEffect(() => {
    const handler = () => {
      setOpenDropdown(null);
      setShowPricePanel(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const activeChips = useMemo(() => {
    const chips = [];
    if (selectedCategory) {
      chips.push({
        label: selectedCategoryObj?.name || selectedCategory,
        clear: () => {
          setSelectedCategory("");
          setSelectedSubcategory("");
        },
      });
    }
    if (selectedSubcategory)
      chips.push({
        label: selectedSubcategory,
        clear: () => setSelectedSubcategory(""),
      });
    if (selectedBrand)
      chips.push({ label: selectedBrand, clear: () => setSelectedBrand("") });
    if (minPrice || maxPrice)
      chips.push({
        label: `Rs.${minPrice || "0"} - Rs.${maxPrice || "max"}`,
        clear: () => {
          setMinPrice("");
          setMaxPrice("");
        },
      });
    if (sortBy)
      chips.push({
        label: SORT_OPTIONS.find((o) => o.value === sortBy)?.label,
        clear: () => setSortBy(""),
      });
    return chips;
  }, [
    selectedCategory,
    selectedCategoryObj,
    selectedSubcategory,
    selectedBrand,
    minPrice,
    maxPrice,
    sortBy,
  ]);

  /* ---------------------------- render ---------------------------- */

  return (
    <main className="pp-page">
      <div className={`left-sidebar-filters ${isSidebarOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <h3>Categories & Filters</h3>
          <button className="close-sidebar-btn" onClick={closeSidebar}>
            <FaTimes />
          </button>
        </div>
        <CategorySidebar onCategorySelect={handleSidebarCategorySelect} />
      </div>
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={closeSidebar} />
      )}

      <div className="pp-wrapper">
        {/* Page Header */}
        <div className="pp-page-header">
          <div className="pp-page-header-inner">
            <div className="pp-page-title-group">
              <FaThLarge className="pp-page-title-icon" />
              <div>
                <h1 className="pp-page-title">All Products</h1>
                <p className="pp-page-subtitle">
                  Explore our complete security solutions catalog
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        {!isFromSidebar && (
          <div className="pp-filter-bar" onClick={stopPropagation}>
            <div className="pp-filter-bar-left">
              {/* Search */}
              <div className="pp-search-wrap">
                <FaSearch className="pp-search-icon" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pp-search-input"
                />
                {searchTerm && (
                  <button
                    className="pp-search-clear"
                    onClick={() => setSearchTerm("")}
                  >
                    <FaTimes />
                  </button>
                )}
              </div>

              {/* Category */}
              <div className="pp-dropdown-wrap" onClick={stopPropagation}>
                <button
                  className={`pp-filter-btn ${selectedCategory ? "pp-filter-btn--active" : ""}`}
                  onClick={() => toggleDropdown("category")}
                >
                  <FaTag /> {selectedCategoryObj?.name || "Category"}
                  <FaChevronDown
                    className={`pp-chevron ${openDropdown === "category" ? "pp-chevron--open" : ""}`}
                  />
                </button>
                {openDropdown === "category" && (
                  <div className="pp-dropdown-menu">
                    <div
                      className="pp-dropdown-item"
                      onClick={() => {
                        setSelectedCategory("");
                        setSelectedSubcategory("");
                        setOpenDropdown(null);
                      }}
                    >
                      All Categories
                    </div>
                    {categories.map((cat) => (
                      <div
                        key={cat._id}
                        className={`pp-dropdown-item ${
                          selectedCategoryObj?._id === cat._id
                            ? "pp-dropdown-item--active"
                            : ""
                        }`}
                        onClick={() => {
                          setSelectedCategory(String(cat._id));
                          setSelectedSubcategory("");
                          setOpenDropdown(null);
                        }}
                      >
                        {cat.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Subcategory */}
              {selectedCategory && subcategories.length > 0 && (
                <div className="pp-dropdown-wrap" onClick={stopPropagation}>
                  <button
                    className={`pp-filter-btn ${selectedSubcategory ? "pp-filter-btn--active" : ""}`}
                    onClick={() => toggleDropdown("subcategory")}
                  >
                    {selectedSubcategory || "Subcategory"}{" "}
                    <FaChevronDown
                      className={`pp-chevron ${openDropdown === "subcategory" ? "pp-chevron--open" : ""}`}
                    />
                  </button>
                  {openDropdown === "subcategory" && (
                    <div className="pp-dropdown-menu">
                      <div
                        className="pp-dropdown-item"
                        onClick={() => {
                          setSelectedSubcategory("");
                          setOpenDropdown(null);
                        }}
                      >
                        All Subcategories
                      </div>
                      {subcategories.map((sub) => (
                        <div
                          key={sub._id}
                          className={`pp-dropdown-item ${
                            norm(selectedSubcategory) === norm(sub.name)
                              ? "pp-dropdown-item--active"
                              : ""
                          }`}
                          onClick={() => {
                            setSelectedSubcategory(sub.name);
                            setOpenDropdown(null);
                          }}
                        >
                          {sub.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Brand */}
              {uniqueBrands.length > 0 && (
                <div className="pp-dropdown-wrap" onClick={stopPropagation}>
                  <button
                    className={`pp-filter-btn ${selectedBrand ? "pp-filter-btn--active" : ""}`}
                    onClick={() => toggleDropdown("brand")}
                  >
                    {selectedBrand || "Brand"}{" "}
                    <FaChevronDown
                      className={`pp-chevron ${openDropdown === "brand" ? "pp-chevron--open" : ""}`}
                    />
                  </button>
                  {openDropdown === "brand" && (
                    <div className="pp-dropdown-menu">
                      <div
                        className="pp-dropdown-item"
                        onClick={() => {
                          setSelectedBrand("");
                          setOpenDropdown(null);
                        }}
                      >
                        All Brands
                      </div>
                      {uniqueBrands.map((b) => (
                        <div
                          key={b}
                          className={`pp-dropdown-item ${selectedBrand === b ? "pp-dropdown-item--active" : ""}`}
                          onClick={() => {
                            setSelectedBrand(b);
                            setOpenDropdown(null);
                          }}
                        >
                          {b}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Price */}
              <div className="pp-dropdown-wrap" onClick={stopPropagation}>
                <button
                  className={`pp-filter-btn ${minPrice || maxPrice ? "pp-filter-btn--active" : ""}`}
                  onClick={() => setShowPricePanel((prev) => !prev)}
                >
                  Price{" "}
                  <FaChevronDown
                    className={`pp-chevron ${showPricePanel ? "pp-chevron--open" : ""}`}
                  />
                </button>
                {showPricePanel && (
                  <div className="pp-price-panel">
                    <p className="pp-price-panel-title">Price Range (Rs.)</p>
                    <div className="pp-price-row">
                      <input
                        type="number"
                        placeholder="Min"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                        className="pp-price-input"
                        min="0"
                      />
                      <span className="pp-price-sep">to</span>
                      <input
                        type="number"
                        placeholder="Max"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                        className="pp-price-input"
                        min="0"
                      />
                    </div>
                    <button
                      className="pp-price-apply-btn"
                      onClick={() => setShowPricePanel(false)}
                    >
                      Apply
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="pp-filter-bar-right">
              {/* Sort */}
              <div
                className="pp-dropdown-wrap pp-sort-wrap"
                onClick={stopPropagation}
              >
                <button
                  className={`pp-filter-btn pp-sort-btn ${sortBy ? "pp-filter-btn--active" : ""}`}
                  onClick={() => toggleDropdown("sort")}
                >
                  <FaSortAmountDown />
                  {SORT_OPTIONS.find((o) => o.value === sortBy)?.label ||
                    "Sort By"}
                  <FaChevronDown
                    className={`pp-chevron ${openDropdown === "sort" ? "pp-chevron--open" : ""}`}
                  />
                </button>
                {openDropdown === "sort" && (
                  <div className="pp-dropdown-menu pp-dropdown-menu--right">
                    {SORT_OPTIONS.map((opt) => (
                      <div
                        key={opt.value}
                        className={`pp-dropdown-item ${sortBy === opt.value ? "pp-dropdown-item--active" : ""}`}
                        onClick={() => {
                          setSortBy(opt.value);
                          setOpenDropdown(null);
                        }}
                      >
                        {opt.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {activeFiltersCount > 0 && (
                <button className="pp-clear-btn" onClick={clearFilters}>
                  <FaFilter /> Clear ({activeFiltersCount})
                </button>
              )}
            </div>
          </div>
        )}

        {/* Active Chips */}
        {activeChips.length > 0 && (
          <div className="pp-chips-bar">
            <span className="pp-chips-label">Active:</span>
            {activeChips.map((chip, i) => (
              <span key={i} className="pp-chip">
                {chip.label}
                <button className="pp-chip-remove" onClick={chip.clear}>
                  <FaTimes />
                </button>
              </span>
            ))}
            <button className="pp-chips-clear-all" onClick={clearFilters}>
              Clear All
            </button>
          </div>
        )}

        {/* Products Grid */}
        <section className="pp-grid-section">
          <div className="pp-results-bar">
            <p className="pp-results-text">
              {loading ? (
                "Loading..."
              ) : filteredProducts.length === 0 ? (
                "No products"
              ) : (
                <>
                  Showing{" "}
                  <strong>
                    {startIndex + 1}–
                    {Math.min(
                      startIndex + ITEMS_PER_PAGE,
                      filteredProducts.length,
                    )}
                  </strong>{" "}
                  of <strong>{filteredProducts.length}</strong> products
                </>
              )}
            </p>
          </div>

          {loading ? (
            <div className="pp-loading">
              <div className="pp-spinner" />
              <p>Loading products...</p>
            </div>
          ) : paginatedProducts.length > 0 ? (
            <>
              <div className="pp-grid">
                {paginatedProducts.map((product) => (
                  <ProductCard key={product._id} product={product} />
                ))}
              </div>
              {totalPages > 1 && (
                <div className="pp-pagination">
                  <button
                    className="pp-page-nav"
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    Prev
                  </button>
                  <div className="pp-page-numbers">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                      (page) => (
                        <button
                          key={page}
                          className={`pp-page-num ${currentPage === page ? "pp-page-num--active" : ""}`}
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </button>
                      ),
                    )}
                  </div>
                  <button
                    className="pp-page-nav"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(p + 1, totalPages))
                    }
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="pp-empty">
              <FaBoxOpen className="pp-empty-icon" />
              <h3>No products found</h3>
              <p>Try adjusting your filters or search term</p>
              <button className="pp-empty-btn" onClick={clearFilters}>
                Clear Filters
              </button>
            </div>
          )}
        </section>

        {user && selectedProduct && (
          <CheckoutModal
            isOpen={showCheckout}
            onClose={() => {
              setShowCheckout(false);
              setSelectedProduct(null);
              setBuyNowQuantity(1);
            }}
            cartItems={[{ ...selectedProduct, quantity: buyNowQuantity }]}
            totalAmount={
              parseFloat(selectedProduct.price || 0) * buyNowQuantity * 1.18
            }
            userId={user._id}
            userName={user.name}
            userEmail={user.email}
          />
        )}
      </div>
    </main>
  );
};

export default ProductsPage;
