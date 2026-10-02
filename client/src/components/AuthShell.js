import React from 'react';
import { Link } from 'react-router-dom';
import { FaShieldAlt, FaTruck, FaTicketAlt, FaHeadset, FaStar } from 'react-icons/fa';

const PERKS = [
  { icon: FaShieldAlt, t: 'Genuine products', d: '100% authentic security & networking gear' },
  { icon: FaTicketAlt, t: 'Member-only coupons', d: 'Unlock exclusive discounts on every order' },
  { icon: FaTruck, t: 'Fast delivery', d: 'Track every order from checkout to doorstep' },
  { icon: FaHeadset, t: 'Expert support', d: 'Installation & after-sales help when you need it' },
];

/** Split-screen premium layout shared by Sign In / Sign Up */
const AuthShell = ({ title, subtitle, children, footer, wide = false }) => (
  <main className="tw-root relative min-h-screen bg-white font-sans lg:grid lg:grid-cols-[1.05fr_1fr]">
    {/* Brand panel */}
    <aside className="relative hidden overflow-hidden bg-gradient-to-br from-ink-900 via-brand-900 to-brand-700 p-12 text-white lg:flex lg:flex-col lg:justify-between">
      <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-brand-500/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-violet-500/30 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 opacity-[.07]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '26px 26px' }} />

      <Link to="/" className="relative flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-lg font-extrabold text-white ring-1 ring-white/20 backdrop-blur" style={{ color: "#fff" }}>E</span>
        <span className="text-xl font-extrabold tracking-tight" style={{ color: '#fff' }}>EIRS Technology</span>
      </Link>

      <div className="relative max-w-lg">
        <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-widest text-brand-200 ring-1 ring-white/15 backdrop-blur">
          <FaStar className="text-amber-300" /> Trusted by 1000+ customers
        </span>
        <h2 className="text-4xl font-extrabold leading-tight tracking-tight xl:text-5xl" style={{ color: '#fff', margin: 0 }}>
          Smart security,<br />
          <span className="bg-gradient-to-r from-brand-200 to-violet-300 bg-clip-text text-transparent">delivered simply.</span>
        </h2>
        <p className="mt-5 text-base leading-relaxed text-slate-300">
          CCTV, biometrics, networking and automation — everything for a safer, smarter space, from one trusted partner.
        </p>

        <div className="mt-10 grid grid-cols-2 gap-4">
          {PERKS.map(({ icon: Icon, t, d }, i) => (
            <div key={t} className="animate-fade-up rounded-2xl bg-white/[.07] p-4 ring-1 ring-white/10 backdrop-blur-md" style={{ animationDelay: `${i * 90}ms` }}>
              <Icon className="mb-3 text-xl text-brand-300" />
              <p className="text-sm font-bold text-white">{t}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">{d}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="relative text-xs text-slate-400">© {new Date().getFullYear()} EIRS Technology. All rights reserved.</p>
    </aside>

    {/* Form panel */}
    <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
      <div className={`w-full animate-fade-up ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        <Link to="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 font-extrabold text-white shadow-glow">E</span>
          <span className="text-lg font-extrabold tracking-tight text-slate-900">EIRS Technology</span>
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900" style={{ margin: 0 }}>{title}</h1>
        <p className="mb-8 mt-2 text-sm text-slate-500">{subtitle}</p>
        {children}
        {footer && <div className="mt-8 text-center text-sm text-slate-500">{footer}</div>}
      </div>
    </section>
  </main>
);

export default AuthShell;
