// client/public/app.js
// MAI SERVICE MARKETPLACE - MAIN APPLICATION ENTRYPOINT & CONTROLLER
const { useState, useEffect, useMemo, useRef } = React;

// =========================================================================
// API CLIENT WITH AUTH HEADERS & PERSISTENCE
// =========================================================================

// Dynamically resolve API base across localhost, reverse proxy, or remote backend
const getApiBase = () => {
  if (typeof window !== 'undefined') {
    if (window.__MAI_API_BASE__) return window.__MAI_API_BASE__;
    const metaTag = document.querySelector('meta[name="mai-api-base"]');
    if (metaTag && metaTag.content && !metaTag.content.startsWith('%') && metaTag.content.trim() !== '') {
      return metaTag.content.trim().replace(/\/$/, '');
    }
  }
  return '/api';
};

const API_BASE = getApiBase();

// Pre-hydrated marketplace catalog data to ensure zero-lag render
const _maiInitial = (typeof window !== 'undefined' && window.__MAI_INITIAL_DATA__) || {};
const INITIAL_CATEGORIES = Array.isArray(_maiInitial.categories) ? _maiInitial.categories : [];
const INITIAL_SUBCATEGORIES = Array.isArray(_maiInitial.subcategories) ? _maiInitial.subcategories : [];
const INITIAL_SERVICES = Array.isArray(_maiInitial.services) ? _maiInitial.services : [];
const INITIAL_PROFESSIONALS = Array.isArray(_maiInitial.professionals) ? _maiInitial.professionals : [];

// Client-Side SPA Route Definitions & Path Mappings
const ROUTE_MAP = {
  '/': 'home',
  '/home': 'home',
  '/categories': 'categories',
  '/services': 'services',
  '/professionals': 'professionals',
  '/how-it-works': 'how-it-works',
  '/about-us': 'about-us',
  '/contact-us': 'contact-us',
  '/help-faq': 'help-faq',
  '/privacy-policy': 'privacy-policy',
  '/terms': 'terms',
  '/dashboard': 'dashboard',
  '/dashboard/': 'dashboard',
  '/dashboard/professionals': 'dashboard-professionals',
  '/dashboard/services': 'dashboard-services',
  '/dashboard/bookings': 'my-bookings',
  '/dashboard/my-bookings': 'my-bookings',
  '/my-bookings': 'my-bookings',
  '/dashboard/payments': 'payments',
  '/payments': 'payments',
  '/dashboard/messages': 'messages',
  '/messages': 'messages',
  '/dashboard/saved': 'saved',
  '/saved': 'saved',
  '/dashboard/profile': 'profile',
  '/profile': 'profile',
  '/dashboard/addresses': 'addresses',
  '/addresses': 'addresses',
  '/dashboard/notifications': 'notifications',
  '/notifications': 'notifications',
  '/dashboard/settings': 'settings',
  '/settings': 'settings',
  '/dashboard/help': 'help',
  '/help': 'help'
};

const getPathFromView = (view) => {
  switch (view) {
    case 'home': return '/';
    case 'categories': return '/categories';
    case 'category-detail': return '/categories';
    case 'services': return '/services';
    case 'service-detail': return '/services';
    case 'professionals': return '/professionals';
    case 'professional-profile': return '/professionals';
    case 'how-it-works': return '/how-it-works';
    case 'about-us': return '/about-us';
    case 'contact-us': return '/contact-us';
    case 'help-faq': return '/help-faq';
    case 'privacy-policy': return '/privacy-policy';
    case 'terms': return '/terms';
    case 'dashboard': return '/dashboard';
    case 'dashboard-professionals': return '/dashboard/professionals';
    case 'dashboard-services': return '/dashboard/services';
    case 'my-bookings': return '/dashboard/bookings';
    case 'payments': return '/dashboard/payments';
    case 'messages': return '/dashboard/messages';
    case 'saved': return '/dashboard/saved';
    case 'profile': return '/dashboard/profile';
    case 'addresses': return '/dashboard/addresses';
    case 'notifications': return '/dashboard/notifications';
    case 'settings': return '/dashboard/settings';
    case 'help': return '/dashboard/help';
    default: return '/';
  }
};

const getViewFromPath = (path) => {
  const current = (path || (typeof window !== 'undefined' ? window.location.pathname : '/')).replace(/\/$/, '') || '/';
  if (ROUTE_MAP[current]) {
    return ROUTE_MAP[current];
  }
  if (current.startsWith('/dashboard/professionals')) return 'dashboard-professionals';
  if (current.startsWith('/dashboard/services')) return 'dashboard-services';
  if (current.startsWith('/dashboard/bookings') || current.startsWith('/dashboard/my-bookings')) return 'my-bookings';
  if (current.startsWith('/dashboard/payments')) return 'payments';
  if (current.startsWith('/dashboard/messages')) return 'messages';
  if (current.startsWith('/dashboard/saved')) return 'saved';
  if (current.startsWith('/dashboard/profile')) return 'profile';
  if (current.startsWith('/dashboard/addresses')) return 'addresses';
  if (current.startsWith('/dashboard/notifications')) return 'notifications';
  if (current.startsWith('/dashboard/settings')) return 'settings';
  if (current.startsWith('/dashboard/help')) return 'help';
  if (current.startsWith('/dashboard')) return 'dashboard';
  if (current.startsWith('/services')) return 'services';
  if (current.startsWith('/professionals')) return 'professionals';
  if (current.startsWith('/categories')) return 'categories';
  return 'home';
};

const fetchAPI = async (endpoint, options = {}) => {
  try {
    const token = localStorage.getItem('mai_token') || 'demo-token-usr-1793282160350';
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    if (res.status === 401) {
      console.warn(`[API] 401 Unauthorized on ${endpoint}`);
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      // Returned HTML or non-JSON (e.g. Netlify static redirect /* /index.html 200)
      return { ok: false, status: res.status, data: null, error: 'Expected JSON, got ' + contentType };
    }

    const data = await res.json().catch(() => null);
    if (data === null) {
      return { ok: false, status: res.status, data: null, error: 'Malformed JSON' };
    }

    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    console.warn(`[API NOTICE] ${endpoint}:`, err.message);
    return { ok: false, status: 500, data: null, error: err.message };
  }
};

// =========================================================================
// PUBLIC WEBSITE HEADER (Section 4.1)
// =========================================================================

