import { ArrowUp, MessageCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

interface FloatingUtilitiesProps {
  whatsappPhone: string;
}

export function FloatingUtilities({ whatsappPhone }: FloatingUtilitiesProps) {
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setShowTop(window.scrollY > 420);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const sanitizedPhone = whatsappPhone.replace(/[^\d]/g, '');
  const whatsappHref = `https://wa.me/${sanitizedPhone}?text=${encodeURIComponent(
    'Hello Auzio Traders, I would like assistance with importing a Japanese vehicle.'
  )}`;

  const scrollToTop = () => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: prefersReduced ? 'auto' : 'smooth' });
  };

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2.5 no-print">
      {showTop && (
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="Back to top"
          className="w-10 h-10 rounded-full bg-slate-900/90 hover:bg-slate-950 text-white border border-slate-700 shadow-lg flex items-center justify-center transition-transform hover:-translate-y-0.5 cursor-pointer"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      )}
      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with Auzio Traders on WhatsApp"
        className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-lg transition-transform hover:-translate-y-0.5"
      >
        <MessageCircle className="w-4 h-4 shrink-0" />
        <span className="hidden sm:inline">WhatsApp Desk</span>
      </a>
    </div>
  );
}
