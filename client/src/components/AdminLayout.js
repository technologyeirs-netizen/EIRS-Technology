import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  FaTachometerAlt, FaBox, FaShoppingCart, FaUsers, FaPhone, FaConciergeBell,
  FaBars, FaTimes, FaChevronLeft, FaSignOutAlt, FaStore, FaChevronDown,
  FaTags, FaTicketAlt, FaStar, FaLayerGroup,
} from 'react-icons/fa';

const NAV_ITEMS = [
  { section: 'Main', items: [{ label: 'Dashboard', to: '/admin/dashboard', icon: FaTachometerAlt }] },
  {
    section: 'Catalogue',
    items: [
      { label: 'Products', to: '/admin/products', icon: FaBox },
      { label: 'Categories', to: '/admin/categories', icon: FaTags },
      { label: 'Subcategories', to: '/admin/subcategories', icon: FaLayerGroup },
      { label: 'Services', to: '/admin/services', icon: FaConciergeBell },
    ],
  },
  {
    section: 'Sales & Marketing',
    items: [
      { label: 'Orders', to: '/admin/orders', icon: FaShoppingCart },
      { label: 'Coupons', to: '/admin/coupons', icon: FaTicketAlt },
      { label: 'Reviews', to: '/admin/reviews', icon: FaStar },
      { label: 'Enquiries', to: '/admin/enquiries', icon: FaPhone },
    ],
  },
  { section: 'Customers', items: [{ label: 'Users', to: '/admin/users', icon: FaUsers }] },
];

const AdminLayout = ({ children, pageTitle, breadcrumbs }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const stored = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
  })();
  const name = stored?.name || 'Admin';
  const initial = name.charAt(0).toUpperCase();

  useEffect(() => {
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const handleLogout = async () => { await logout(); navigate('/'); };
  const showLabels = !collapsed || mobileOpen;

  return (
    <div className="tw-root min-h-screen bg-slate-100/80 font-sans text-slate-800">
      {/* overlay (mobile) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* ───── Sidebar ───── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-gradient-to-b from-ink-900 via-ink-800 to-brand-950 text-slate-300 shadow-2xl transition-all duration-300
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 w-72 ${collapsed ? 'lg:w-[84px]' : 'lg:w-72'}`}
      >
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-violet-600 text-white shadow-glow">
            <FaStore />
          </div>
          {showLabels && (
            <div className="min-w-0 leading-tight">
              <p className="truncate text-base font-extrabold tracking-tight text-white">EIRS Admin</p>
              <p className="text-[11px] font-medium uppercase tracking-widest text-brand-300">Control Panel</p>
            </div>
          )}
          <button
            onClick={() => setCollapsed((p) => !p)}
            className="ml-auto hidden h-7 w-7 place-items-center rounded-lg bg-white/5 text-xs text-slate-400 hover:bg-white/10 hover:text-white lg:grid"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <FaChevronLeft className={`transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          </button>
          <button onClick={() => setMobileOpen(false)} className="ml-auto grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-slate-300 lg:hidden">
            <FaTimes />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {NAV_ITEMS.map((sec) => (
            <div key={sec.section}>
              {showLabels && (
                <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">{sec.section}</p>
              )}
              <div className="space-y-1">
                {sec.items.map((item) => {
                  const active = location.pathname === item.to;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      title={!showLabels ? item.label : undefined}
                      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition
                      ${active ? 'bg-gradient-to-r from-brand-600 to-violet-600 text-white shadow-glow' : 'text-slate-400 hover:bg-white/5 hover:text-white'}
                      ${!showLabels ? 'justify-center' : ''}`}
                    >
                      <Icon className={`shrink-0 text-base ${active ? 'text-white' : 'text-slate-500 group-hover:text-brand-300'}`} />
                      {showLabels && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          {showLabels && (
            <div className="mb-2 flex items-center gap-3 rounded-xl bg-white/5 p-3">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-violet-600 text-sm font-bold text-white">{initial}</div>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-semibold text-white">{name}</p>
                <p className="text-xs text-slate-400">Administrator</p>
              </div>
            </div>
          )}
          <button onClick={handleLogout} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/10 ${!showLabels ? 'justify-center' : ''}`}>
            <FaSignOutAlt /> {showLabels && 'Logout'}
          </button>
        </div>
      </aside>

      {/* ───── Main ───── */}
      <div className={`transition-all duration-300 ${collapsed ? 'lg:pl-[84px]' : 'lg:pl-72'}`}>
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200/70 bg-white/80 px-4 backdrop-blur-xl sm:px-6">
          <button onClick={() => setMobileOpen(true)} className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700 lg:hidden" aria-label="Open menu">
            <FaBars />
          </button>

          <div className="min-w-0 flex-1">
            <nav className="hidden items-center gap-1.5 text-xs text-slate-400 sm:flex">
              <Link to="/admin/dashboard" className="hover:text-brand-600">Home</Link>
              {(breadcrumbs?.length ? breadcrumbs : pageTitle ? [{ label: pageTitle }] : []).map((c, i) => (
                <React.Fragment key={i}>
                  <span>/</span>
                  {c.to ? <Link to={c.to} className="hover:text-brand-600">{c.label}</Link> : <span className="font-semibold text-slate-600">{c.label}</span>}
                </React.Fragment>
              ))}
            </nav>
            {pageTitle && <h1 className="truncate text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl" style={{ margin: 0 }}>{pageTitle}</h1>}
          </div>

          <a href="/" target="_blank" rel="noopener noreferrer" className="hidden items-center gap-2 rounded-xl bg-slate-100 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-brand-50 hover:text-brand-700 md:inline-flex">
            <FaStore /> View Store
          </a>

          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen((p) => !p)} className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-2 transition hover:bg-slate-100">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600 text-sm font-bold text-white">{initial}</span>
              <span className="hidden text-sm font-semibold text-slate-700 sm:block">{name}</span>
              <FaChevronDown className={`text-[10px] text-slate-400 transition ${menuOpen ? 'rotate-180' : ''}`} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-64 animate-fade-in overflow-hidden rounded-2xl bg-white shadow-premium-lg ring-1 ring-slate-900/5">
                <div className="border-b border-slate-100 p-4">
                  <p className="truncate font-bold text-slate-900">{name}</p>
                  <p className="truncate text-xs text-slate-500">{stored?.email}</p>
                  <span className="mt-2 inline-block rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-bold text-brand-700">Administrator</span>
                </div>
                <button onClick={handleLogout} className="flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-50">
                  <FaSignOutAlt /> Sign Out
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
};

export default AdminLayout;
