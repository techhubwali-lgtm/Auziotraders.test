import { Check, ChevronDown, Search } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

export interface SearchableOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  badgeTone?: 'verified' | 'neutral';
  searchText?: string;
}

interface SearchableSelectProps {
  value: string;
  options: SearchableOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  ariaLabel: string;
  variant?: 'dark' | 'light';
  align?: 'left' | 'right';
  triggerPrefix?: string;
  footerNote?: ReactNode;
  compact?: boolean;
}

export function SearchableSelect({
  value,
  options,
  onChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  ariaLabel,
  variant = 'light',
  align = 'left',
  triggerPrefix,
  footerNote,
  compact = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => options.find((opt) => opt.value === value) || null,
    [options, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => {
      const hay = `${opt.label} ${opt.sublabel || ''} ${opt.value} ${opt.searchText || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 30);

    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  const isDark = variant === 'dark';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={`flex items-center justify-between gap-1.5 rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
          compact ? 'px-2.5 py-1 text-xs' : 'w-full px-3 py-2 text-sm'
        } ${
          isDark
            ? 'bg-slate-800/90 border-slate-700 text-slate-100 hover:bg-slate-800 hover:border-slate-500'
            : 'bg-white border-slate-300 text-slate-900 hover:border-slate-400'
        }`}
      >
        <span className="truncate max-w-[175px] font-medium">
          {triggerPrefix && (
            <span className={isDark ? 'text-slate-400 mr-1 font-normal' : 'text-slate-500 mr-1 font-normal'}>
              {triggerPrefix}
            </span>
          )}
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 transition-transform ${
            open ? 'rotate-180' : ''
          } ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
        />
      </button>

      {open && (
        <div
          className={`absolute z-[90] mt-1.5 w-72 sm:w-80 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden text-slate-900 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <div className="p-2 border-b border-slate-100 bg-slate-50">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <div className="px-3 py-5 text-center text-xs text-slate-500">
                No matching options found.
              </div>
            ) : (
              filtered.map((opt) => {
                const active = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                      setQuery('');
                    }}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      active
                        ? 'bg-amber-50 text-slate-950'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate flex items-center gap-1.5">
                        <span className="truncate">{opt.label}</span>
                        {opt.badge && (
                          <span
                            className={`text-[10px] font-semibold shrink-0 ${
                              opt.badgeTone === 'verified'
                                ? 'text-emerald-700'
                                : 'text-slate-500'
                            }`}
                          >
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {opt.sublabel && (
                        <div className="text-[11px] text-slate-500 truncate">{opt.sublabel}</div>
                      )}
                    </div>
                    {active && <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          {footerNote && (
            <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 leading-snug">
              {footerNote}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
