import { ArrowRight, Building2, CheckCircle2, Lock, ShieldCheck, User, X } from 'lucide-react';
import { useState } from 'react';
import { OFFICIAL_LOGO_URL } from '../data/landingDefaults';
import { WORLD_COUNTRIES } from '../data/worldCountriesPorts';
import type { UserProfile } from '../types/portal';

interface UniversalLoginModalProps {
  isAuthenticated: boolean;
  needsProfileCompletion: boolean;
  currentEmail: string;
  currentDisplayName: string;
  userProfile: UserProfile | null;
  authError: string;
  isSigningIn: boolean;
  onGoogleSignIn: () => Promise<void>;
  onCompleteBuyerProfile: (input: {
    accountType: 'customer' | 'dealer';
    displayName: string;
    companyName: string;
    country: string;
    defaultPortId: string;
    phone: string;
    consigneeAddress: string;
  }) => Promise<void>;
  onClose: () => void;
}

export function UniversalLoginModal({
  isAuthenticated,
  needsProfileCompletion,
  currentEmail,
  currentDisplayName,
  authError,
  isSigningIn,
  onGoogleSignIn,
  onCompleteBuyerProfile,
  onClose,
}: UniversalLoginModalProps) {
  const [accountType, setAccountType] = useState<'customer' | 'dealer'>('customer');
  const [displayName, setDisplayName] = useState(currentDisplayName || '');
  const [companyName, setCompanyName] = useState('');
  const [countryCode, setCountryCode] = useState('KE');
  const [phone, setPhone] = useState('');
  const [consigneeAddress, setConsigneeAddress] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const selectedCountry =
    WORLD_COUNTRIES.find((c) => c.code === countryCode) || WORLD_COUNTRIES[0];
  const [portId, setPortId] = useState(selectedCountry.ports[0]?.id || 'mombasa-ke');

  const handleCountryChange = (code: string) => {
    setCountryCode(code);
    const next = WORLD_COUNTRIES.find((c) => c.code === code) || WORLD_COUNTRIES[0];
    setPortId(next.ports[0]?.id || 'mombasa-ke');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setSavingProfile(true);
    try {
      await onCompleteBuyerProfile({
        accountType,
        displayName: displayName.trim(),
        companyName: companyName.trim() || (accountType === 'dealer' ? 'Authorized Importer' : 'Individual Buyer'),
        country: selectedCountry.name,
        defaultPortId: portId,
        phone: phone.trim(),
        consigneeAddress: consigneeAddress.trim(),
      });
      onClose();
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="universal-login-title"
    >
      <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden my-8">
        <div className="bg-slate-950 px-6 py-5 text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src={OFFICIAL_LOGO_URL}
              alt="Auzio Traders"
              className="w-10 h-10 rounded-full object-cover bg-white ring-2 ring-white/20"
            />
            <div>
              <h2 id="universal-login-title" className="text-base font-bold tracking-tight">
                {needsProfileCompletion ? 'Complete Your Buyer Profile' : 'Sign In to Auzio Traders'}
              </h2>
              <p className="text-xs text-slate-300">
                Universal Account Portal
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close login dialog"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {authError && (
            <div className="mb-4 px-3.5 py-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              {authError}
            </div>
          )}

          {isAuthenticated && needsProfileCompletion ? (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="text-xs text-slate-600 leading-relaxed">
                Signed in as <strong className="text-slate-900">{currentEmail}</strong>. Confirm your
                shipping profile below to access quotations, live auction bid ceilings, and order
                tracking.
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setAccountType('customer')}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                    accountType === 'customer'
                      ? 'border-amber-500 bg-amber-50 text-slate-950'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <User className="w-3.5 h-3.5 text-amber-600" />
                  Individual Buyer
                </button>
                <button
                  type="button"
                  onClick={() => setAccountType('dealer')}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                    accountType === 'dealer'
                      ? 'border-amber-500 bg-amber-50 text-slate-950'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5 text-amber-600" />
                  Dealer / Wholesale
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {accountType === 'dealer' ? 'Dealership / Company *' : 'Company (Optional)'}
                  </label>
                  <input
                    type="text"
                    required={accountType === 'dealer'}
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Company or showroom name"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Destination Country</label>
                  <select
                    value={countryCode}
                    onChange={(e) => handleCountryChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-amber-500"
                  >
                    {WORLD_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Preferred Port</label>
                  <select
                    value={portId}
                    onChange={(e) => setPortId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-amber-500"
                  >
                    {selectedCountry.ports.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.unLocode})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">WhatsApp / Phone *</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+254 7XX XXX XXX"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Consignee City / Address</label>
                  <input
                    type="text"
                    value={consigneeAddress}
                    onChange={(e) => setConsigneeAddress(e.target.value)}
                    placeholder="City & Street"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="w-full py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {savingProfile ? 'Saving Profile...' : 'Save & Enter My Dashboard'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <div className="space-y-5">
              <p className="text-sm text-slate-600 leading-relaxed">
                Sign in once with your verified account. Auzio Traders automatically routes you to
                your authorized Customer, Dealer, or Department workspace based on your account
                permissions.
              </p>

              <button
                type="button"
                disabled={isSigningIn}
                onClick={() => void onGoogleSignIn()}
                className="w-full py-3 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-3 shadow-sm cursor-pointer disabled:opacity-60"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#EA4335"
                    d="M12 5.04c1.64 0 3.12.56 4.28 1.66l3.2-3.2C17.53 1.69 14.98.7 12 .7 7.39.7 3.4 3.35 1.46 7.21l3.73 2.9C6.07 7.15 8.8 5.04 12 5.04z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.71 2.88c2.17-2 3.71-4.94 3.71-8.7z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.19 14.89a7.17 7.17 0 0 1 0-4.78L1.46 7.21a11.98 11.98 0 0 0 0 10.58l3.73-2.9z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23.3c3.24 0 5.95-1.07 7.93-2.91l-3.71-2.88c-1.07.72-2.44 1.15-4.22 1.15-3.2 0-5.93-2.11-6.81-5.07l-3.73 2.9C3.4 20.65 7.39 23.3 12 23.3z"
                  />
                </svg>
                {isSigningIn ? 'Authenticating...' : 'Continue with Google'}
              </button>

              <div className="pt-4 border-t border-slate-100 space-y-2.5 text-xs text-slate-600">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-900">Customers &amp; Dealers:</strong> Submit sourcing
                    requests, approve Max Bid Ceilings, download Proforma Invoices, and track vessels.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-900">Authorized Teams:</strong> Sales, Accounts,
                    Operations, Management, and Administrators are routed directly to internal consoles.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <Lock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <span>
                    Role permissions are enforced server-side. New registrations start with standard
                    buyer access.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
