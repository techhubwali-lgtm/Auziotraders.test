import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  ShieldAlert,
  User,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { OFFICIAL_LOGO_URL } from '../data/landingDefaults';
import { WORLD_COUNTRIES } from '../data/worldCountriesPorts';
import type { UserProfile } from '../types/portal';

interface UniversalLoginModalProps {
  initialMode?: 'login' | 'signup';
  isAuthenticated: boolean;
  needsProfileCompletion: boolean;
  currentEmail: string;
  currentDisplayName: string;
  userProfile: UserProfile | null;
  authError: string;
  isSigningIn: boolean;
  onEmailSignUp: (input: {
    fullName: string;
    email: string;
    password: string;
  }) => Promise<void>;
  onEmailSignIn: (input: { email: string; password: string }) => Promise<void>;
  onResetPassword: (email: string) => Promise<boolean>;
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
  onClearError?: () => void;
  onClose: () => void;
}

export function UniversalLoginModal({
  initialMode = 'login',
  isAuthenticated,
  needsProfileCompletion,
  currentEmail,
  currentDisplayName,
  authError,
  isSigningIn,
  onEmailSignUp,
  onEmailSignIn,
  onResetPassword,
  onGoogleSignIn,
  onCompleteBuyerProfile,
  onClearError,
  onClose,
}: UniversalLoginModalProps) {
  const [authTab, setAuthTab] = useState<'login' | 'signup'>(initialMode);

  // Registration form fields (matching reference layout)
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);

  // Login form fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [resetSentMessage, setResetSentMessage] = useState('');

  // Local client validation error
  const [localError, setLocalError] = useState('');

  // Buyer profile completion (for first-time Google Sign-In accounts)
  const [accountType, setAccountType] = useState<'customer' | 'dealer'>('customer');
  const [displayName, setDisplayName] = useState(currentDisplayName || '');
  const [companyName, setCompanyName] = useState('');
  const [countryCode, setCountryCode] = useState('KE');
  const [phone, setPhone] = useState('');
  const [consigneeAddress, setConsigneeAddress] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    setAuthTab(initialMode);
    setLocalError('');
    setResetSentMessage('');
  }, [initialMode]);

  useEffect(() => {
    if (currentDisplayName && !displayName) {
      setDisplayName(currentDisplayName);
    }
  }, [currentDisplayName, displayName]);

  const selectedCountry =
    WORLD_COUNTRIES.find((c) => c.code === countryCode) || WORLD_COUNTRIES[0];
  const [portId, setPortId] = useState(selectedCountry.ports[0]?.id || 'mombasa-ke');

  const combinedError = localError || authError;
  const isSuspendedError = combinedError.toLowerCase().includes('suspended');

  const switchTab = (next: 'login' | 'signup') => {
    setAuthTab(next);
    setLocalError('');
    setResetSentMessage('');
    onClearError?.();
  };

  const handleCountryChange = (code: string) => {
    setCountryCode(code);
    const next = WORLD_COUNTRIES.find((c) => c.code === code) || WORLD_COUNTRIES[0];
    setPortId(next.ports[0]?.id || 'mombasa-ke');
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    onClearError?.();

    const trimmedName = regName.trim();
    const trimmedEmail = regEmail.trim();

    if (!trimmedName) {
      setLocalError('Please enter your name.');
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setLocalError('Please enter a valid email address.');
      return;
    }
    if (regPassword.length < 6) {
      setLocalError('Password must be at least 6 characters long.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setLocalError('Passwords do not match. Please confirm your password.');
      return;
    }
    if (!acceptedTerms) {
      setLocalError('Please accept all terms & conditions to register.');
      return;
    }

    await onEmailSignUp({
      fullName: trimmedName,
      email: trimmedEmail,
      password: regPassword,
    });
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    setResetSentMessage('');
    onClearError?.();

    const trimmedEmail = loginEmail.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setLocalError('Please enter your email address.');
      return;
    }
    if (!loginPassword) {
      setLocalError('Please enter your password.');
      return;
    }

    await onEmailSignIn({
      email: trimmedEmail,
      password: loginPassword,
    });
  };

  const handleForgotPassword = async () => {
    setLocalError('');
    setResetSentMessage('');
    onClearError?.();

    const trimmedEmail = loginEmail.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setLocalError('Enter your email above first, then click Forgot password.');
      return;
    }
    const ok = await onResetPassword(trimmedEmail);
    if (ok) {
      setResetSentMessage(`Password reset link sent to ${trimmedEmail}. Check your inbox.`);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setSavingProfile(true);
    try {
      await onCompleteBuyerProfile({
        accountType,
        displayName: displayName.trim(),
        companyName:
          companyName.trim() ||
          (accountType === 'dealer' ? 'Authorized Importer' : 'Individual Buyer'),
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
        {/* Clean Brand Bar */}
        <div className="px-6 pt-5 pb-3 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <img
              src={OFFICIAL_LOGO_URL}
              alt="Auzio Traders"
              className="w-8 h-8 rounded-full object-cover bg-white ring-1 ring-slate-200"
            />
            <span className="text-xs font-extrabold tracking-wider uppercase text-slate-900">
              Auzio Traders
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-7 py-6">
          {combinedError && (
            <div
              className={`mb-4 px-3.5 py-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                isSuspendedError
                  ? 'bg-red-50 border-red-300 text-red-900'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                {isSuspendedError && (
                  <div className="font-bold text-red-900 mb-0.5">Account Access Suspended</div>
                )}
                <span>{combinedError}</span>
              </div>
            </div>
          )}

          {resetSentMessage && (
            <div className="mb-4 px-3.5 py-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-900 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{resetSentMessage}</span>
            </div>
          )}

          {isAuthenticated && needsProfileCompletion ? (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <h2
                  id="universal-login-title"
                  className="text-xl font-bold text-slate-900 tracking-tight"
                >
                  Complete Profile
                </h2>
                <div className="w-8 h-0.5 bg-amber-500 rounded-full mt-1" />
                <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                  Signed in as <strong className="text-slate-900">{currentEmail}</strong>. Confirm
                  your details below to activate your account.
                </p>
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
                  <label className="block font-semibold text-slate-700 mb-1">
                    Destination Country
                  </label>
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
                  <label className="block font-semibold text-slate-700 mb-1">
                    WhatsApp / Phone *
                  </label>
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
                  <label className="block font-semibold text-slate-700 mb-1">
                    Consignee City / Address
                  </label>
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
                className="w-full py-2.5 px-4 rounded-lg bg-slate-950 hover:bg-slate-800 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {savingProfile ? 'Saving Profile...' : 'Save & Enter My Dashboard'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : authTab === 'signup' ? (
            /* Clean Registration Form matching user's reference picture */
            <div>
              <div className="mb-5">
                <h2
                  id="universal-login-title"
                  className="text-2xl font-bold text-slate-900 tracking-tight"
                >
                  Registration
                </h2>
                <div className="w-7 h-0.5 bg-amber-500 rounded-full mt-1" />
              </div>

              <form onSubmit={handleRegisterSubmit} className="space-y-3.5" noValidate>
                <div>
                  <input
                    type="text"
                    required
                    autoComplete="name"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-colors"
                  />
                </div>

                <div>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-colors"
                  />
                </div>

                <div className="relative">
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Create password"
                    className="w-full px-4 py-3 pr-11 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword((v) => !v)}
                    aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                  >
                    {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showRegConfirm ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    className="w-full px-4 py-3 pr-11 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegConfirm((v) => !v)}
                    aria-label={showRegConfirm ? 'Hide confirm password' : 'Show confirm password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                  >
                    {showRegConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <label className="flex items-center gap-2.5 pt-1 text-xs text-slate-600 select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-slate-950 focus:ring-slate-900 cursor-pointer"
                  />
                  <span>I accept all terms &amp; conditions</span>
                </label>

                <button
                  type="submit"
                  disabled={isSigningIn}
                  className="w-full py-3 px-4 rounded-lg bg-slate-950 hover:bg-slate-800 text-white font-semibold text-sm transition-colors shadow-xs cursor-pointer disabled:opacity-60"
                >
                  {isSigningIn ? 'Creating Account...' : 'Register Now'}
                </button>
              </form>

              <p className="mt-3 text-[11px] text-slate-500 text-center leading-relaxed">
                Roles and department permissions are assigned by Administration after signup.
              </p>

              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  or
                </span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <button
                type="button"
                disabled={isSigningIn}
                onClick={() => void onGoogleSignIn()}
                className="w-full py-2.5 px-4 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-semibold text-sm transition-colors flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
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
                Continue with Google
              </button>

              <p className="mt-5 text-center text-xs text-slate-600">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchTab('login')}
                  className="font-semibold text-amber-600 hover:text-amber-700 hover:underline cursor-pointer"
                >
                  Login now
                </button>
              </p>
            </div>
          ) : (
            /* Clean Login Form matching Registration visual language */
            <div>
              <div className="mb-5">
                <h2
                  id="universal-login-title"
                  className="text-2xl font-bold text-slate-900 tracking-tight"
                >
                  Login
                </h2>
                <div className="w-7 h-0.5 bg-amber-500 rounded-full mt-1" />
                <p className="text-xs text-slate-500 mt-2">
                  Sign in to open your assigned Auzio Traders dashboard automatically.
                </p>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-3.5" noValidate>
                <div>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-colors"
                  />
                </div>

                <div className="relative">
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full px-4 py-3 pr-11 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((v) => !v)}
                    aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                  >
                    {showLoginPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => void handleForgotPassword()}
                    disabled={isSigningIn}
                    className="text-xs font-medium text-amber-600 hover:text-amber-700 hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isSigningIn}
                  className="w-full py-3 px-4 rounded-lg bg-slate-950 hover:bg-slate-800 text-white font-semibold text-sm transition-colors shadow-xs cursor-pointer disabled:opacity-60"
                >
                  {isSigningIn ? 'Signing In...' : 'Login Now'}
                </button>
              </form>

              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  or
                </span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <button
                type="button"
                disabled={isSigningIn}
                onClick={() => void onGoogleSignIn()}
                className="w-full py-2.5 px-4 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-semibold text-sm transition-colors flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
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
                Continue with Google
              </button>

              <p className="mt-5 text-center text-xs text-slate-600">
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchTab('signup')}
                  className="font-semibold text-amber-600 hover:text-amber-700 hover:underline cursor-pointer"
                >
                  Register now
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