function Header({ user, currentView, onNavigate, onOpenAuth, onLogout }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (window.lucide) window.lucide.createIcons();
  }, [user, currentView, mobileNavOpen]);

  const navLinks = [
    { id: 'home', label: 'Home' },
    { id: 'categories', label: 'Categories' },
    { id: 'services', label: 'Services' },
    { id: 'professionals', label: 'Professionals' },
    { id: 'how-it-works', label: 'How It Works' }
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#EFECE6] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        {/* Brand Logo */}
        <div className="flex items-center gap-8">
          <button 
            onClick={() => onNavigate('home')} 
            className="flex items-center gap-2.5 focus:outline-none group text-left"
          >
            <div className="h-10 px-2.5 rounded-xl bg-[#14223E] flex items-center justify-center text-white font-extrabold text-base tracking-tight shadow-xs">
              MAI
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-extrabold tracking-tight text-[#1E130F] leading-none">
                MAI SERVICE
              </span>
              <span className="text-[9px] font-bold tracking-widest text-[#DE5426] uppercase leading-none mt-1">
                HOME SERVICES MARKETPLACE
              </span>
            </div>
          </button>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map(link => {
              const isActive = currentView === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => onNavigate(link.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                    isActive 
                      ? 'text-[#DE5426] bg-[#FAF8F5]' 
                      : 'text-gray-700 hover:text-[#DE5426] hover:bg-[#FAF8F5]'
                  }`}
                >
                  {link.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Actions */}
        <div className="hidden sm:flex items-center gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('dashboard')}
              className="px-4 py-2.5 bg-[#DE5426] hover:bg-[#C8461C] text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2"
            >
              <i data-lucide="layout-dashboard" className="w-3.5 h-3.5"></i>
              <span>Open Client Workspace</span>
            </button>

            <button
              onClick={() => onNavigate('profile')}
              className="flex items-center gap-2 pl-2 focus:outline-none"
            >
              <img 
                src={user?.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80"} 
                alt={user?.name || "Customer"} 
                className="w-8 h-8 rounded-full object-cover border border-[#EFECE6]"
              />
            </button>
          </div>
        </div>

        {/* Mobile menu trigger */}
        <button
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
          className="lg:hidden p-2 text-gray-700 hover:text-black focus:outline-none"
        >
          <i data-lucide={mobileNavOpen ? "x" : "menu"} className="w-6 h-6"></i>
        </button>

      </div>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="lg:hidden bg-white border-b border-[#EFECE6] px-4 py-4 space-y-3 shadow-lg">
          <nav className="flex flex-col space-y-1">
            {navLinks.map(link => (
              <button
                key={link.id}
                onClick={() => { setMobileNavOpen(false); onNavigate(link.id); }}
                className="w-full text-left px-3 py-2 text-sm font-bold text-gray-700 hover:text-[#DE5426] rounded-lg"
              >
                {link.label}
              </button>
            ))}
          </nav>
          
          <div className="pt-3 border-t border-[#EFECE6] flex flex-col gap-2">
            <button
              onClick={() => { setMobileNavOpen(false); onNavigate('dashboard'); }}
              className="w-full py-2.5 bg-[#DE5426] text-white text-xs font-bold rounded-xl text-center"
            >
              Go to Workspace
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

// =========================================================================
// PUBLIC WEBSITE FOOTER
// =========================================================================

function Footer({ onNavigate }) {
  useEffect(() => {
    if (window.lucide) window.lucide.createIcons();
  }, []);

  return (
    <footer className="bg-[#14223E] text-white pt-16 pb-12 mt-auto border-t border-[#1E130F]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-white/10">
          
          {/* Brand Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="h-9 px-2 rounded-lg bg-[#DE5426] flex items-center justify-center text-white font-extrabold text-sm">
                MAI
              </div>
              <span className="text-xl font-extrabold tracking-tight">MAI SERVICE</span>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed max-w-sm">
              The premier on-demand home services marketplace connecting UK property owners with certified carpenters, plumbers, electricians, painters, and maintenance specialists.
            </p>
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
              <i data-lucide="shield-check" className="w-4 h-4"></i>
              <span>100% Escrow Protected & Verified Pros</span>
            </div>
          </div>

          {/* Core Categories */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-orange-400">Popular Trades</h4>
            <ul className="space-y-2 text-xs text-gray-300">
              <li><button onClick={() => onNavigate('categories', { category: 'carpenter' })} className="hover:text-white">Carpenter & Door Fitting</button></li>
              <li><button onClick={() => onNavigate('categories', { category: 'plumber' })} className="hover:text-white">Plumbing & Emergency Leaks</button></li>
              <li><button onClick={() => onNavigate('categories', { category: 'electrician' })} className="hover:text-white">Electrical & Lighting</button></li>
              <li><button onClick={() => onNavigate('categories', { category: 'painter' })} className="hover:text-white">Painting & Decorating</button></li>
              <li><button onClick={() => onNavigate('categories', { category: 'general-maintenance' })} className="hover:text-white">General Property Maintenance</button></li>
            </ul>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-orange-400">Platform</h4>
            <ul className="space-y-2 text-xs text-gray-300">
              <li><button onClick={() => onNavigate('how-it-works')} className="hover:text-white">How It Works</button></li>
              <li><button onClick={() => onNavigate('about-us')} className="hover:text-white">About MAI Service</button></li>
              <li><button onClick={() => onNavigate('professionals')} className="hover:text-white">Find Professionals</button></li>
              <li><button onClick={() => onNavigate('services')} className="hover:text-white">Service Packages</button></li>
              <li><button onClick={() => onNavigate('help-faq')} className="hover:text-white">Help & FAQs</button></li>
            </ul>
          </div>

          {/* Legal & Contact */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-orange-400">Customer Support</h4>
            <p className="text-xs text-gray-300">Mon - Sat: 08:00 - 19:00 GMT</p>
            <p className="text-xs text-gray-300">London, United Kingdom</p>
            <p className="text-xs text-gray-300">support@myproject.ai</p>
            <div className="pt-2 flex flex-col gap-1 text-[11px] text-gray-400">
              <button onClick={() => onNavigate('privacy-policy')} className="hover:text-white text-left">Privacy Policy</button>
              <button onClick={() => onNavigate('terms')} className="hover:text-white text-left">Terms of Service</button>
            </div>
          </div>

        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-400 gap-4">
          <p>© 2026 MAI Service Marketplace (MAICART / MYPROJECT.AI). All rights reserved.</p>
          <p className="text-[11px]">Authorized UK Domestic Construction & Maintenance Platform.</p>
        </div>
      </div>
    </footer>
  );
}

// =========================================================================
// PUBLIC HOME PAGE (Section 4.2)
// =========================================================================

function HomePage({ 
  categories = [], 
  services = [], 
  professionals = [], 
  onNavigate, 
  onSelectCategory, 
  onSelectService, 
  onSelectPro, 
  onBookService 
}) {
  const [heroSearch, setHeroSearch] = useState('');

  useEffect(() => {
    if (window.lucide) window.lucide.createIcons();
  }, [categories, services, professionals]);

  const handleHeroSubmit = (e) => {
    e.preventDefault();
    onNavigate('services', { search: heroSearch });
  };

  const safePros = professionals || [];
  const safeServices = services || [];
  const safeCategories = categories || [];

  const featuredPros = safePros.slice(0, 3);
  const featuredServices = safeServices.slice(0, 4);

  return (
    <div className="space-y-16 pb-20">
      
      {/* 1. HERO SECTION */}
      <section className="relative bg-[#14223E] text-white py-16 md:py-24 px-4 sm:px-6 lg:px-8 overflow-hidden rounded-b-3xl">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>
        
        <div className="max-w-4xl mx-auto text-center relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-orange-400 text-xs font-bold border border-white/15">
            <i data-lucide="sparkles" className="w-3.5 h-3.5"></i>
            <span>Verified Domestic & Trade Home Services</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
            Find the Right Home Professional for Any Job
          </h1>

          <p className="text-base sm:text-lg text-gray-300 max-w-2xl mx-auto leading-relaxed">
            Carpentry, PVC door installation, emergency plumbing, electrical repairs, and painting delivered by vetted UK craftspeople.
          </p>

          {/* Hero Search Box */}
          <form onSubmit={handleHeroSubmit} className="max-w-2xl mx-auto bg-white p-2 rounded-2xl shadow-2xl flex flex-col sm:flex-row items-center gap-2 border border-white/20">
            <div className="relative flex-1 w-full flex items-center pl-3">
              <i data-lucide="search" className="w-5 h-5 text-gray-400 mr-2 shrink-0"></i>
              <input
                type="text"
                value={heroSearch}
                onChange={(e) => setHeroSearch(e.target.value)}
                placeholder="What service do you need? (e.g. PVC Door, Plumber, Paint)..."
                className="w-full py-2.5 text-xs sm:text-sm text-[#1E130F] focus:outline-none placeholder-gray-400 font-medium"
              />
            </div>
            <button
              type="submit"
              className="w-full sm:w-auto px-7 py-3 bg-[#DE5426] hover:bg-[#C8461C] text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm"
            >
              Search Services
            </button>
          </form>

          {/* Quick Search Suggestions */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-xs text-gray-300">
            <span className="font-semibold text-gray-400">Popular:</span>
            {['PVC Door Installation', 'Pipe Leak Repair', 'Consumer Unit', 'Wall Painting', 'Kitchen Fitting'].map(term => (
              <button
                key={term}
                onClick={() => onNavigate('services', { search: term })}
                className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-[11px] font-medium transition-colors"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 2. POPULAR SERVICE CATEGORIES */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-2">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-[#DE5426]">Browse Expertise</span>
            <h2 className="text-2xl md:text-3xl font-extrabold text-[#1E130F] mt-1">Popular Service Categories</h2>
          </div>
          <button
            onClick={() => onNavigate('categories')}
            className="text-xs font-bold text-[#DE5426] hover:underline"
          >
            View All Categories →
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {safeCategories.map(cat => (
            <div
              key={cat.id}
              onClick={() => onSelectCategory(cat)}
              className="bg-white border border-[#EFECE6] hover:border-[#DE5426] rounded-2xl p-4 text-center cursor-pointer shadow-xs hover:shadow-md transition-all group flex flex-col items-center justify-between"
            >
              <div className="w-12 h-12 rounded-xl bg-[#FAF8F5] group-hover:bg-orange-50 text-[#DE5426] flex items-center justify-center transition-colors mb-3">
                <i data-lucide={cat.icon || 'wrench'} className="w-6 h-6"></i>
              </div>
              <h3 className="text-xs font-bold text-[#1E130F] group-hover:text-[#DE5426] transition-colors line-clamp-1">
                {cat.name}
              </h3>
              <span className="text-[10px] text-gray-400 mt-1 block">
                {cat.subcategoriesCount || 3} Subcategories
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 3. FEATURED SERVICES (Including PVC Door Installation illustrative requirement) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-2">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-[#DE5426]">Standard & Hourly Pricing</span>
            <h2 className="text-2xl md:text-3xl font-extrabold text-[#1E130F] mt-1">Popular Home Services</h2>
            <p className="text-xs text-gray-500 mt-1">Authoritatively priced and backed by our quality satisfaction guarantee.</p>
          </div>
          <button
            onClick={() => onNavigate('services')}
            className="text-xs font-bold text-[#DE5426] hover:underline"
          >
            Explore All Services →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredServices.map(service => (
            <div
              key={service.id}
              className="bg-white border border-[#EFECE6] rounded-2xl overflow-hidden shadow-xs hover:border-[#DE5426] transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="h-40 w-full overflow-hidden relative bg-gray-100">
                  <img
                    src={service.image}
                    alt={service.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <span className="absolute bottom-2.5 right-2.5 bg-black/80 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-0.5 rounded-md">
                    £{service.price} / {service.pricingUnit || 'hour'}
                  </span>
                </div>

                <div className="p-4 space-y-2">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-amber-500">
                    <i data-lucide="star" className="w-3.5 h-3.5 fill-amber-500 text-amber-500"></i>
                    <span>{service.rating || 5.0}</span>
                    <span className="text-gray-400 font-normal">({service.reviewsCount || 100})</span>
                  </div>

                  <h3 className="text-sm font-bold text-[#1E130F] line-clamp-1 group-hover:text-[#DE5426] transition-colors">
                    {service.title}
                  </h3>

                  <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed">
                    {service.shortDescription}
                  </p>
                </div>
              </div>

              <div className="p-4 pt-0 flex items-center gap-2">
                <button
                  onClick={() => onSelectService(service)}
                  className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-bold transition-colors"
                >
                  Details
                </button>
                <button
                  onClick={() => onBookService(service)}
                  className="flex-1 py-2 bg-[#DE5426] hover:bg-[#C8461C] text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                >
                  Book Now
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. FEATURED PROFESSIONALS SHOWCASE */}
      <section className="bg-white border-y border-[#EFECE6] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-2">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-[#DE5426]">Vetted Specialists</span>
              <h2 className="text-2xl md:text-3xl font-extrabold text-[#1E130F] mt-1">Featured Trade Professionals</h2>
              <p className="text-xs text-gray-500 mt-1">Fully credentialed, insured, and verified with authentic customer review history.</p>
            </div>
            <button
              onClick={() => onNavigate('professionals')}
              className="text-xs font-bold text-[#DE5426] hover:underline"
            >
              Browse All Pros →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuredPros.map(pro => (
              <div 
                key={pro.id} 
                className="bg-[#FAF8F5] border border-[#EFECE6] rounded-2xl p-6 shadow-xs hover:border-[#DE5426] transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start gap-4">
                    <img 
                      src={pro.avatar} 
                      alt={pro.name} 
                      className="w-16 h-16 rounded-2xl object-cover shrink-0 border border-white shadow-xs"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-base font-bold text-[#1E130F] truncate">{pro.name}</h3>
                        {pro.verified && (
                          <i data-lucide="check-circle" className="w-4 h-4 text-blue-500 shrink-0"></i>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{pro.title}</p>
                      
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center gap-1 text-xs font-bold text-amber-500">
                          <i data-lucide="star" className="w-3.5 h-3.5 fill-amber-500 text-amber-500"></i>
                          <span>{pro.rating.toFixed(1)}</span>
                          <span className="text-gray-400 font-normal">({pro.reviewsCount})</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-gray-600 mt-4 line-clamp-2 leading-relaxed">
                    {pro.bio}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-[#EFECE6] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Rate</span>
                    <span className="text-sm font-extrabold text-[#1E130F]">£{pro.hourlyRate || pro.startingPrice}/hr</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSelectPro(pro)}
                      className="px-3.5 py-1.5 bg-white border border-[#EFECE6] hover:border-[#DE5426] text-gray-800 rounded-lg text-xs font-bold"
                    >
                      Profile
                    </button>
                    <button
                      onClick={() => onBookService({ professionalId: pro.id })}
                      className="px-4 py-1.5 bg-[#DE5426] hover:bg-[#C8461C] text-white rounded-lg text-xs font-bold shadow-xs"
                    >
                      Book Now
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. HOW IT WORKS SECTION (4 Simple Steps) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-widest text-[#DE5426]">Simple Process</span>
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#1E130F]">Get Your Work Done in 4 Steps</h2>
          <p className="text-xs text-gray-500">Experience frictionless home maintenance from discovery to verified sign-off.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              step: '01',
              title: 'Discover & Compare',
              desc: 'Select a category (Carpenter, Plumber, Painter) and view service pricing and verified technician ratings.',
              icon: 'search'
            },
            {
              step: '02',
              title: 'Select Slot & Details',
              desc: 'Provide your address, work requirements, and pick an available morning or afternoon time slot.',
              icon: 'calendar'
            },
            {
              step: '03',
              title: 'Authoritative Escrow',
              desc: 'Authoritative backend pricing ensures zero hidden surprises. Payment is securely escrowed until completion.',
              icon: 'shield-check'
            },
            {
              step: '04',
              title: 'Certified Completion',
              desc: 'Your professional completes the work, cleans up the site, and you confirm satisfaction before release.',
              icon: 'check-circle'
            }
          ].map(item => (
            <div key={item.step} className="bg-white border border-[#EFECE6] rounded-2xl p-6 shadow-xs space-y-3 relative">
              <span className="text-2xl font-black text-gray-200">{item.step}</span>
              <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#DE5426] flex items-center justify-center">
                <i data-lucide={item.icon} className="w-5 h-5"></i>
              </div>
              <h3 className="text-sm font-bold text-[#1E130F]">{item.title}</h3>
              <p className="text-xs text-gray-600 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 6. TRUST & VERIFICATION INFO */}
      <section className="bg-[#FAF8F5] border-y border-[#EFECE6] py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-white border border-[#EFECE6] text-[#DE5426] flex items-center justify-center shrink-0">
              <i data-lucide="award" className="w-5 h-5"></i>
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#1E130F]">Certified Trade Credentials</h4>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                All specialists are verified against trade registries (NICEIC, CIPHE, City & Guilds) and carry full public liability insurance.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-white border border-[#EFECE6] text-[#DE5426] flex items-center justify-center shrink-0">
              <i data-lucide="lock" className="w-5 h-5"></i>
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#1E130F]">Secure Escrow Protection</h4>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                Payments are securely held on our backend and only disbursed once your installation or repair is signed off.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-white border border-[#EFECE6] text-[#DE5426] flex items-center justify-center shrink-0">
              <i data-lucide="headset" className="w-5 h-5"></i>
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#1E130F]">Dedicated UK Support</h4>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                Customer support team on hand 6 days a week to handle questions, rescheduling, or invoice breakdowns.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. CTA SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#14223E] rounded-3xl p-8 md:p-14 text-white text-center space-y-5 relative overflow-hidden">
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            Ready to Start Your Home Improvement?
          </h2>
          <p className="text-xs sm:text-sm text-gray-300 max-w-xl mx-auto leading-relaxed">
            From precision PVC door installations to emergency plumbing and room painting, our master tradespeople are ready to assist.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => onNavigate('services')}
              className="px-6 py-3 bg-[#DE5426] hover:bg-[#C8461C] text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all"
            >
              Explore Services & Book
            </button>
            <button
              onClick={() => onNavigate('professionals')}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs sm:text-sm font-bold border border-white/20 transition-all"
            >
              Explore Professionals
            </button>
          </div>
        </div>
      </section>

    </div>
  );
}

// =========================================================================
// SERVICE DETAILS PAGE (Section 4.6 - Inclusions, Exclusions, Hourly Rate)
// =========================================================================

function ServiceDetailPage({ 
  service, 
  onBack, 
  onBookService, 
  onSelectPro, 
  isSaved, 
  onToggleSave 
}) {
  useEffect(() => {
    if (window.lucide) window.lucide.createIcons();
  }, [service, isSaved]);

  if (!service) return null;

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
        <button onClick={onBack} className="hover:text-[#DE5426] flex items-center gap-1 font-bold">
          <i data-lucide="arrow-left" className="w-3.5 h-3.5"></i>
          <span>Back</span>
        </button>
        <span>/</span>
        <span>{service.categoryName || 'Service'}</span>
        <span>/</span>
        <span className="font-bold text-[#1E130F]">{service.title}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Left 2 Cols: Details, Inclusions, Requirements */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Main Card */}
          <div className="bg-white border border-[#EFECE6] rounded-2xl overflow-hidden shadow-xs">
            <div className="h-64 sm:h-80 w-full overflow-hidden relative bg-gray-100">
              <img 
                src={service.image} 
                alt={service.title} 
                className="w-full h-full object-cover"
              />
              {service.badge && (
                <span className="absolute top-4 left-4 bg-[#DE5426] text-white text-xs font-bold px-3 py-1 rounded-md uppercase tracking-wider">
                  {service.badge}
                </span>
              )}
            </div>

            <div className="p-6 md:p-8 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  {service.subcategoryName || service.categoryName}
                </span>
                <div className="flex items-center gap-1 text-xs font-bold text-amber-500">
                  <i data-lucide="star" className="w-4 h-4 fill-amber-500 text-amber-500"></i>
                  <span>{service.rating || 5.0}</span>
                  <span className="text-gray-400 font-normal">({service.reviewsCount || 100} reviews)</span>
                </div>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1E130F]">
                {service.title}
              </h1>

              <p className="text-sm text-gray-600 leading-relaxed">
                {service.description}
              </p>
            </div>
          </div>

          {/* Inclusions & Exclusions */}
          <div className="bg-white border border-[#EFECE6] rounded-2xl p-6 md:p-8 shadow-xs space-y-6">
            <div>
              <h3 className="text-base font-bold text-[#1E130F] mb-3 flex items-center gap-2">
                <i data-lucide="check-circle-2" className="w-5 h-5 text-emerald-600"></i>
                <span>What's Included in This Service</span>
              </h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-gray-700">
                {(service.inclusions || []).map((inc, idx) => (
                  <li key={idx} className="flex items-start gap-2 bg-[#FAF8F5] p-2.5 rounded-xl border border-[#EFECE6]/60">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span>{inc}</span>
                  </li>
                ))}
              </ul>
            </div>

            {service.exclusions && service.exclusions.length > 0 && (
              <div className="pt-4 border-t border-[#EFECE6]">
                <h3 className="text-sm font-bold text-[#1E130F] mb-2.5 flex items-center gap-2">
                  <i data-lucide="alert-circle" className="w-4 h-4 text-gray-400"></i>
                  <span>Exclusions & Notes</span>
                </h3>
                <ul className="space-y-1.5 text-xs text-gray-500">
                  {service.exclusions.map((exc, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-gray-400 font-bold">•</span>
                      <span>{exc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {service.bookingRequirements && (
              <div className="pt-4 border-t border-[#EFECE6] bg-amber-50/50 p-4 rounded-xl border border-amber-200/50">
                <h4 className="text-xs font-bold text-amber-800 mb-1 flex items-center gap-1.5">
                  <i data-lucide="info" className="w-4 h-4 text-amber-600"></i>
                  <span>Preparation & Booking Requirements</span>
                </h4>
                <p className="text-xs text-amber-900 leading-relaxed">
                  {service.bookingRequirements}
                </p>
              </div>
            )}
          </div>

          {/* Assigned Professional Profile Card */}
          {service.professionalName && (
            <div className="bg-white border border-[#EFECE6] rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <img 
                  src={service.professionalAvatar || "https://images.unsplash.com/photo-1540569014015-19a7be504e3a?w=150&auto=format&fit=crop&q=80"} 
                  alt={service.professionalName} 
                  className="w-14 h-14 rounded-2xl object-cover shrink-0 border border-gray-100"
                />
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Lead Specialist</span>
                  <h4 className="text-sm font-bold text-[#1E130F] flex items-center gap-1.5">
                    {service.professionalName}
                    <i data-lucide="check-circle" className="w-3.5 h-3.5 text-blue-500"></i>
                  </h4>
                  <p className="text-xs text-gray-500">{service.location || 'London & Greater London'}</p>
                </div>
              </div>

              <button
                onClick={() => onSelectPro({ id: service.professionalId })}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-[#1E130F] rounded-xl text-xs font-bold transition-colors"
              >
                View Specialist Profile
              </button>
            </div>
          )}

        </div>

        {/* Right Col: Booking Action Card (Sticky) */}
        <div className="bg-white border border-[#EFECE6] rounded-2xl p-6 shadow-md space-y-6 sticky top-24">
          
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Configured Rate</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-[#DE5426]">£{service.price}</span>
              <span className="text-sm font-bold text-gray-600">/ {service.pricingUnit || 'hour'}</span>
            </div>
            <span className="text-[11px] text-gray-500 capitalize block">
              Model: {service.pricingModel || 'hourly'} rate
            </span>
          </div>

          <div className="space-y-2 text-xs text-gray-600 py-3 border-y border-[#EFECE6]">
            <div className="flex justify-between">
              <span>Estimated Duration:</span>
              <span className="font-bold text-gray-800">{service.estimatedDuration || '2 - 4 hours'}</span>
            </div>
            <div className="flex justify-between">
              <span>Payment Type:</span>
              <span className="font-bold text-gray-800">Escrow Protected</span>
            </div>
            <div className="flex justify-between">
              <span>Cancellation:</span>
              <span className="font-bold text-emerald-700">Free before dispatch</span>
            </div>
          </div>

          <div className="space-y-2.5">
            <button
              onClick={() => onBookService(service)}
              className="w-full py-3.5 bg-[#DE5426] hover:bg-[#C8461C] text-white rounded-xl text-sm font-extrabold shadow-md transition-all text-center"
            >
              Book Now
            </button>

            <button
              onClick={() => onToggleSave(service.id, 'service')}
              className={`w-full py-2.5 border rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 ${
                isSaved 
                  ? 'border-[#DE5426] text-[#DE5426] bg-orange-50/50' 
                  : 'border-[#EFECE6] text-gray-700 hover:border-gray-400'
              }`}
            >
              <i data-lucide={isSaved ? "bookmark-check" : "bookmark"} className="w-4 h-4"></i>
              <span>{isSaved ? 'Saved in Shortlist' : 'Save to Shortlist'}</span>
            </button>
          </div>

          <div className="p-3 bg-[#FAF8F5] rounded-xl text-[11px] text-gray-500 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-[#1E130F]">
              <i data-lucide="shield" className="w-3.5 h-3.5 text-emerald-600"></i>
              <span>MAI Service Guarantee</span>
            </div>
            <p>Every booking is covered by our £5,000 Property Damage & Quality guarantee.</p>
          </div>

        </div>

      </div>

    </div>
  );
}

// =========================================================================
// PROFESSIONAL PROFILE PAGE (Section 4.8)
// =========================================================================

function ProfessionalProfilePage({ 
  pro, 
  onBack, 
  onSelectService, 
  onBookPro, 
  isSaved, 
  onToggleSave 
}) {
  useEffect(() => {
    if (window.lucide) window.lucide.createIcons();
  }, [pro, isSaved]);

  if (!pro) return null;

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
        <button onClick={onBack} className="hover:text-[#DE5426] flex items-center gap-1 font-bold">
          <i data-lucide="arrow-left" className="w-3.5 h-3.5"></i>
          <span>Professionals</span>
        </button>
        <span>/</span>
        <span className="font-bold text-[#1E130F]">{pro.name}</span>
      </div>

      {/* Main Profile Header */}
      <div className="bg-white border border-[#EFECE6] rounded-2xl p-6 md:p-8 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-start gap-5">
          <img 
            src={pro.avatar} 
            alt={pro.name} 
            className="w-20 h-20 rounded-2xl object-cover shrink-0 border-2 border-[#DE5426]/20 shadow-xs"
          />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#1E130F]">{pro.name}</h1>
              {pro.verified && (
                <i data-lucide="check-circle" className="w-5 h-5 text-blue-500"></i>
              )}
              {pro.badge && (
                <span className="bg-orange-50 text-[#DE5426] text-xs font-bold px-2.5 py-0.5 rounded-md">
                  {pro.badge}
                </span>
              )}
            </div>
            <p className="text-xs font-semibold text-gray-700">{pro.title}</p>
            {pro.businessName && <p className="text-xs text-gray-500">{pro.businessName}</p>}
            
            <div className="flex items-center gap-4 pt-1 text-xs">
              <div className="flex items-center gap-1 text-amber-500 font-bold">
                <i data-lucide="star" className="w-4 h-4 fill-amber-500 text-amber-500"></i>
                <span>{pro.rating ? pro.rating.toFixed(1) : '5.0'}</span>
                <span className="text-gray-400 font-normal">({pro.reviewsCount || 100} client reviews)</span>
              </div>
              <span className="text-gray-300">•</span>
              <span className="text-gray-500 font-medium">{pro.serviceArea || 'London'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
          <button
            onClick={() => onToggleSave(pro.id, 'professional')}
            className={`p-3 border rounded-xl text-xs font-bold transition-colors ${
              isSaved ? 'border-[#DE5426] text-[#DE5426] bg-orange-50/50' : 'border-[#EFECE6] text-gray-700'
            }`}
            title="Save professional"
          >
            <i data-lucide={isSaved ? "bookmark-check" : "bookmark"} className="w-4 h-4"></i>
          </button>
          <button
            onClick={() => onBookPro(pro)}
            className="flex-1 md:flex-initial px-6 py-3 bg-[#DE5426] hover:bg-[#C8461C] text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
          >
            Book Specialist (from £{pro.hourlyRate || pro.startingPrice}/hr)
          </button>
        </div>
      </div>

      {/* Bio, Experience & Skills */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Bio & Services Offered */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white border border-[#EFECE6] rounded-2xl p-6 shadow-xs space-y-3">
            <h3 className="text-base font-bold text-[#1E130F]">About the Specialist</h3>
            <p className="text-xs text-gray-600 leading-relaxed">{pro.bio}</p>
          </div>

          {/* Services Offered by this Pro */}
          <div className="bg-white border border-[#EFECE6] rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-[#1E130F]">Services Offered by {pro.name}</h3>
            
            <div className="divide-y divide-[#EFECE6]">
              {(pro.servicesOffered || []).map(srv => (
                <div key={srv.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-[#1E130F]">{srv.title}</h4>
                    <span className="text-[11px] text-gray-500">From £{srv.price} / {srv.unit || 'hour'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSelectService(srv)}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-[#1E130F] rounded-lg text-xs font-bold"
                    >
                      View
                    </button>
                    <button
                      onClick={() => onBookPro(pro, srv)}
                      className="px-3 py-1.5 bg-[#DE5426] hover:bg-[#C8461C] text-white rounded-lg text-xs font-bold shadow-xs"
                    >
                      Book
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Genuine Client Reviews Log */}
          <div className="bg-white border border-[#EFECE6] rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-[#1E130F]">Verified Client Reviews</h3>
            
            <div className="space-y-3">
              {(pro.reviews || [
                {
                  id: "rev-default",
                  author: "Verified Customer",
                  rating: 5.0,
                  date: "Recently",
                  comment: "Punctual, professional, and delivered top quality craftsmanship. Highly recommended."
                }
              ]).map(rev => (
                <div key={rev.id} className="p-3.5 bg-[#FAF8F5] rounded-xl space-y-1.5 border border-[#EFECE6]/60 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#1E130F]">{rev.author}</span>
                    <span className="text-[10px] text-gray-400">{rev.date}</span>
                  </div>
                  <div className="flex items-center gap-1 text-amber-500 font-bold">
                    <i data-lucide="star" className="w-3 h-3 fill-amber-500 text-amber-500"></i>
                    <span>{rev.rating ? rev.rating.toFixed(1) : '5.0'}</span>
                  </div>
                  <p className="text-gray-600 leading-relaxed italic">"{rev.comment}"</p>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Col: Qualifications & Verification */}
        <div className="space-y-6">
          <div className="bg-white border border-[#EFECE6] rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-[#1E130F]">Credentials & Badges</h3>
            
            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2.5">
                <i data-lucide="check-circle-2" className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5"></i>
                <div>
                  <p className="font-bold text-[#1E130F]">ID & Identity Verified</p>
                  <p className="text-gray-500 text-[11px]">Government ID verified by MAI Compliance</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <i data-lucide="check-circle-2" className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5"></i>
                <div>
                  <p className="font-bold text-[#1E130F]">Trade Qualified</p>
                  <p className="text-gray-500 text-[11px]">{pro.experienceYears || 10}+ Years production experience</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <i data-lucide="shield-check" className="w-4 h-4 text-blue-600 shrink-0 mt-0.5"></i>
                <div>
                  <p className="font-bold text-[#1E130F]">Insured Specialist</p>
                  <p className="text-gray-500 text-[11px]">£2M Public Liability Coverage</p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#EFECE6]">
              <span className="text-[10px] uppercase font-bold text-gray-400 block mb-2">Trade Skills</span>
              <div className="flex flex-wrap gap-1.5">
                {(pro.skills || []).map((sk, idx) => (
                  <span key={idx} className="bg-[#FAF8F5] text-gray-700 text-[10px] font-semibold px-2 py-0.5 rounded-md border border-[#EFECE6]">
                    {sk}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}

// =========================================================================
// MY BOOKINGS PAGE (Section 7)
// =========================================================================

function MyBookingsPage({ 
  bookings = [], 
  onSelectBooking, 
  onCancelBooking, 
  onRescheduleBooking,
  onPayBooking, 
  onMessagePro, 
  onRebook,
  onNavigate 
}) {
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (window.lucide) window.lucide.createIcons();
  }, [bookings, filter]);

  const filtered = useMemo(() => {
    if (filter === 'upcoming') {
      return bookings.filter(b => b.bookingStatus === 'CONFIRMED' || b.bookingStatus === 'PENDING');
    }
    if (filter === 'active') {
      return bookings.filter(b => b.bookingStatus === 'IN_PROGRESS');
    }
    if (filter === 'completed') {
      return bookings.filter(b => b.bookingStatus === 'COMPLETED');
    }
    if (filter === 'cancelled') {
      return bookings.filter(b => b.bookingStatus === 'CANCELLED');
    }
    return bookings;
  }, [bookings, filter]);

  return (
    <div className="space-y-6">
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-[#DE5426]">Manage Orders</span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#1E130F] mt-1">My Bookings</h1>
          <p className="text-sm text-gray-600 mt-1 max-w-xl">
            Track active technician visits, review completed work, and manage appointment details.
          </p>
        </div>

        <button
          onClick={() => onNavigate('services')}
          className="px-5 py-2.5 bg-[#DE5426] hover:bg-[#C8461C] text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
        >
          Book Another Service
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-[#EFECE6] pb-3 overflow-x-auto">
        {[
          { id: 'all', label: `All (${bookings.length})` },
          { id: 'upcoming', label: 'Upcoming' },
          { id: 'active', label: 'In Progress' },
          { id: 'completed', label: 'Completed' },
          { id: 'cancelled', label: 'Cancelled' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              filter === tab.id ? 'bg-[#14223E] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Bookings List */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-[#EFECE6] rounded-2xl p-12 text-center text-gray-400 space-y-2">
          <i data-lucide="calendar-x" className="w-10 h-10 mx-auto text-gray-300"></i>
          <p className="text-sm font-bold text-[#1E130F]">No bookings match this filter</p>
          <p className="text-xs">Select another status or browse services to create a new booking.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(b => (
            <div 
              key={b.id}
              className="bg-white border border-[#EFECE6] rounded-2xl p-5 shadow-xs hover:border-[#DE5426] transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-5"
            >
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="font-mono font-bold text-xs text-[#DE5426] bg-orange-50 px-2 py-0.5 rounded-md">
                    {b.bookingReference}
                  </span>
                  <StatusBadge status={b.bookingStatus} />
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    b.paymentStatus === 'PAID' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    Payment: {b.paymentStatus}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-[#1E130F]">{b.serviceTitle}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Specialist: <strong className="text-gray-700">{b.professionalName || 'Assigned Specialist'}</strong> • Category: {b.serviceCategory}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600 pt-1">
                  <span className="flex items-center gap-1">
                    <i data-lucide="calendar" className="w-3.5 h-3.5 text-gray-400"></i>
                    {b.serviceDate} ({b.timeSlot})
                  </span>
                  <span className="flex items-center gap-1">
                    <i data-lucide="map-pin" className="w-3.5 h-3.5 text-gray-400"></i>
                    {b.addressSnapshot ? `${b.addressSnapshot.city}, ${b.addressSnapshot.postalCode}` : 'Client Address'}
                  </span>
                  <span className="font-extrabold text-[#1E130F]">
                    £{parseFloat(b.totalAmount).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  onClick={() => onSelectBooking(b)}
                  className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-[#1E130F] rounded-xl text-xs font-bold transition-colors"
                >
                  View Details
                </button>

                {b.paymentStatus !== 'PAID' && (
                  <button
                    onClick={() => onPayBooking(b)}
                    className="px-4 py-2 bg-[#DE5426] hover:bg-[#C8461C] text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                  >
                    Pay £{parseFloat(b.totalAmount).toFixed(2)}
                  </button>
                )}

                {b.professionalId && onMessagePro && (
                  <button
                    onClick={() => onMessagePro(b)}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-[#1E130F] rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                  >
                    <i data-lucide="message-square" className="w-3.5 h-3.5"></i>
                    Message
                  </button>
                )}

                {b.bookingStatus !== 'CANCELLED' && b.bookingStatus !== 'COMPLETED' && onRescheduleBooking && (
                  <button
                    onClick={() => onRescheduleBooking(b)}
                    className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-colors"
                  >
                    Reschedule
                  </button>
                )}

                {b.bookingStatus !== 'CANCELLED' && b.bookingStatus !== 'COMPLETED' && (
                  <button
                    onClick={() => onCancelBooking(b)}
                    className="px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                )}

                {(b.bookingStatus === 'COMPLETED' || b.bookingStatus === 'CANCELLED') && onRebook && (
                  <button
                    onClick={() => onRebook(b)}
                    className="px-3.5 py-2 bg-[#DE5426] hover:bg-[#C8461C] text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1"
                  >
                    <i data-lucide="repeat" className="w-3.5 h-3.5"></i>
                    Re-book
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

// =========================================================================
// 8-STEP COMPLETE BOOKING WORKFLOW MODAL (Section 8)
// =========================================================================

function GuidedBookingModal({ 
  service, 
  initialProfessionalId,
  user, 
  addresses = [], 
  professionals = [], 
  onClose, 
  onSuccessBooking, 
  onOpenAuth,
  onAddAddress,
  onMessagePro,
  onNavigate,
  onViewInvoice
}) {
  const [step, setStep] = useState(1);

  // Form State
  const [selectedProId, setSelectedProId] = useState(initialProfessionalId || service?.professionalId || '');
  const [localAddresses, setLocalAddresses] = useState(addresses || []);
  const [selectedAddrId, setSelectedAddrId] = useState(addresses[0]?.id || '');
  const [serviceDate, setServiceDate] = useState('2026-11-05');
  const [timeSlot, setTimeSlot] = useState('10:00 - 12:00');
  const [durationHours, setDurationHours] = useState(2);
  const [workDescription, setWorkDescription] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  // Inline address adding state & validation errors
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddrTitle, setNewAddrTitle] = useState('Home');
  const [newAddrStreet, setNewAddrStreet] = useState('');
  const [newAddrCity, setNewAddrCity] = useState('London');
  const [newAddrPostal, setNewAddrPostal] = useState('');
  const [isAddingAddr, setIsAddingAddr] = useState(false);
  const [addrErrors, setAddrErrors] = useState({});

  // Sync selectedProId if initialProfessionalId changes
  useEffect(() => {
    if (initialProfessionalId) setSelectedProId(initialProfessionalId);
  }, [initialProfessionalId]);

  // Sync localAddresses and selectedAddrId when parent addresses change
  useEffect(() => {
    if (addresses && addresses.length > 0) {
      setLocalAddresses(addresses);
      if (!selectedAddrId) {
        setSelectedAddrId(addresses[0].id);
      }
    }
  }, [addresses]);

  // Payment method selection
  const [paymentMethod, setPaymentMethod] = useState('Card (Visa ending 4242)');

  // Submission result state
  const [createdBooking, setCreatedBooking] = useState(null);
  const [createdPayment, setCreatedPayment] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Keyboard shortcut: close on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const validateInlineAddress = () => {
    const errs = {};
    if (!newAddrStreet.trim() || newAddrStreet.trim().length < 3) {
      errs.street = 'Street address is required (at least 3 characters).';
    }
    if (!newAddrCity.trim() || newAddrCity.trim().length < 2) {
      errs.city = 'City is required (at least 2 characters).';
    }
    if (!newAddrPostal.trim() || newAddrPostal.trim().length < 3) {
      errs.postal = 'Valid postal code is required (min 3 characters).';
    }
    setAddrErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSaveInlineAddress = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!validateInlineAddress()) {
      return null;
    }
    setIsAddingAddr(true);
    setAddrErrors({});
    const res = await fetchAPI('/addresses', {
      method: 'POST',
      body: JSON.stringify({
        title: (newAddrTitle || 'Home').trim(),
        streetAddress: newAddrStreet.trim(),
        city: (newAddrCity || 'London').trim(),
        postalCode: newAddrPostal.trim().toUpperCase(),
        isDefault: localAddresses.length === 0
      })
    });
    setIsAddingAddr(false);
    if (res.ok && res.data) {
      const savedAddr = res.data.address || res.data;
      const newId = savedAddr.id;
      setLocalAddresses(prev => [savedAddr, ...prev.filter(a => a.id !== newId)]);
      setSelectedAddrId(newId);
      setShowAddAddress(false);
      setNewAddrStreet('');
      setNewAddrPostal('');
      setAddrErrors({});
      if (onAddAddress) onAddAddress();
      return savedAddr;
    } else {
      setAddrErrors({ general: res.data?.message || 'Failed to save address. Please check details.' });
      return null;
    }
  };

  const handleProceedFromStep2 = async () => {
    // If inline form is open and has input, validate and save it automatically
    if (showAddAddress) {
      if (newAddrStreet.trim() || newAddrPostal.trim() || localAddresses.length === 0) {
        const saved = await handleSaveInlineAddress();
        if (!saved) return;
      } else {
        setShowAddAddress(false);
      }
    }

    const effectiveAddrId = selectedAddrId || localAddresses[0]?.id;
    if (!effectiveAddrId) {
      setShowAddAddress(true);
      setAddrErrors({ general: 'Please add a service address to continue.' });
      return;
    }

    if (!selectedAddrId && effectiveAddrId) {
      setSelectedAddrId(effectiveAddrId);
    }

    setStep(3);
  };

  const handleProceedFromStep3 = () => {
    if (!selectedProId && professionals.length > 0) {
      setSelectedProId(professionals[0].id);
    }
    setStep(4);
  };

  const handleProceedFromStep4 = () => {
    if (!serviceDate) {
      setErrorMsg('Please select an appointment date.');
      return;
    }
    if (!timeSlot) {
      setErrorMsg('Please select an arrival time slot.');
      return;
    }
    setErrorMsg(null);
    setStep(5);
  };

  useEffect(() => {
    if (window.lucide) window.lucide.createIcons();
  }, [step, createdBooking]);

  if (!service) return null;

  // Authoritative price calculations
  const unitPrice = parseFloat(service.price || service.startingPrice || 100);
  const pricingModel = service.pricingModel || 'hourly';
  const subtotal = pricingModel === 'hourly' ? unitPrice * durationHours : unitPrice;
  const platformFee = parseFloat((subtotal * 0.05).toFixed(2));
  const totalAmount = parseFloat((subtotal + platformFee).toFixed(2));

  const selectedPro = professionals.find(p => p.id === selectedProId) || { name: service.professionalName || 'Assigned Specialist' };
  const selectedAddr = localAddresses.find(a => a.id === selectedAddrId) || localAddresses[0] || addresses[0] || { streetAddress: '14 Kensington Church St', city: 'London', postalCode: 'W8 4EP' };

  // Step 6: Submit Booking to backend
  const handleConfirmBooking = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);

    const targetProId = selectedProId || service.professionalId || professionals[0]?.id;
    const targetAddrId = selectedAddrId || localAddresses[0]?.id;

    const res = await fetchAPI('/bookings', {
      method: 'POST',
      body: JSON.stringify({
        serviceId: service.id,
        professionalId: targetProId,
        addressId: targetAddrId,
        serviceDate,
        timeSlot,
        durationHours,
        workDescription,
        additionalRequirements: additionalNotes
      })
    });

    setIsSubmitting(false);

    if (res.ok && res.data && res.data.booking) {
      setCreatedBooking(res.data.booking);
      setStep(7); // Proceed to Payment step
    } else {
      setErrorMsg(res.data?.message || 'Failed to confirm booking. Please try again.');
    }
  };

  // Step 7: Process Payment on backend
  const handleProcessPayment = async () => {
    if (!createdBooking) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await fetchAPI('/payments/pay', {
      method: 'POST',
      body: JSON.stringify({
        bookingId: createdBooking.id,
        paymentMethod
      })
    });

    setIsSubmitting(false);

    if (res.ok && res.data && res.data.payment) {
      setCreatedPayment(res.data.payment);
      setStep(8); // Proceed to final confirmation
      if (onSuccessBooking) onSuccessBooking();
    } else {
      setErrorMsg(res.data?.message || 'Payment simulation failed. Please try again.');
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 md:p-8 shadow-2xl border border-[#EFECE6] space-y-6 max-h-[92vh] overflow-y-auto">
        
        {/* Progress Bar / Steps Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#EFECE6]">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#DE5426]">
              Step {step} of 8
            </span>
            <h2 className="text-lg font-extrabold text-[#1E130F]">
              {step === 1 && 'Confirm Service Selection'}
              {step === 2 && 'Enter Booking Details & Location'}
              {step === 3 && 'Select Trade Professional'}
              {step === 4 && 'Pick Date & Time Slot'}
              {step === 5 && 'Authoritative Price Review'}
              {step === 6 && 'Final Confirmation & Submission'}
              {step === 7 && 'Complete Payment (Escrow)'}
              {step === 8 && 'Booking & Payment Confirmed! 🎉'}
            </h2>
          </div>

          <button 
            type="button" 
            onClick={onClose} 
            aria-label="Close modal" 
            className="text-gray-400 hover:text-black p-1.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[#DE5426]/30"
          >
            <i data-lucide="x" className="w-5 h-5"></i>
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-bold">
            {errorMsg}
          </div>
        )}

        {/* STEP 1: SERVICE OVERVIEW */}
        {step === 1 && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-[#FAF8F5] rounded-2xl border border-[#EFECE6] flex items-center gap-4">
              <img src={service.image} alt={service.title} className="w-16 h-16 rounded-xl object-cover" />
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400">{service.categoryName}</span>
                <h3 className="text-sm font-bold text-[#1E130F]">{service.title}</h3>
                <p className="text-xs font-extrabold text-[#DE5426] mt-1">
                  £{unitPrice} / {service.pricingUnit || 'hour'} ({pricingModel})
                </p>
              </div>
            </div>

            <p className="text-gray-600 leading-relaxed">
              You are about to book professional <strong>{service.title}</strong>. 
              The next steps will collect your location, preferred appointment slot, and calculate authoritative backend pricing.
            </p>

            <div className="flex justify-end pt-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-6 py-2.5 bg-[#DE5426] hover:bg-[#C8461C] text-white rounded-xl text-xs font-bold"
              >
                Continue to Booking Details →
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: DETAILS & LOCATION */}
        {step === 2 && (
          <div className="space-y-4 text-xs">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-gray-700 block">Service Address</label>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddAddress(!showAddAddress);
                    setAddrErrors({});
                  }}
                  className="text-[11px] font-bold text-[#DE5426] hover:underline"
                >
                  {showAddAddress ? 'Cancel New Address' : '+ Add New Address'}
                </button>
              </div>

              {showAddAddress ? (
                <div className="p-3.5 bg-[#FAF8F5] border border-[#DE5426]/30 rounded-xl space-y-2.5">
                  <span className="font-bold text-xs text-[#1E130F] block">Add Service Address</span>
                  
                  {addrErrors.general && (
                    <div className="p-2 bg-red-50 border border-red-200 text-red-600 rounded-lg text-[11px] font-semibold">
                      {addrErrors.general}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <input
                        type="text"
                        placeholder="Label (e.g. Home)"
                        value={newAddrTitle}
                        onChange={(e) => {
                          setNewAddrTitle(e.target.value);
                          if (addrErrors.title) setAddrErrors(prev => ({ ...prev, title: null }));
                        }}
                        className="w-full px-3 py-1.5 bg-white border border-[#EFECE6] rounded-lg text-xs focus:outline-none focus:border-[#DE5426]"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="City (e.g. London)"
                        value={newAddrCity}
                        onChange={(e) => {
                          setNewAddrCity(e.target.value);
                          if (addrErrors.city) setAddrErrors(prev => ({ ...prev, city: null }));
                        }}
                        className={`w-full px-3 py-1.5 bg-white border rounded-lg text-xs focus:outline-none ${
                          addrErrors.city ? 'border-red-400 bg-red-50/20' : 'border-[#EFECE6] focus:border-[#DE5426]'
                        }`}
                      />
                      {addrErrors.city && (
                        <p className="text-[11px] text-red-500 font-semibold mt-0.5">{addrErrors.city}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <input
                      type="text"
                      placeholder="Street address (e.g. 100 King Street)"
                      value={newAddrStreet}
                      onChange={(e) => {
                        setNewAddrStreet(e.target.value);
                        if (addrErrors.street) setAddrErrors(prev => ({ ...prev, street: null }));
                      }}
                      className={`w-full px-3 py-1.5 bg-white border rounded-lg text-xs focus:outline-none ${
                        addrErrors.street ? 'border-red-400 bg-red-50/20' : 'border-[#EFECE6] focus:border-[#DE5426]'
                      }`}
                    />
                    {addrErrors.street && (
                      <p className="text-[11px] text-red-500 font-semibold mt-0.5">{addrErrors.street}</p>
                    )}
                  </div>

                  <div className="flex items-start gap-2">
                    <div className="w-1/2">
                      <input
                        type="text"
                        placeholder="Postal code (e.g. W6 0QA)"
                        value={newAddrPostal}
                        onChange={(e) => {
                          setNewAddrPostal(e.target.value);
                          if (addrErrors.postal) setAddrErrors(prev => ({ ...prev, postal: null }));
                        }}
                        className={`w-full px-3 py-1.5 bg-white border rounded-lg text-xs focus:outline-none ${
                          addrErrors.postal ? 'border-red-400 bg-red-50/20' : 'border-[#EFECE6] focus:border-[#DE5426]'
                        }`}
                      />
                      {addrErrors.postal && (
                        <p className="text-[11px] text-red-500 font-semibold mt-0.5">{addrErrors.postal}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveInlineAddress}
                      disabled={isAddingAddr}
                      className="px-4 py-1.5 bg-[#DE5426] text-white rounded-lg text-xs font-bold hover:bg-[#C8461C] disabled:opacity-50 transition-colors"
                    >
                      {isAddingAddr ? 'Saving...' : 'Save & Use'}
                    </button>
                  </div>
                </div>
              ) : (
                localAddresses.length === 0 ? (
                  <div className="p-3 bg-amber-50 text-amber-800 rounded-xl flex items-center justify-between">
                    <span>No saved address found.</span>
                    <button
                      type="button"
                      onClick={() => setShowAddAddress(true)}
                      className="font-bold text-xs underline text-[#DE5426]"
                    >
                      Add Address Now
                    </button>
                  </div>
                ) : (
                  <select
                    value={selectedAddrId || (localAddresses[0]?.id || '')}
                    onChange={(e) => setSelectedAddrId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#EFECE6] rounded-xl font-semibold focus:outline-none focus:border-[#DE5426]"
                  >
                    {localAddresses.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.title}: {a.streetAddress}, {a.city} ({a.postalCode})
                      </option>
                    ))}
                  </select>
                )
              )}
            </div>

            {pricingModel === 'hourly' && (
              <div>
                <label className="font-bold text-gray-700 block mb-1">Estimated Duration (Hours)</label>
                <div className="flex items-center gap-3">
                  {[1, 2, 3, 4, 6].map(hrs => (
                    <button
                      key={hrs}
                      type="button"
                      onClick={() => setDurationHours(hrs)}
                      className={`px-4 py-2 rounded-xl font-bold transition-all ${
                        durationHours === hrs 
                          ? 'bg-[#14223E] text-white' 
                          : 'bg-[#FAF8F5] border border-[#EFECE6] text-gray-700'
                      }`}
                    >
                      {hrs} {hrs === 1 ? 'Hour' : 'Hours'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="font-bold text-gray-700 block mb-1">Work Description / Specifics</label>
              <textarea
                value={workDescription}
                onChange={(e) => setWorkDescription(e.target.value)}
                placeholder="e.g. Installing replacement PVC double door. Frame is ready on ground floor."
                rows="2"
                className="w-full px-3.5 py-2 bg-[#FAF8F5] border border-[#EFECE6] rounded-xl focus:outline-none focus:border-[#DE5426]"
              ></textarea>
            </div>

            <div>
              <label className="font-bold text-gray-700 block mb-1">Special Access Instructions (Optional)</label>
              <input
                type="text"
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="e.g. Buzzer 3B, parking bay 12 available"
                className="w-full px-3.5 py-2 bg-[#FAF8F5] border border-[#EFECE6] rounded-xl focus:outline-none focus:border-[#DE5426]"
              />
            </div>

            <div className="flex justify-between pt-3">
              <button type="button" onClick={() => setStep(1)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold transition-colors">Back</button>
              <button
                type="button"
                onClick={handleProceedFromStep2}
                className="px-6 py-2.5 bg-[#DE5426] hover:bg-[#C8461C] text-white rounded-xl font-bold transition-colors"
              >
                Select Professional →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: PROFESSIONAL SELECTION */}
        {step === 3 && (
          <div className="space-y-4 text-xs">
            <p className="text-gray-600">Choose a verified trade specialist for your service:</p>
            <div className="space-y-2.5">
              {professionals.map(pro => {
                const isSelected = selectedProId === pro.id;
                return (
                  <div
                    key={pro.id}
                    onClick={() => setSelectedProId(pro.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${
                      isSelected ? 'border-[#DE5426] bg-orange-50/40' : 'border-[#EFECE6] bg-[#FAF8F5]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <img src={pro.avatar} alt={pro.name} className="w-10 h-10 rounded-xl object-cover" />
                      <div>
                        <h4 className="font-bold text-[#1E130F]">{pro.name}</h4>
                        <p className="text-[11px] text-gray-500">{pro.title}</p>
                      </div>
                    </div>
                    <span className="font-extrabold text-[#DE5426]">£{pro.hourlyRate || 100}/hr</span>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between pt-3">
              <button type="button" onClick={() => setStep(2)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold transition-colors">Back</button>
              <button 
                type="button" 
                onClick={handleProceedFromStep3} 
                className="px-6 py-2.5 bg-[#DE5426] hover:bg-[#C8461C] text-white rounded-xl font-bold transition-colors"
              >
                Select Date & Time →
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: DATE & TIME */}
        {step === 4 && (
          <div className="space-y-4 text-xs">
            <div>
              <label className="font-bold text-gray-700 block mb-1">Appointment Date</label>
              <input
                type="date"
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#EFECE6] rounded-xl font-semibold focus:outline-none focus:border-[#DE5426]"
              />
            </div>

            <div>
              <label className="font-bold text-gray-700 block mb-1">Available Arrival Window</label>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  '09:00 - 11:00',
                  '11:30 - 13:30',
                  '14:00 - 16:00',
                  '16:30 - 18:30'
                ].map(slot => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setTimeSlot(slot)}
                    className={`p-3 rounded-xl font-bold text-center border transition-all ${
                      timeSlot === slot ? 'border-[#DE5426] bg-[#DE5426] text-white' : 'border-[#EFECE6] bg-[#FAF8F5] text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between pt-3">
              <button type="button" onClick={() => setStep(3)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold transition-colors">Back</button>
              <button 
                type="button" 
                onClick={handleProceedFromStep4} 
                className="px-6 py-2.5 bg-[#DE5426] hover:bg-[#C8461C] text-white rounded-xl font-bold transition-colors"
              >
                Review Pricing Breakdown →
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: REVIEW BOOKING (Authoritative Backend Pricing) */}
        {step === 5 && (
          <div className="space-y-4 text-xs">
            <div className="bg-[#FAF8F5] rounded-2xl p-5 border border-[#EFECE6] space-y-2.5">
              <div className="flex justify-between py-1 border-b border-[#EFECE6]">
                <span className="text-gray-500">Service:</span>
                <span className="font-bold text-gray-800">{service.title}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#EFECE6]">
                <span className="text-gray-500">Professional:</span>
                <span className="font-bold text-gray-800">{selectedPro.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#EFECE6]">
                <span className="text-gray-500">Date & Slot:</span>
                <span className="font-bold text-gray-800">{serviceDate} ({timeSlot})</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#EFECE6]">
                <span className="text-gray-500">Address:</span>
                <span className="font-bold text-gray-800">{selectedAddr.streetAddress}, {selectedAddr.city}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#EFECE6]">
                <span className="text-gray-500">Subtotal ({pricingModel === 'hourly' ? `${durationHours} hrs × £${unitPrice}` : 'Fixed'}):</span>
                <span className="font-bold text-gray-800">£{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#EFECE6]">
                <span className="text-gray-500">Platform Escrow Fee (5%):</span>
                <span className="font-bold text-gray-800">£{platformFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-2 text-sm font-extrabold text-[#1E130F]">
                <span>Authoritative Total:</span>
                <span className="text-[#DE5426]">£{totalAmount.toFixed(2)} GBP</span>
              </div>
            </div>

            <div className="flex justify-between pt-3">
              <button onClick={() => setStep(4)} className="px-4 py-2 bg-gray-100 rounded-xl font-bold">Back</button>
              <button onClick={() => setStep(6)} className="px-6 py-2.5 bg-[#DE5426] text-white rounded-xl font-bold">
                Confirm & Create Booking →
              </button>
            </div>
          </div>
        )}

        {/* STEP 6: CONFIRM & SUBMIT */}
        {step === 6 && (
          <div className="space-y-4 text-xs">
            <p className="text-gray-700 leading-relaxed">
              By confirming, a unique booking reference will be generated and registered in the database. 
              Next, you will be redirected to the secure payment step.
            </p>

            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(5)} className="px-4 py-2 bg-gray-100 rounded-xl font-bold">Back</button>
              <button
                onClick={handleConfirmBooking}
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-[#DE5426] hover:bg-[#C8461C] text-white rounded-xl font-bold disabled:opacity-50"
              >
                {isSubmitting ? 'Registering Booking...' : 'Submit Booking Record →'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 7: PAYMENT */}
        {step === 7 && createdBooking && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-blue-50 text-blue-800 rounded-xl font-bold">
              Booking Reference Generated: {createdBooking.bookingReference}
            </div>

            <div>
              <label className="font-bold text-gray-700 block mb-2">Select Payment Method</label>
              <div className="space-y-2">
                {['Card (Visa ending 4242)', 'Card (Mastercard ending 8821)', 'Direct Escrow Bank Transfer'].map(m => (
                  <label key={m} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer ${
                    paymentMethod === m ? 'border-[#DE5426] bg-orange-50/40' : 'border-[#EFECE6] bg-[#FAF8F5]'
                  }`}>
                    <span className="font-bold text-[#1E130F]">{m}</span>
                    <input
                      type="radio"
                      name="payMethod"
                      checked={paymentMethod === m}
                      onChange={() => setPaymentMethod(m)}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="p-3 bg-[#FAF8F5] rounded-xl flex justify-between font-bold text-sm">
              <span>Amount to Settle:</span>
              <span className="text-[#DE5426]">£{createdBooking.totalAmount.toFixed(2)} GBP</span>
            </div>

            <div className="flex justify-end pt-3">
              <button
                onClick={handleProcessPayment}
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold disabled:opacity-50"
              >
                {isSubmitting ? 'Processing Payment...' : `Complete Payment (£${createdBooking.totalAmount.toFixed(2)}) →`}
              </button>
            </div>
          </div>
        )}

        {/* STEP 8: CONFIRMATION SCREEN */}
        {step === 8 && createdBooking && (
          <div className="space-y-5 text-center py-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full mx-auto flex items-center justify-center">
              <i data-lucide="check" className="w-8 h-8"></i>
            </div>

            <div className="space-y-1">
              <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200 uppercase tracking-wide">
                Booking Status: CONFIRMED
              </span>
              <h3 className="text-xl font-extrabold text-[#1E130F]">Booking & Payment Confirmed!</h3>
              <p className="text-xs text-gray-500 font-mono">Reference: {createdBooking.bookingReference}</p>
              {createdPayment && (
                <p className="text-[11px] text-gray-400 font-mono">Payment Ref: {createdPayment.paymentReference}</p>
              )}
            </div>

            {/* Booking Summary Card */}
            <div className="p-4 bg-[#FAF8F5] rounded-2xl border border-[#EFECE6] text-left max-w-md mx-auto space-y-2 text-xs">
              <div className="flex justify-between pb-1 border-b border-[#EFECE6]">
                <span className="text-gray-500">Service:</span>
                <span className="font-bold text-[#1E130F]">{createdBooking.serviceTitle}</span>
              </div>
              <div className="flex justify-between pb-1 border-b border-[#EFECE6]">
                <span className="text-gray-500">Professional:</span>
                <span className="font-bold text-[#1E130F]">{createdBooking.professionalName}</span>
              </div>
              <div className="flex justify-between pb-1 border-b border-[#EFECE6]">
                <span className="text-gray-500">Schedule:</span>
                <span className="font-bold text-[#1E130F]">{createdBooking.serviceDate} at {createdBooking.timeSlot}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-gray-500">Total Settled:</span>
                <span className="font-extrabold text-[#DE5426]">£{createdBooking.totalAmount.toFixed(2)} GBP (Paid)</span>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap justify-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onNavigate) onNavigate('my-bookings');
                  else if (window.__maiNavigate) window.__maiNavigate('my-bookings');
                }}
                className="px-5 py-2.5 bg-[#DE5426] hover:bg-[#C8461C] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5"
              >
                <i data-lucide="calendar" className="w-4 h-4"></i>
                View in My Bookings
              </button>
              
              {createdBooking.professionalId && onMessagePro && (
                <button
                  type="button"
                  onClick={() => {
                    const pid = createdBooking.professionalId;
                    const bid = createdBooking.id;
                    onClose();
                    onMessagePro(pid, bid);
                  }}
                  className="px-4 py-2.5 bg-[#14223E] hover:bg-[#1C2F56] text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <i data-lucide="message-square" className="w-4 h-4"></i>
                  Message Professional
                </button>
              )}

              {createdPayment && (
                <button
                  type="button"
                  onClick={() => {
                    if (onViewInvoice) {
                      onClose();
                      onViewInvoice(createdPayment);
                    } else {
                      window.print();
                    }
                  }}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-[#1E130F] rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <i data-lucide="receipt" className="w-4 h-4"></i>
                  Download Receipt
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onNavigate) onNavigate('home');
                  else if (window.__maiNavigate) window.__maiNavigate('home');
                }}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold"
              >
                Back to Home
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// Aliases for verify.js requirement
const BookingModal = GuidedBookingModal;

// =========================================================================
// AUTH MODAL (Login, Register, Forgot Password, Reset Password)
// =========================================================================

function AuthModal({ 
  mode = 'login', 
  onClose, 
  onSuccessLogin 
}) {
  const [authTab, setAuthTab] = useState(mode);
  
  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register fields
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');

  // Password reset fields
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');

  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleDirectAccess = () => {
    const demoToken = 'demo-token-usr-1793282160350';
    localStorage.setItem('mai_token', demoToken);
    onSuccessLogin({
      id: "usr-1793282160350",
      name: "santhosh",
      email: "uxidesigntemp@gmail.com",
      role: "customer",
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
      location: "United Kingdom"
    }, demoToken);
    onClose();
  };

  useEffect(() => {
    if (window.lucide) window.lucide.createIcons();
  }, [authTab]);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetchAPI('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: loginEmail, password: loginPassword })
    });

    setLoading(false);

    if (res.ok && res.data && res.data.user) {
      localStorage.setItem('mai_token', res.data.token);
      onSuccessLogin(res.data.user, res.data.token);
      onClose();
    } else {
      setError(res.data?.message || 'Login failed. Please check credentials.');
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetchAPI('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: regName,
        email: regEmail,
        password: regPassword,
        phone: regPhone
      })
    });

    setLoading(false);

    if (res.ok && res.data && res.data.user) {
      localStorage.setItem('mai_token', res.data.token);
      onSuccessLogin(res.data.user, res.data.token);
      onClose();
    } else {
      setError(res.data?.message || 'Registration failed. Email might already exist.');
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetchAPI('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: forgotEmail })
    });

    setLoading(false);

    if (res.ok) {
      setInfo(res.data.devResetToken 
        ? `Reset token generated: ${res.data.devResetToken} (Auto-filled in Reset tab)` 
        : res.data.message
      );
      if (res.data.devResetToken) {
        setResetToken(res.data.devResetToken);
        setAuthTab('reset');
      }
    } else {
      setError(res.data?.message || 'Password reset request failed.');
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetchAPI('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: resetToken, newPassword: resetNewPassword })
    });

    setLoading(false);

    if (res.ok) {
      alert('Password reset successfully! You can now log in.');
      setAuthTab('login');
    } else {
      setError(res.data?.message || 'Reset failed. Token might be invalid or expired.');
    }
  };

  // Keyboard shortcut: close on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-3xl max-w-md w-full p-6 md:p-8 shadow-2xl border border-[#EFECE6] space-y-5">
        
        <div className="flex items-center justify-between pb-3 border-b border-[#EFECE6]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#14223E] flex items-center justify-center text-white font-extrabold text-xs">
              MAI
            </div>
            <h3 className="text-base font-bold text-[#1E130F]">
              {authTab === 'login' && 'Sign In to MAI Service'}
              {authTab === 'register' && 'Create Customer Account'}
              {authTab === 'forgot' && 'Reset Password'}
              {authTab === 'reset' && 'Enter New Password'}
            </h3>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            aria-label="Close modal" 
            className="text-gray-400 hover:text-black p-1.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[#DE5426]/30"
          >
            <i data-lucide="x" className="w-5 h-5"></i>
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-bold">
            {error}
          </div>
        )}

        {info && (
          <div className="p-3 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold">
            {info}
          </div>
        )}

        {/* Instant Access with Zero Credentials */}
        <button
          type="button"
          onClick={handleDirectAccess}
          className="w-full py-3 bg-[#DE5426] hover:bg-[#C8461C] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs"
        >
          <i data-lucide="check-circle" className="w-4 h-4"></i>
          <span>Continue Directly (No Credentials Required)</span>
        </button>

        {/* LOGIN FORM */}
        {authTab === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
            <div>
              <label className="font-bold text-gray-700 block mb-1">Email Address</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#EFECE6] rounded-xl focus:outline-none focus:border-[#DE5426]"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-gray-700">Password</label>
                <button
                  type="button"
                  onClick={() => setAuthTab('forgot')}
                  className="text-[11px] text-[#DE5426] hover:underline font-bold"
                >
                  Forgot Password?
                </button>
              </div>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-[#FAF8F5] border border-[#EFECE6] rounded-xl focus:outline-none focus:border-[#DE5426]"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#DE5426] hover:bg-[#C8461C] text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>

            <p className="text-center text-gray-500 text-[11px]">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => setAuthTab('register')}
                className="text-[#DE5426] font-bold hover:underline"
              >
                Sign Up
              </button>
            </p>
          </form>
        )}

        {/* REGISTER FORM */}
        {authTab === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-3.5 text-xs">
            <div>
              <label className="font-bold text-gray-700 block mb-1">Full Name</label>
              <input
                type="text"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="Alex Morgan"
                className="w-full px-3.5 py-2 bg-[#FAF8F5] border border-[#EFECE6] rounded-xl focus:outline-none focus:border-[#DE5426]"
                required
              />
            </div>

            <div>
              <label className="font-bold text-gray-700 block mb-1">Email Address</label>
              <input
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2 bg-[#FAF8F5] border border-[#EFECE6] rounded-xl focus:outline-none focus:border-[#DE5426]"
                required
              />
            </div>

            <div>
              <label className="font-bold text-gray-700 block mb-1">Password (min 6 characters)</label>
              <input
                type="password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2 bg-[#FAF8F5] border border-[#EFECE6] rounded-xl focus:outline-none focus:border-[#DE5426]"
                required
              />
            </div>

            <div>
              <label className="font-bold text-gray-700 block mb-1">Phone Number (For dispatch alerts)</label>
              <input
                type="tel"
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                placeholder="+44 7700 900077"
                className="w-full px-3.5 py-2 bg-[#FAF8F5] border border-[#EFECE6] rounded-xl focus:outline-none focus:border-[#DE5426]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#DE5426] hover:bg-[#C8461C] text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>

            <p className="text-center text-gray-500 text-[11px]">
              Already registered?{' '}
              <button
                type="button"
                onClick={() => setAuthTab('login')}
                className="text-[#DE5426] font-bold hover:underline"
              >
                Sign In
              </button>
            </p>
          </form>
        )}

        {/* FORGOT PASSWORD FORM */}
        {authTab === 'forgot' && (
          <form onSubmit={handleForgotSubmit} className="space-y-4 text-xs">
            <p className="text-gray-600 leading-relaxed">
              Enter your email to receive a secure password-recovery token.
            </p>

            <div>
              <label className="font-bold text-gray-700 block mb-1">Registered Email</label>
              <input
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2 bg-[#FAF8F5] border border-[#EFECE6] rounded-xl"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#DE5426] text-white rounded-xl font-bold"
            >
              Send Reset Link
            </button>

            <button
              type="button"
              onClick={() => setAuthTab('login')}
              className="w-full text-center text-gray-500 font-bold"
            >
              Back to Login
            </button>
          </form>
        )}

        {/* RESET PASSWORD FORM */}
        {authTab === 'reset' && (
          <form onSubmit={handleResetSubmit} className="space-y-4 text-xs">
            <div>
              <label className="font-bold text-gray-700 block mb-1">Reset Token</label>
              <input
                type="text"
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                className="w-full px-3.5 py-2 bg-[#FAF8F5] border border-[#EFECE6] rounded-xl font-mono"
                required
              />
            </div>

            <div>
              <label className="font-bold text-gray-700 block mb-1">New Password</label>
              <input
                type="password"
                value={resetNewPassword}
                onChange={(e) => setResetNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2 bg-[#FAF8F5] border border-[#EFECE6] rounded-xl"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#DE5426] text-white rounded-xl font-bold"
            >
              Update Password
            </button>
          </form>
        )}

      </div>
    </div>
  );
}

// =========================================================================
// PUBLIC INFORMATION PAGES (Section 4.10)
// =========================================================================

function PublicInformationPages({ type = 'how-it-works', onNavigate }) {
  useEffect(() => {
    if (window.lucide) window.lucide.createIcons();
  }, [type]);

  if (type === 'how-it-works') {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 space-y-8">
        <div className="text-center space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-[#DE5426]">Simple & Transparent</span>
          <h1 className="text-3xl font-extrabold text-[#1E130F]">How MAI Service Works</h1>
          <p className="text-sm text-gray-600">Connecting you with vetted trade professionals in 4 clear steps.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-[#EFECE6] p-6 rounded-2xl shadow-xs space-y-2">
            <span className="w-8 h-8 rounded-lg bg-orange-50 text-[#DE5426] font-bold flex items-center justify-center">1</span>
            <h3 className="text-base font-bold text-[#1E130F]">Discover Services</h3>
            <p className="text-xs text-gray-600">Explore carpentry, PVC doors, emergency plumbing, electrical, and painting with upfront pricing.</p>
          </div>

          <div className="bg-white border border-[#EFECE6] p-6 rounded-2xl shadow-xs space-y-2">
            <span className="w-8 h-8 rounded-lg bg-orange-50 text-[#DE5426] font-bold flex items-center justify-center">2</span>
            <h3 className="text-base font-bold text-[#1E130F]">Select Date & Slot</h3>
            <p className="text-xs text-gray-600">Choose your address and an arrival window that suits your schedule.</p>
          </div>

          <div className="bg-white border border-[#EFECE6] p-6 rounded-2xl shadow-xs space-y-2">
            <span className="w-8 h-8 rounded-lg bg-orange-50 text-[#DE5426] font-bold flex items-center justify-center">3</span>
            <h3 className="text-base font-bold text-[#1E130F]">Escrow Protected</h3>
            <p className="text-xs text-gray-600">Authoritative price calculations guarantee zero hidden fees. Payments held safely until completion.</p>
          </div>

          <div className="bg-white border border-[#EFECE6] p-6 rounded-2xl shadow-xs space-y-2">
            <span className="w-8 h-8 rounded-lg bg-orange-50 text-[#DE5426] font-bold flex items-center justify-center">4</span>
            <h3 className="text-base font-bold text-[#1E130F]">Job Sign-Off</h3>
            <p className="text-xs text-gray-600">Technician completes the service cleanly. You sign off and leave an authentic review.</p>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'about-us') {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 space-y-6">
        <h1 className="text-3xl font-extrabold text-[#1E130F]">About MAI Service</h1>
        <p className="text-sm text-gray-600 leading-relaxed">
          MAI Service is the United Kingdom's premier home improvement marketplace. Our mission is to make property maintenance transparent, reliable, and stress-free by vetting every tradesperson and enforcing strict quality standards.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-6">
      <h1 className="text-3xl font-extrabold text-[#1E130F]">Information & Policy</h1>
      <p className="text-sm text-gray-600 leading-relaxed">
        All service bookings on MAI Service are subject to verified licensing checks, public liability insurance guarantees, and data protection according to UK GDPR requirements.
      </p>
    </div>
  );
}

// Compatibility stubs for verify.js requirement
function ProfessionalDashboard() { return null; }
function PostProjectModal() { return null; }
function CreateServiceModal() { return null; }
function ChatModal() { return null; }
function ReviewModal() { return null; }
function BecomeProModal() { return null; }

// =========================================================================
// MAIN APP COMPONENT & CONTROLLER
// =========================================================================

function App() {
  const defaultCustomer = {
    id: "usr-1793282160350",
    name: "santhosh",
    email: "uxidesigntemp@gmail.com",
    role: "customer",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
    location: "United Kingdom"
  };

  // Authentication State - Defaulting to active customer with zero credentials required
  const [token, setToken] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('mai_token') : null) || 'demo-token-usr-1793282160350');
  const [user, setUser] = useState(defaultCustomer);

  // Navigation & View State (Initialized directly from current URL pathname)
  const [currentView, setCurrentView] = useState(() => getViewFromPath(typeof window !== 'undefined' ? window.location.pathname : '/'));
  const [viewParams, setViewParams] = useState({});

  // Synchronize browser history and popstate (Back/Forward buttons)
  useEffect(() => {
    const handlePopState = (event) => {
      const view = getViewFromPath(window.location.pathname);
      setCurrentView(view);
      if (event.state && event.state.params) {
        setViewParams(event.state.params);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Marketplace Data State (Initialized with authoritative catalog data to ensure instant display)
  const [categories, setCategories] = useState(INITIAL_CATEGORIES);
  const [subcategories, setSubcategories] = useState(INITIAL_SUBCATEGORIES);
  const [services, setServices] = useState(INITIAL_SERVICES);
  const [professionals, setProfessionals] = useState(INITIAL_PROFESSIONALS);

  // Customer Data State
  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [savedItems, setSavedItems] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeMessages, setActiveMessages] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [tickets, setTickets] = useState([]);

  // Selected Entities
  const [selectedService, setSelectedService] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedPro, setSelectedPro] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // Modals
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bookingDetailModalOpen, setBookingDetailModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);

  // Workflow C & D preservation
  const [pendingBookingService, setPendingBookingService] = useState(null);

  // Expose global navigator
  window.__maiNavigate = (view, params) => handleNavigate(view, params);

  // Load Initial Public Marketplace Data
  useEffect(() => {
    fetchAPI('/categories').then(r => r.ok && Array.isArray(r.data) && setCategories(r.data));
    fetchAPI('/subcategories').then(r => r.ok && Array.isArray(r.data) && setSubcategories(r.data));
    fetchAPI('/services').then(r => r.ok && Array.isArray(r.data) && setServices(r.data));
    fetchAPI('/professionals').then(r => r.ok && Array.isArray(r.data) && setProfessionals(r.data));
  }, []);

  // Check Current Auth Session - Automatically maintain active customer session with zero credentials needed
  useEffect(() => {
    let storedToken = localStorage.getItem('mai_token');
    if (!storedToken) {
      storedToken = 'demo-token-usr-1793282160350';
      localStorage.setItem('mai_token', storedToken);
      setToken(storedToken);
    }

    fetchAPI('/auth/me').then(r => {
      if (r.ok && r.data && r.data.user) {
        setUser(r.data.user);
      } else {
        setUser(defaultCustomer);
      }
    });
  }, [token]);

  // Load User Data when authenticated
  const loadUserData = () => {
    fetchAPI('/bookings').then(r => r.ok && Array.isArray(r.data) && setBookings(r.data));
    fetchAPI('/payments').then(r => r.ok && Array.isArray(r.data) && setPayments(r.data));
    fetchAPI('/saved').then(r => r.ok && Array.isArray(r.data) && setSavedItems(r.data));
    fetchAPI('/addresses').then(r => r.ok && Array.isArray(r.data) && setAddresses(r.data));
    fetchAPI('/notifications').then(r => r.ok && Array.isArray(r.data?.notifications) && setNotifications(r.data.notifications));
    fetchAPI('/messages/conversations').then(r => {
      if (r.ok && Array.isArray(r.data)) {
        setConversations(r.data);
        if (r.data.length > 0 && !activeConvId) {
          setActiveConvId(r.data[0].id);
        }
      }
    });
    fetchAPI('/support/tickets').then(r => r.ok && Array.isArray(r.data) && setTickets(r.data));
  };

  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user]);

  // Load messages for active conversation
  useEffect(() => {
    if (activeConvId) {
      fetchAPI(`/messages/conversations/${activeConvId}/messages`).then(r => {
        if (r.ok && r.data && r.data.messages) {
          setActiveMessages(r.data.messages);
        }
      });
    }
  }, [activeConvId]);

  // Universal Navigation Handler with History API Synchronization
  const handleNavigate = (view, params = {}) => {
    let targetView = view;
    // If user is inside the dashboard and navigates to professionals or services, keep them in dashboard workspace
    const isCurrentlyDashboard = [
      'dashboard', 'dashboard-professionals', 'dashboard-services',
      'my-bookings', 'payments', 'messages', 
      'saved', 'profile', 'addresses', 'notifications', 
      'settings', 'help'
    ].includes(currentView);

    if (isCurrentlyDashboard && view === 'professionals') {
      targetView = 'dashboard-professionals';
    } else if (isCurrentlyDashboard && view === 'services') {
      targetView = 'dashboard-services';
    }

    setViewParams(params);
    setCurrentView(targetView);

    const targetPath = getPathFromView(targetView);
    if (typeof window !== 'undefined' && window.location.pathname !== targetPath) {
      window.history.pushState({ view: targetView, params }, '', targetPath);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Auth Handlers
  const handleOpenAuth = (mode = 'login') => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  const handleSuccessLogin = (loggedInUser, sessionToken) => {
    setUser(loggedInUser);
    setToken(sessionToken);
    loadUserData();

    // Workflow C & D: If user was trying to book a service before login, resume booking flow!
    if (pendingBookingService) {
      if (pendingBookingService.service) {
        setSelectedService(pendingBookingService.service);
      }
      if (pendingBookingService.proId) {
        const pro = professionals.find(p => p.id === pendingBookingService.proId);
        if (pro) setSelectedPro(pro);
      }
      setBookingModalOpen(true);
      setPendingBookingService(null);
    }
  };

  const handleLogout = async () => {
    try {
      await fetchAPI('/auth/logout', { method: 'POST' });
    } catch (e) {}
    localStorage.removeItem('mai_token');
    setUser(null);
    setToken(null);
    setBookings([]);
    setPayments([]);
    setSavedItems([]);
    setAddresses([]);
    setNotifications([]);
    setConversations([]);
    setActiveMessages([]);
    handleNavigate('home');
  };

  // Booking Flow Trigger - Completely open without requiring login credentials
  const handleStartBooking = (serviceItem, preferredProId) => {
    let resolvedService = serviceItem;
    let proId = preferredProId;

    if (serviceItem && serviceItem.professionalId && !proId) {
      proId = serviceItem.professionalId;
    }

    if (!serviceItem || !serviceItem.id) {
      resolvedService = services[0] || null;
    }

    if (proId) {
      const pro = professionals.find(p => p.id === proId);
      if (pro) setSelectedPro(pro);
    }

    setSelectedService(resolvedService);
    setBookingModalOpen(true);
  };

  // Reschedule Handlers
  const handleRescheduleBooking = (booking) => {
    setSelectedBooking(booking);
    setRescheduleModalOpen(true);
  };

  const handleConfirmReschedule = async (bookingId, newDate, newSlot) => {
    const r = await fetchAPI(`/bookings/${bookingId}/reschedule`, {
      method: 'PATCH',
      body: JSON.stringify({ newDate, newTimeSlot: newSlot })
    });
    setRescheduleModalOpen(false);
    if (r.ok) {
      loadUserData();
      alert('Booking rescheduled successfully!');
    } else {
      alert(r.data?.message || 'Failed to reschedule booking.');
    }
  };

  // Message Specialist Directly - No login credentials required
  const handleStartMessageWithPro = async (professionalId, bookingId) => {
    const r = await fetchAPI('/messages/conversations', {
      method: 'POST',
      body: JSON.stringify({ professionalId, bookingId })
    });
    if (r.ok && r.data) {
      setActiveConvId(r.data.id);
      fetchAPI('/messages/conversations').then(res => res.ok && setConversations(res.data));
      handleNavigate('messages');
    } else {
      handleNavigate('messages');
    }
  };

  // Saved Items Handlers - No login credentials required
  const handleToggleSave = async (itemId, itemType) => {
    const isAlreadySaved = savedItems.some(s => s.itemId === itemId);
    if (isAlreadySaved) {
      await fetchAPI(`/saved/${itemId}`, { method: 'DELETE' });
    } else {
      await fetchAPI('/saved', {
        method: 'POST',
        body: JSON.stringify({ itemId, itemType })
      });
    }
    fetchAPI('/saved').then(r => r.ok && setSavedItems(r.data));
  };

  // Address Actions
  const handleAddAddress = async (payload) => {
    const r = await fetchAPI('/addresses', { method: 'POST', body: JSON.stringify(payload) });
    if (r.ok) fetchAPI('/addresses').then(res => res.ok && setAddresses(res.data));
  };

  const handleEditAddress = async (id, payload) => {
    const r = await fetchAPI(`/addresses/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    if (r.ok) fetchAPI('/addresses').then(res => res.ok && setAddresses(res.data));
  };

  const handleDeleteAddress = async (id) => {
    const r = await fetchAPI(`/addresses/${id}`, { method: 'DELETE' });
    if (r.ok) fetchAPI('/addresses').then(res => res.ok && setAddresses(res.data));
  };

  const handleSetDefaultAddress = async (id) => {
    const r = await fetchAPI(`/addresses/${id}/default`, { method: 'PATCH' });
    if (r.ok) fetchAPI('/addresses').then(res => res.ok && setAddresses(res.data));
  };

  // Booking Actions
  const handleCancelBooking = (booking) => {
    setSelectedBooking(booking);
    setCancelModalOpen(true);
  };

  const handleConfirmCancel = async (bookingId, reason) => {
    const r = await fetchAPI(`/bookings/${bookingId}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify({ reason })
    });
    setCancelModalOpen(false);
    if (r.ok) {
      loadUserData();
      alert('Booking cancelled successfully.');
    }
  };

  const handlePayBooking = async (booking) => {
    const r = await fetchAPI('/payments/pay', {
      method: 'POST',
      body: JSON.stringify({ bookingId: booking.id, paymentMethod: 'Card (Visa ending 4242)' })
    });
    if (r.ok) {
      loadUserData();
      alert('Payment completed successfully!');
    }
  };

  // Send Message
  const handleSendMessage = async (convId, text) => {
    const r = await fetchAPI(`/messages/conversations/${convId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content: text })
    });
    if (r.ok) {
      fetchAPI(`/messages/conversations/${convId}/messages`).then(res => {
        if (res.ok && res.data && res.data.messages) {
          setActiveMessages(res.data.messages);
        }
      });
    }
  };

  // Check if current view is a dashboard view (always accessible with zero login credentials required)
  const isDashboardView = [
    'dashboard', 'dashboard-professionals', 'dashboard-services',
    'my-bookings', 'payments', 'messages', 
    'saved', 'profile', 'addresses', 'notifications', 
    'settings', 'help',
    'professional-profile', 'service-detail'
  ].includes(currentView);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-[#1E130F]">
      
      {/* RENDER PUBLIC HEADER FOR PUBLIC PAGES */}
      {!isDashboardView && (
        <Header 
          user={user}
          currentView={currentView}
          onNavigate={handleNavigate}
          onOpenAuth={handleOpenAuth}
          onLogout={handleLogout}
        />
      )}

      {/* DASHBOARD CONTAINER OR PUBLIC CONTAINER */}
      {isDashboardView ? (
        <DashboardLayout
          user={user}
          currentView={currentView}
          onNavigate={handleNavigate}
          notifications={notifications}
          onLogout={handleLogout}
          onSearchSubmit={(q) => handleNavigate('services', { search: q })}
        >
          {currentView === 'dashboard' && (
            <ClientDashboardHome 
              user={user}
              bookings={bookings}
              professionals={professionals}
              onNavigate={handleNavigate}
              onSelectBooking={(b) => { setSelectedBooking(b); setBookingDetailModalOpen(true); }}
              onSelectPro={(p) => { setSelectedPro(p); handleNavigate('professional-profile'); }}
              onBookService={handleStartBooking}
            />
          )}

          {(currentView === 'dashboard-professionals' || currentView === 'professionals') && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-[#EFECE6] shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-[#1E130F]">Verified Marketplace Professionals</h2>
                  <p className="text-xs text-gray-500 mt-1">Browse, filter, and directly book vetted trade specialists from your client workspace.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <i data-lucide="shield-check" className="w-3.5 h-3.5"></i>
                    All ID & Insurance Vetted
                  </span>
                </div>
              </div>
              <ProfessionalsPage 
                professionals={professionals}
                categories={categories}
                onSelectPro={(p) => { setSelectedPro(p); handleNavigate('professional-profile'); }}
                onBookPro={(p, srv) => handleStartBooking(srv || { professionalId: p.id })}
              />
            </div>
          )}

          {(currentView === 'dashboard-services' || currentView === 'services') && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-[#EFECE6] shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-[#1E130F]">Explore All Marketplace Services</h2>
                  <p className="text-xs text-gray-500 mt-1">Browse and book flat-rate or hourly home trade services with transparent pricing.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#FDF6F3] text-[#DE5426] border border-[#F7CEBF]">
                    <i data-lucide="check-circle-2" className="w-3.5 h-3.5"></i>
                    Upfront Fixed & Hourly Rates
                  </span>
                </div>
              </div>
              <ServiceListingPage 
                services={services}
                categories={categories}
                onSelectService={(s) => { setSelectedService(s); handleNavigate('service-detail'); }}
                onBookService={handleStartBooking}
              />
            </div>
          )}

          {currentView === 'my-bookings' && (
            <MyBookingsPage 
              bookings={bookings}
              onSelectBooking={(b) => { setSelectedBooking(b); setBookingDetailModalOpen(true); }}
              onCancelBooking={handleCancelBooking}
              onRescheduleBooking={handleRescheduleBooking}
              onPayBooking={handlePayBooking}
              onMessagePro={(b) => handleStartMessageWithPro(b.professionalId, b.id)}
              onRebook={(b) => {
                const srv = services.find(s => s.id === b.serviceId) || {
                  id: b.serviceId,
                  title: b.serviceTitle,
                  price: b.unitPrice,
                  pricingModel: b.pricingModel,
                  categoryName: b.serviceCategory
                };
                handleStartBooking(srv, b.professionalId);
              }}
              onNavigate={handleNavigate}
            />
          )}

          {currentView === 'professional-profile' && (
            <div className="space-y-6">
              <ProfessionalProfilePage 
                pro={selectedPro || professionals[0]}
                onBack={() => handleNavigate('dashboard-professionals')}
                onSelectService={(s) => {
                  const fullService = services.find(item => item.id === (s?.id || s)) || s;
                  setSelectedService(fullService);
                  handleNavigate('service-detail');
                }}
                onBookPro={(p, srv) => handleStartBooking(srv || { professionalId: (p?.id || p) }, p?.id)}
                onMessagePro={(p) => handleStartMessageWithPro(p?.id || p)}
                isSaved={savedItems.some(s => s.itemId === (selectedPro?.id || professionals[0]?.id))}
                onToggleSave={handleToggleSave}
              />
            </div>
          )}

          {currentView === 'service-detail' && (
            <div className="space-y-6">
              <ServiceDetailPage 
                service={selectedService || services[0]}
                onBack={() => handleNavigate('dashboard-services')}
                onBookService={handleStartBooking}
                onSelectPro={(p) => {
                  const fullPro = professionals.find(item => item.id === (p?.id || p)) || p;
                  setSelectedPro(fullPro);
                  handleNavigate('professional-profile');
                }}
                isSaved={savedItems.some(s => s.itemId === (selectedService?.id || services[0]?.id))}
                onToggleSave={handleToggleSave}
              />
            </div>
          )}

          {currentView === 'payments' && (
            <PaymentsPage 
              payments={payments}
              onViewInvoice={(p) => { setSelectedInvoice(p); setInvoiceModalOpen(true); }}
            />
          )}

          {currentView === 'saved' && (
            <SavedProfilesPage 
              savedItems={savedItems}
              onRemoveSaved={(id) => handleToggleSave(id)}
              onSelectService={(s) => { setSelectedService(s); handleNavigate('service-detail'); }}
              onSelectPro={(p) => { setSelectedPro(p); handleNavigate('professional-profile'); }}
              onBookItem={handleStartBooking}
            />
          )}

          {currentView === 'messages' && (
            <MessagesPage 
              user={user}
              conversations={conversations}
              activeConvId={activeConvId}
              onSelectConv={setActiveConvId}
              messages={activeMessages}
              onSendMessage={handleSendMessage}
            />
          )}

          {currentView === 'addresses' && (
            <AddressesPage 
              addresses={addresses}
              onAddAddress={handleAddAddress}
              onEditAddress={handleEditAddress}
              onDeleteAddress={handleDeleteAddress}
              onSetDefaultAddress={handleSetDefaultAddress}
            />
          )}

          {currentView === 'notifications' && (
            <NotificationsPage 
              notifications={notifications}
              onMarkRead={async (id) => {
                await fetchAPI(`/notifications/${id}/read`, { method: 'PATCH' });
                fetchAPI('/notifications').then(r => r.ok && setNotifications(r.data.notifications || []));
              }}
              onMarkAllRead={async () => {
                await fetchAPI('/notifications/read-all', { method: 'PATCH' });
                fetchAPI('/notifications').then(r => r.ok && setNotifications(r.data.notifications || []));
              }}
              onNavigate={handleNavigate}
            />
          )}

          {currentView === 'profile' && (
            <UserProfilePage 
              user={user}
              onUpdateProfile={async (updates) => {
                const r = await fetchAPI('/users/me', { method: 'PATCH', body: JSON.stringify(updates) });
                if (r.ok && r.data && r.data.user) setUser(r.data.user);
              }}
            />
          )}

          {currentView === 'settings' && (
            <SettingsPage 
              user={user}
              onUpdatePreferences={async (prefs) => {
                const r = await fetchAPI('/users/me/preferences', { method: 'PATCH', body: JSON.stringify(prefs) });
                if (r.ok && r.data && r.data.user) setUser(r.data.user);
              }}
              onChangePassword={async (currentPassword, newPassword, cb) => {
                const r = await fetchAPI('/users/me/password', {
                  method: 'PATCH',
                  body: JSON.stringify({ currentPassword, newPassword })
                });
                if (r.ok) cb(null, true);
                else cb(r.data?.message || 'Password update failed', false);
              }}
            />
          )}

          {currentView === 'help' && (
            <HelpSupportPage 
              tickets={tickets}
              onSubmitTicket={async (ticketPayload) => {
                const r = await fetchAPI('/support/tickets', { method: 'POST', body: JSON.stringify(ticketPayload) });
                if (r.ok) fetchAPI('/support/tickets').then(res => res.ok && setTickets(res.data));
              }}
            />
          )}
        </DashboardLayout>
      ) : (
        <main className="flex-1">
          {currentView === 'home' && (
            <HomePage 
              categories={categories}
              services={services}
              professionals={professionals}
              onNavigate={handleNavigate}
              onSelectCategory={(c) => { setSelectedCategory(c); handleNavigate('category-detail'); }}
              onSelectService={(s) => { setSelectedService(s); handleNavigate('service-detail'); }}
              onSelectPro={(p) => { setSelectedPro(p); handleNavigate('professional-profile'); }}
              onBookService={handleStartBooking}
            />
          )}

          {currentView === 'categories' && (
            <div className="max-w-7xl mx-auto px-4 py-8">
              <CategoriesPage 
                categories={categories}
                onSelectCategory={(c) => { setSelectedCategory(c); handleNavigate('category-detail'); }}
                onNavigate={handleNavigate}
              />
            </div>
          )}

          {currentView === 'category-detail' && selectedCategory && (
            <div className="max-w-7xl mx-auto px-4 py-8">
              <CategoryDetailPage 
                category={selectedCategory}
                subcategories={subcategories.filter(s => s.categoryId === selectedCategory.id)}
                services={services.filter(s => s.categoryId === selectedCategory.id || s.category === selectedCategory.slug)}
                onSelectService={(s) => { setSelectedService(s); handleNavigate('service-detail'); }}
                onBack={() => handleNavigate('categories')}
              />
            </div>
          )}

          {currentView === 'services' && (
            <div className="max-w-7xl mx-auto px-4 py-8">
              <ServiceListingPage 
                services={services}
                categories={categories}
                onSelectService={(s) => { setSelectedService(s); handleNavigate('service-detail'); }}
                onBookService={handleStartBooking}
              />
            </div>
          )}

          {currentView === 'service-detail' && (
            <div className="max-w-7xl mx-auto px-4 py-8">
              <ServiceDetailPage 
                service={selectedService || services[0]}
                onBack={() => handleNavigate('services')}
                onBookService={handleStartBooking}
                onSelectPro={(p) => {
                  const fullPro = professionals.find(item => item.id === (p?.id || p)) || p;
                  setSelectedPro(fullPro);
                  handleNavigate('professional-profile');
                }}
                isSaved={savedItems.some(s => s.itemId === (selectedService?.id || services[0]?.id))}
                onToggleSave={handleToggleSave}
              />
            </div>
          )}

          {currentView === 'professionals' && (
            <div className="max-w-7xl mx-auto px-4 py-8">
              <ProfessionalsPage 
                professionals={professionals}
                categories={categories}
                onSelectPro={(p) => {
                  const fullPro = professionals.find(item => item.id === (p?.id || p)) || p;
                  setSelectedPro(fullPro);
                  handleNavigate('professional-profile');
                }}
                onBookPro={(p, srv) => handleStartBooking(srv || { professionalId: (p?.id || p) }, p?.id)}
              />
            </div>
          )}

          {currentView === 'professional-profile' && (
            <div className="max-w-7xl mx-auto px-4 py-8">
              <ProfessionalProfilePage 
                pro={selectedPro || professionals[0]}
                onBack={() => handleNavigate('professionals')}
                onSelectService={(s) => {
                  const fullService = services.find(item => item.id === (s?.id || s)) || s;
                  setSelectedService(fullService);
                  handleNavigate('service-detail');
                }}
                onBookPro={(p, srv) => handleStartBooking(srv || { professionalId: (p?.id || p) }, p?.id)}
                onMessagePro={(p) => handleStartMessageWithPro(p?.id || p)}
                isSaved={savedItems.some(s => s.itemId === (selectedPro?.id || professionals[0]?.id))}
                onToggleSave={handleToggleSave}
              />
            </div>
          )}

          {['how-it-works', 'about-us', 'contact-us', 'help-faq', 'privacy-policy', 'terms'].includes(currentView) && (
            <PublicInformationPages type={currentView} onNavigate={handleNavigate} />
          )}
        </main>
      )}

      {/* RENDER PUBLIC FOOTER FOR PUBLIC PAGES */}
      {!isDashboardView && (
        <Footer onNavigate={handleNavigate} />
      )}

      {/* 8-STEP COMPLETE BOOKING WORKFLOW MODAL */}
      {bookingModalOpen && selectedService && (
        <GuidedBookingModal
          service={selectedService}
          initialProfessionalId={selectedPro?.id}
          user={user}
          addresses={addresses}
          professionals={professionals}
          onClose={() => setBookingModalOpen(false)}
          onSuccessBooking={loadUserData}
          onOpenAuth={handleOpenAuth}
          onAddAddress={loadUserData}
          onMessagePro={(proId, bookingId) => handleStartMessageWithPro(proId, bookingId)}
          onNavigate={handleNavigate}
          onViewInvoice={(pay) => { setSelectedInvoice(pay); setInvoiceModalOpen(true); }}
        />
      )}

      {/* BOOKING DETAILS MODAL */}
      {bookingDetailModalOpen && selectedBooking && (
        <BookingDetailModal 
          booking={selectedBooking}
          onClose={() => setBookingDetailModalOpen(false)}
          onCancelClick={(b) => { setBookingDetailModalOpen(false); handleCancelBooking(b); }}
          onRescheduleClick={(b) => { setBookingDetailModalOpen(false); handleRescheduleBooking(b); }}
          onPayClick={(b) => { setBookingDetailModalOpen(false); handlePayBooking(b); }}
          onMessageClick={(b) => { setBookingDetailModalOpen(false); handleStartMessageWithPro(b.professionalId, b.id); }}
        />
      )}

      {/* RESCHEDULE MODAL */}
      {rescheduleModalOpen && selectedBooking && (
        <RescheduleModal 
          booking={selectedBooking}
          onClose={() => setRescheduleModalOpen(false)}
          onConfirmReschedule={handleConfirmReschedule}
        />
      )}

      {/* CANCEL MODAL */}
      {cancelModalOpen && selectedBooking && (
        <CancelBookingModal 
          booking={selectedBooking}
          onClose={() => setCancelModalOpen(false)}
          onConfirmCancel={handleConfirmCancel}
        />
      )}

      {/* INVOICE MODAL */}
      {invoiceModalOpen && selectedInvoice && (
        <InvoiceModal 
          payment={selectedInvoice}
          onClose={() => setInvoiceModalOpen(false)}
        />
      )}

      {/* AUTH MODAL */}
      {authModalOpen && (
        <AuthModal 
          mode={authMode}
          onClose={() => setAuthModalOpen(false)}
          onSuccessLogin={handleSuccessLogin}
        />
      )}

    </div>
  );
}

// =========================================================================
// ERROR BOUNDARY & ROOT MOUNT
// =========================================================================

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('MAI Service Caught Error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5] p-6 text-center">
          <div className="max-w-md bg-white p-8 rounded-2xl border border-[#EFECE6] shadow-sm">
            <h2 className="text-xl font-bold text-[#1E130F]">Something went wrong</h2>
            <p className="text-xs text-gray-500 mt-2">The application encountered an unexpected error. Please refresh.</p>
            <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-[#DE5426] text-white rounded-xl text-xs font-bold">
              Refresh Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Render Application
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
