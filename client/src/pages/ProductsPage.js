import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FaSearch, FaTimes, FaFilter, FaBoxOpen, FaCheck, FaThLarge, FaSlidersH,
} from "react-icons/fa";
import { productService } from "../services/api";
import { getApiBaseUrl } from "../services/apiBaseUrl";
import ProductCard from "../components/ProductCard";
import axios from "axios";

const PAGE_SIZE = 12;

const SORT_OPTIONS = [
  { value: "", label: "Newest" },
  { value: "price-low-high", label: "Price: Low to High" },
  { value: "price-high-low", label: "Price: High to Low" },
  { value: "top-rated", label: "Top Rated" },
  { value: "most-popular", label: "Most Popular" },
];

const norm = (v) => String(v || "").trim().toLowerCase();
const OBJECT_ID = /^[a-f0-9]{24}$/i;
const sellingPrice = (p) => {
  const price = Number(p.price) || 0;
  const d = Number(p.discount) || 0;
  return d > 0 ? price * (1 - d / 100) : price;
};

const Skeleton = () => (
  <div className="overflow-hidden rounded-2xl bg-white shadow-premium ring-1 ring-slate-900/5">
    <div className="h-48 animate-pulse bg-slate-100" />
    <div className="space-y-3 p-4">
      <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
      <div className="h-6 w-1/3 animate-pulse rounded bg-slate-100" />
    </div>
  </div>
);

