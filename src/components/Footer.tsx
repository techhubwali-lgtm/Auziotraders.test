import { Facebook, Instagram, Linkedin, Mail, MapPin, MessageCircle, Phone, Youtube } from 'lucide-react';
import { OFFICIAL_LOGO_URL } from '../data/landingDefaults';
import type { AppView, LandingPageContent } from '../types/portal';
import type { LegalPolicyType } from './LegalPolicyModal';

interface FooterProps {
  landingContent: LandingPageContent;
  onNavigateView: (
    view: AppView,
    opts?: { sourceMode?: 'curated' | 'live_auctions'; anchor?: string }
  ) => void;
  onOpenPolicy: (policy: LegalPolicyType) => void;
}

export function Footer({ landingContent, onNavigateView, onOpenPolicy }: FooterProps) {
  const year = new Date().getFullYear();
  const sanitizedWa = landingContent.contactWhatsapp.replace(/[^\d]/g, '');

  return (
    <footer className="bg-slate-950 text-slate-300 border-t border-slate-800 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Column 1: Company Info & Official Logo */}
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => onNavigateView('home')}
              className="flex items-center gap-3 text-left cursor-pointer group"
            >
              <img
                src={OFFICIAL_LOGO_URL}
                alt="Auzio Traders official logo"
                className="w-12 h-12 rounded-full object-cover bg-white ring-2 ring-slate-800 group-hover:ring-amber-500/60 transition-all"
              />
              <div>
                <div className="text-base font-extrabold tracking-tight text-white">
                  AUZIO <span className="text-amber-500">TRADERS</span>
                </div>
                <div className="text-[11px] uppercase tracking-wider text-slate-400">
                  Find. Buy. Ship. Worldwide.
                </div>
              </div>
            </button>
            <p className="text-xs text-slate-400 leading-relaxed">
              Yokohama-headquartered Japanese used vehicle export platform providing verified stock,
              direct Japanese auto auction access, pre-shipment inspection coordination, and
              worldwide Ro-Ro &amp; container shipping.
            </p>
            <div className="flex items-center gap-2.5 pt-1">
              {landingContent.socialLinks.facebook && (
                <a
                  href={landingContent.socialLinks.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Auzio Traders on Facebook"
                  className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-500 text-slate-400 hover:text-amber-400 flex items-center justify-center transition-colors"
                >
                  <Facebook className="w-4 h-4" />
                </a>
              )}
              {landingContent.socialLinks.instagram && (
                <a
                  href={landingContent.socialLinks.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Auzio Traders on Instagram"
                  className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-500 text-slate-400 hover:text-amber-400 flex items-center justify-center transition-colors"
                >
                  <Instagram className="w-4 h-4" />
                </a>
              )}
              {landingContent.socialLinks.youtube && (
                <a
                  href={landingContent.socialLinks.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Auzio Traders on YouTube"
                  className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-500 text-slate-400 hover:text-amber-400 flex items-center justify-center transition-colors"
                >
                  <Youtube className="w-4 h-4" />
                </a>
              )}
              {landingContent.socialLinks.linkedin && (
                <a
                  href={landingContent.socialLinks.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Auzio Traders on LinkedIn"
                  className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-500 text-slate-400 hover:text-amber-400 flex items-center justify-center transition-colors"
                >
                  <Linkedin className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white mb-4">
              Quick Links
            </h3>
            <ul className="space-y-2.5 text-xs">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigateView('home')}
                  className="text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
                >
                  Home
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() =>
                    onNavigateView('home', { sourceMode: 'curated', anchor: 'vehicle-catalog' })
                  }
                  className="text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
                >
                  Browse Available Stock
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() =>
                    onNavigateView('home', {
                      sourceMode: 'live_auctions',
                      anchor: 'vehicle-catalog',
                    })
                  }
                  className="text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
                >
                  Live Japanese Auctions
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigateView('how_to_buy', { anchor: 'how-to-buy' })}
                  className="text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
                >
                  How to Buy
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigateView('how_to_buy', { anchor: 'about' })}
                  className="text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
                >
                  About Auzio Traders
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigateView('shipping')}
                  className="text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
                >
                  Global Shipping Network
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigateView('track')}
                  className="text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
                >
                  Track Your Order
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigateView('how_to_buy', { anchor: 'faq' })}
                  className="text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
                >
                  Frequently Asked Questions
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3: Our Services */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white mb-4">
              Our Services
            </h3>
            <ul className="space-y-2.5 text-xs">
              {landingContent.services.slice(0, 8).map((svc) => (
                <li key={svc.id}>
                  <button
                    type="button"
                    onClick={() => onNavigateView('how_to_buy', { anchor: 'services' })}
                    className="text-slate-400 hover:text-amber-400 transition-colors cursor-pointer text-left"
                  >
                    {svc.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Contact Us */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white mb-4">
              Contact Us
            </h3>
            <ul className="space-y-3 text-xs text-slate-400">
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{landingContent.contactAddress}</span>
              </li>
              <li>
                <a
                  href={`tel:${landingContent.contactPhone.replace(/\s+/g, '')}`}
                  className="flex items-center gap-2.5 hover:text-amber-400 transition-colors"
                >
                  <Phone className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="font-mono">{landingContent.contactPhone}</span>
                </a>
              </li>
              <li>
                <a
                  href={`https://wa.me/${sanitizedWa}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 hover:text-emerald-400 transition-colors"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>WhatsApp: {landingContent.contactWhatsapp}</span>
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${landingContent.contactEmail}`}
                  className="flex items-center gap-2.5 hover:text-amber-400 transition-colors"
                >
                  <Mail className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>{landingContent.contactEmail}</span>
                </a>
              </li>
            </ul>
            <div className="mt-4 pt-4 border-t border-slate-800 text-[11px] text-slate-500">
              Yokohama Export Desk · Mon–Sat 09:00–18:00 JST
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Legal Bar */}
      <div className="border-t border-slate-800/80 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            &copy; {year} Auzio Traders Co., Ltd. All rights reserved.
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <button
              type="button"
              onClick={() => onOpenPolicy('privacy')}
              className="hover:text-slate-200 transition-colors cursor-pointer"
            >
              Privacy Policy
            </button>
            <button
              type="button"
              onClick={() => onOpenPolicy('terms')}
              className="hover:text-slate-200 transition-colors cursor-pointer"
            >
              Terms and Conditions
            </button>
            <button
              type="button"
              onClick={() => onOpenPolicy('shipping')}
              className="hover:text-slate-200 transition-colors cursor-pointer"
            >
              Shipping Policy
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
