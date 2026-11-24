import type { User } from 'firebase/auth';
import {
  AlertTriangle,
  Building2,
  Loader2,
  Lock,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { GLOBAL_PORTS } from '../data/ports';
import { registerCustomerProfile } from '../services/firestoreService';
import type { LoginPortalType, UserProfile, UserRole } from '../types/portal';

interface DualLoginModalProps {
  portalType: LoginPortalType;
  firebaseUser: User | null;
  needsCustomerRegistration: boolean;
  crossPortalError: string;
  onGoogleSignIn: (portal: LoginPortalType) => Promise<void>;
  onRegistrationComplete: (profile: UserProfile) => void;
  onSelectDemoRole: (role: UserRole, demoCustomerId?: string) => void;
  onClose: () => void;
}

export function DualLoginModal({
  portalType,
  firebaseUser,
  needsCustomerRegistration,
  crossPortalError,
  onGoogleSignIn,
  onRegistrationComplete,
  onSelectDemoRole,
  onClose,
}: DualLoginModalProps) {
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState('');

  // Dealer registration fields for newly authenticated Google customers
  const [displayName, setDisplayName] = useState(firebaseUser?.displayName || '');
  const [companyName, setCompanyName] = useState('');
  const [country, setCountry] = useState('Kenya');
  const [defaultPortId, setDefaultPortId] = useState('mombasa-ke');
  const [phone, setPhone] = useState('');
  const [consigneeAddress, setConsigneeAddress] = useState('');
  const [registering, setRegistering] = useState(false);

  const isCustomerPortal = portalType === 'customer';

  const handleSignInClick = async () => {
    setError('');
    setSigningIn(true);
    try {
      await onGoogleSignIn(portalType);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Google sign-in popup was cancelled or blocked.'
      );
    } finally {
      setSigningIn(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    setError('');
    if (displayName.trim().length < 2 || companyName.trim().length < 2) {
      setError('Please enter your name and dealership/importer name.');
      return;
    }
    setRegistering(true);
    try {
      const profile = await registerCustomerProfile({
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName,
        companyName,
        country,
        defaultPortId,
        phone,
        consigneeAddress,
      });
      onRegistrationComplete(profile);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not save dealer registration. Please try again.'
      );
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs overflow-y-auto p-4 sm:p-6 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={
        isCustomerPortal
          ? 'Customer and Dealer Login Portal'
          : 'Management, Staff and Admin Login Portal'
      }
    >
      <div className="w-full max-w-lg bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden">
        <div
          className={`px-6 py-4 text-white flex items-center justify-between ${
            isCustomerPortal ? 'bg-slate-900' : 'bg-slate-950 border-b border-amber-500/40'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {isCustomerPortal ? (
              <Building2 className="w-5 h-5 text-amber-400 shrink-0" />
            ) : (
              <Lock className="w-5 h-5 text-amber-400 shrink-0" />
            )}
            <div>
              <h2 className="text-base font-semibold">
                {isCustomerPortal
                  ? 'Customer / Dealer Login & Registration'
                  : 'Management / Staff / Admin Portal'}
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                {isCustomerPortal
                  ? 'For overseas automotive dealers & verified importers'
                  : 'Restricted to authorized AUZIO TRADERS Sales, Operations & Admin staff'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close login modal"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {(crossPortalError || error) && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3.5 flex items-start gap-2.5 text-xs text-red-800">
              <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
              <span>{crossPortalError || error}</span>
            </div>
          )}

          {isCustomerPortal && needsCustomerRegistration && firebaseUser ? (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700">
                Signed in as{' '}
                <span className="font-mono font-semibold text-slate-950">
                  {firebaseUser.email}
                </span>
                . Complete your dealer consignee profile to activate your portal.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Dealership / Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Nairobi Auto Imports Ltd."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Default Discharge Port *
                  </label>
                  <select
                    value={defaultPortId}
                    onChange={(e) => {
                      setDefaultPortId(e.target.value);
                      const p = GLOBAL_PORTS.find((x) => x.id === e.target.value);
                      if (p) setCountry(p.country);
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  >
                    {GLOBAL_PORTS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.country})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    WhatsApp / Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+254 712 000 000"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Consignee / Billing Address *
                </label>
                <input
                  type="text"
                  required
                  value={consigneeAddress}
                  onChange={(e) => setConsigneeAddress(e.target.value)}
                  placeholder="Street, Plot / Industrial Area, City, Country"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <button
                type="submit"
                disabled={registering}
                className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
              >
                {registering && <Loader2 className="w-4 h-4 animate-spin" />}
                Complete Dealer Registration
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="text-xs text-slate-600 leading-relaxed space-y-2">
                {isCustomerPortal ? (
                  <p>
                    Sign in with Google to access your dealership profile, submit guided auction
                    sourcing requests, authorize maximum bid limits, track 14-stage orders, and
                    download verified export documents.
                  </p>
                ) : (
                  <p>
                    Sign in with an authorized AUZIO TRADERS staff or administrator Google
                    account. Customer/Dealer accounts attempting to sign in here are strictly
                    blocked.
                  </p>
                )}
              </div>

              <button
                type="button"
                disabled={signingIn}
                onClick={() => void handleSignInClick()}
                className="w-full py-3 px-4 text-sm font-semibold text-white bg-slate-950 rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {signingIn && <Loader2 className="w-4 h-4 animate-spin" />}
                {isCustomerPortal
                  ? 'Continue with Google (Dealer Account)'
                  : 'Sign In with Google (Staff / Admin)'}
              </button>

              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  Backed by Firebase Authentication & server-enforced Firestore RBAC rules.
                </span>
              </div>
            </div>
          )}

          {/* Optional Quick-Demo Role Switcher for immediate testing */}
          <div className="pt-4 border-t border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-amber-700" />
                Quick-Demo Role Switcher (Testing)
              </span>
              <span className="text-[11px] text-slate-500">Instant preview</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {isCustomerPortal ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectDemoRole('customer', 'cust-kenya-01');
                      onClose();
                    }}
                    className="px-3 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg text-left cursor-pointer"
                  >
                    <div className="font-semibold">Kenya Dealer</div>
                    <div className="text-[10px] text-slate-500 truncate">Nairobi Premier</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectDemoRole('customer', 'cust-zambia-02');
                      onClose();
                    }}
                    className="px-3 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg text-left cursor-pointer"
                  >
                    <div className="font-semibold">Zambia Dealer</div>
                    <div className="text-[10px] text-slate-500 truncate">Lusaka Drive Auto</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectDemoRole('visitor');
                      onClose();
                    }}
                    className="px-3 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg text-left cursor-pointer"
                  >
                    <div className="font-semibold">Public Visitor</div>
                    <div className="text-[10px] text-slate-500 truncate">Browse & CIF only</div>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectDemoRole('sales');
                      onClose();
                    }}
                    className="px-3 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg text-left cursor-pointer"
                  >
                    <div className="font-semibold">Sales Staff</div>
                    <div className="text-[10px] text-slate-500 truncate">Quotes & Sourcing</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectDemoRole('operations');
                      onClose();
                    }}
                    className="px-3 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg text-left cursor-pointer"
                  >
                    <div className="font-semibold">Operations Staff</div>
                    <div className="text-[10px] text-slate-500 truncate">Logistics & Docs</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectDemoRole('admin');
                      onClose();
                    }}
                    className="px-3 py-2 text-xs font-medium text-slate-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg text-left cursor-pointer"
                  >
                    <div className="font-semibold text-amber-950">Administrator</div>
                    <div className="text-[10px] text-amber-800 truncate">Full Control & Audit</div>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