const ProductsPage = () => {
  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]); // everything for current category + search
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [drawer, setDrawer] = useState(false);

  // URL is the single source of truth
  const categoryParam = params.get("category") || params.get("categoryId") || "";
  const subcategory = params.get("subcategory") || "";
  const brand = params.get("brand") || "";
  const search = params.get("search") || "";
  const sort = params.get("sort") || "";
  const minPrice = params.get("minPrice") || "";
  const maxPrice = params.get("maxPrice") || "";
  const inStock = params.get("inStock") === "true";

  const [searchInput, setSearchInput] = useState(search);
  useEffect(() => setSearchInput(search), [search]);

  const update = useCallback(
    (patch, { keepPaging = false } = {}) => {
      const next = new URLSearchParams(params);
      next.delete("categoryId"); // legacy param
      Object.entries(patch).forEach(([k, v]) => {
        if (v === "" || v === null || v === undefined || v === false) next.delete(k);
        else next.set(k, String(v));
      });
      if (!keepPaging) setVisible(PAGE_SIZE);
      setParams(next, { replace: true });
    },
    [params, setParams]
  );

  // categories (for chips)
  useEffect(() => {
    const root = getApiBaseUrl().replace(/\/$/, "");
    axios
      .get(`${root}/api/categories`)
      .then((res) => {
        const arr = res.data?.data || res.data?.categories || (Array.isArray(res.data) ? res.data : []);
        setCategories(arr);
      })
      .catch(() => setCategories([]));
  }, []);

  // current category object (URL may carry an id OR a name)
  const activeCategory = useMemo(() => {
    if (!categoryParam) return null;
    return (
      categories.find((c) => c._id === categoryParam) ||
      categories.find((c) => norm(c.name) === norm(categoryParam)) ||
      null
    );
  }, [categories, categoryParam]);

  // products: the SERVER filters by category/search so we always get every product of it
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await productService.queryProducts({
        category: categoryParam,
        search,
      });
      setItems(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      setError("Could not load products. Please try again.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [categoryParam, search]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // debounce search box -> URL
  const searchTimer = useRef();
  const onSearchChange = (v) => {
    setSearchInput(v);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => update({ search: v.trim() }), 400);
  };

  // facets built from the category's products
  const subcategories = useMemo(() => {
    const map = new Map();
    items.forEach((p) => {
      const n = (p.subcategory || "").trim();
      if (n) map.set(n, (map.get(n) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  const brands = useMemo(() => {
    const map = new Map();
    items
      .filter((p) => !subcategory || norm(p.subcategory) === norm(subcategory))
      .forEach((p) => {
        const n = (p.brand || "").trim();
        if (n) map.set(n, (map.get(n) || 0) + 1);
      });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [items, subcategory]);

  const filtered = useMemo(() => {
    let list = items.filter((p) => {
      if (subcategory && norm(p.subcategory) !== norm(subcategory)) return false;
      if (brand && norm(p.brand) !== norm(brand)) return false;
      if (inStock && !(p.stock > 0)) return false;
      const price = sellingPrice(p);
      if (minPrice !== "" && price < Number(minPrice)) return false;
      if (maxPrice !== "" && price > Number(maxPrice)) return false;
      return true;
    });
    const by = {
      "price-low-high": (a, b) => sellingPrice(a) - sellingPrice(b),
      "price-high-low": (a, b) => sellingPrice(b) - sellingPrice(a),
      "top-rated": (a, b) => (b.rating || 0) - (a.rating || 0) || (b.reviewCount || 0) - (a.reviewCount || 0),
      "most-popular": (a, b) => (b.reviewCount || 0) - (a.reviewCount || 0),
    }[sort];
    return by ? [...list].sort(by) : list;
  }, [items, subcategory, brand, inStock, minPrice, maxPrice, sort]);

  const activeFilterCount = [subcategory, brand, minPrice, maxPrice, inStock ? "1" : ""].filter(Boolean).length;
  const title = activeCategory?.name || (categoryParam && !OBJECT_ID.test(categoryParam) ? categoryParam : "All Products");
  const shown = filtered.slice(0, visible);

  const clearFilters = () => update({ subcategory: "", brand: "", minPrice: "", maxPrice: "", inStock: "" });

  const FilterPanel = (
    <div className="space-y-7">
      {subcategories.length > 0 && (
        <section>
          <h4 className="mb-3 text-xs font-bold uppercase tracking-[.14em] text-slate-500">Sub-category</h4>
          <ul className="space-y-1">
            <li>
              <button onClick={() => update({ subcategory: "", brand: "" })} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition ${!subcategory ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50"}`}>
                All <span className="text-xs text-slate-400">{items.length}</span>
              </button>
            </li>
            {subcategories.map(([name, n]) => (
              <li key={name}>
                <button onClick={() => update({ subcategory: name, brand: "" })} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${norm(subcategory) === norm(name) ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50"}`}>
                  <span className="truncate">{name}</span> <span className="ml-2 text-xs text-slate-400">{n}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {brands.length > 0 && (
        <section>
          <h4 className="mb-3 text-xs font-bold uppercase tracking-[.14em] text-slate-500">Brand</h4>
          <div className="flex flex-wrap gap-2">
            {brands.map(([name, n]) => {
              const on = norm(brand) === norm(name);
              return (
                <button key={name} onClick={() => update({ brand: on ? "" : name })} className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition ${on ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-600 ring-slate-200 hover:ring-brand-300"}`}>
                  {name} <span className={on ? "text-brand-100" : "text-slate-400"}>({n})</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h4 className="mb-3 text-xs font-bold uppercase tracking-[.14em] text-slate-500">Price (₹)</h4>
        <div className="flex items-center gap-2">
          <input type="number" min="0" placeholder="Min" defaultValue={minPrice} key={`min-${minPrice}`} onBlur={(e) => update({ minPrice: e.target.value })} className="input-premium" style={{ margin: 0 }} />
          <span className="text-slate-300">–</span>
          <input type="number" min="0" placeholder="Max" defaultValue={maxPrice} key={`max-${maxPrice}`} onBlur={(e) => update({ maxPrice: e.target.value })} className="input-premium" style={{ margin: 0 }} />
        </div>
      </section>

      <label className="flex cursor-pointer items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
        <span className="text-sm font-semibold text-slate-700">In stock only</span>
        <span className={`relative h-6 w-11 rounded-full transition ${inStock ? "bg-brand-600" : "bg-slate-300"}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${inStock ? "left-[22px]" : "left-0.5"}`} />
          <input type="checkbox" className="sr-only" checked={inStock} onChange={(e) => update({ inStock: e.target.checked })} />
        </span>
      </label>

      {activeFilterCount > 0 && (
        <button onClick={clearFilters} className="btn-soft w-full"><FaTimes /> Clear filters</button>
      )}
    </div>
  );

  return (
    <div className="tw-root min-h-screen bg-slate-50 font-sans text-slate-800">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-ink-900 via-ink-800 to-brand-900">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-10 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
          <p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-brand-300">Shop</p>
          <h1 className="text-3xl font-extrabold tracking-tight !text-white sm:text-4xl" style={{ margin: 0, color: "#fff" }}>{title}</h1>
          <p className="mt-2 text-sm text-slate-300">
            {loading ? "Loading products…" : `${filtered.length} product${filtered.length === 1 ? "" : "s"} found`}
          </p>

          <div className="relative mt-6 max-w-xl">
            <FaSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchInput}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search products, brands, model no…"
              className="w-full rounded-2xl border-0 bg-white/95 py-3.5 pl-11 pr-4 text-sm text-slate-900 shadow-premium-lg outline-none ring-1 ring-white/20 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-400"
              style={{ margin: 0 }}
            />
          </div>
        </div>
      </div>

      {/* Category chips */}
      <div className="relative z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-3 sm:px-6 [scrollbar-width:none]">
          <button
            onClick={() => update({ category: "", subcategory: "", brand: "" })}
            className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition ${!categoryParam ? "bg-brand-600 text-white shadow-glow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            <FaThLarge className="text-xs" /> All
          </button>
          {categories.map((c) => {
            const on = activeCategory?._id === c._id;
            return (
              <button
                key={c._id}
                onClick={() => update({ category: c._id, subcategory: "", brand: "" })}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${on ? "bg-brand-600 text-white shadow-glow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-8 sm:px-6">
        {/* Sidebar desktop */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="card-premium sticky top-36 max-h-[calc(100vh-10rem)] overflow-y-auto p-5">
            <div className="mb-5 flex items-center gap-2 text-sm font-extrabold text-slate-900"><FaSlidersH className="text-brand-600" /> Filters</div>
            {FilterPanel}
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          {/* Toolbar */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <button onClick={() => setDrawer(true)} className="btn-soft lg:hidden">
              <FaFilter /> Filters{activeFilterCount > 0 && <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-600 text-[11px] text-white">{activeFilterCount}</span>}
            </button>
            <div className="hidden flex-wrap items-center gap-2 lg:flex">
              {subcategory && <Chip onClear={() => update({ subcategory: "", brand: "" })}>{subcategory}</Chip>}
              {brand && <Chip onClear={() => update({ brand: "" })}>{brand}</Chip>}
              {(minPrice || maxPrice) && <Chip onClear={() => update({ minPrice: "", maxPrice: "" })}>₹{minPrice || 0} – {maxPrice ? `₹${maxPrice}` : "Any"}</Chip>}
              {inStock && <Chip onClear={() => update({ inStock: "" })}>In stock</Chip>}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden text-sm text-slate-500 sm:inline">Sort by</span>
              <select value={sort} onChange={(e) => update({ sort: e.target.value })} className="rounded-xl border-0 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-500" style={{ margin: 0, width: "auto" }}>
                {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} />)}
            </div>
          ) : error ? (
            <div className="card-premium p-10 text-center">
              <p className="mb-4 font-semibold text-rose-600">{error}</p>
              <button onClick={fetchProducts} className="btn-brand">Retry</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="card-premium flex flex-col items-center p-12 text-center">
              <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-2xl text-brand-600"><FaBoxOpen /></div>
              <h3 className="text-lg font-extrabold text-slate-900" style={{ margin: 0 }}>No products found</h3>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                {categoryParam ? `There are no products in “${title}” matching your filters.` : "Try changing your search or filters."}
              </p>
              <button
                onClick={() => { clearFilters(); update({ search: "", category: "" }); }}
                className="btn-brand mt-5"
              >
                View all products
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3 2xl:grid-cols-4">
                {shown.map((p) => <ProductCard key={p._id} product={p} />)}
              </div>
              {visible < filtered.length && (
                <div className="mt-10 text-center">
                  <p className="mb-3 text-sm text-slate-500">Showing {shown.length} of {filtered.length}</p>
                  <button onClick={() => setVisible((v) => v + PAGE_SIZE)} className="btn-brand !px-8">Load more</button>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setDrawer(false)} />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[85vh] animate-fade-up flex-col rounded-t-3xl bg-white shadow-premium-lg">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="font-extrabold text-slate-900" style={{ margin: 0 }}>Filters</h3>
              <button onClick={() => setDrawer(false)} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100"><FaTimes /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">{FilterPanel}</div>
            <div className="border-t border-slate-100 p-4">
              <button onClick={() => setDrawer(false)} className="btn-brand w-full"><FaCheck /> Show {filtered.length} products</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Chip = ({ children, onClear }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700">
    {children}
    <button onClick={onClear} aria-label="Remove filter" className="text-brand-400 hover:text-brand-700"><FaTimes /></button>
  </span>
);

export default ProductsPage;
