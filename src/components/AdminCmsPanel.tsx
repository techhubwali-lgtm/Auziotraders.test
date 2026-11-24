import { CheckCircle2, Plus, Save, Star, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CustomerTestimonial, LandingPageContent } from '../types/portal';

interface AdminCmsPanelProps {
  landingContent: LandingPageContent;
  testimonials: CustomerTestimonial[];
  onSaveLandingContent: (next: LandingPageContent) => Promise<void>;
  onSaveTestimonial: (
    input: Omit<CustomerTestimonial, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => Promise<void>;
  onDeleteTestimonial: (id: string) => Promise<void>;
}

export function AdminCmsPanel({
  landingContent,
  testimonials,
  onSaveLandingContent,
  onSaveTestimonial,
  onDeleteTestimonial,
}: AdminCmsPanelProps) {
  const [draft, setDraft] = useState<LandingPageContent>(landingContent);
  const [savingCms, setSavingCms] = useState(false);

  // Testimonial composer
  const [revName, setRevName] = useState('');
  const [revCountry, setRevCountry] = useState('');
  const [revVehicle, setRevVehicle] = useState('');
  const [revPhotoUrl, setRevPhotoUrl] = useState('');
  const [revRating, setRevRating] = useState(5);
  const [revText, setRevText] = useState('');
  const [revApproved, setRevApproved] = useState(true);
  const [savingRev, setSavingRev] = useState(false);

  // FAQ composer
  const [newFaqQ, setNewFaqQ] = useState('');
  const [newFaqA, setNewFaqA] = useState('');

  useEffect(() => {
    setDraft(landingContent);
  }, [landingContent]);

  const handleSaveCms = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCms(true);
    try {
      await onSaveLandingContent(draft);
    } finally {
      setSavingCms(false);
    }
  };

  const handleAddTestimonial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revName.trim() || !revCountry.trim() || !revVehicle.trim() || !revText.trim()) return;
    setSavingRev(true);
    try {
      await onSaveTestimonial({
        customerName: revName.trim(),
        country: revCountry.trim(),
        vehiclePurchased: revVehicle.trim(),
        photoUrl: revPhotoUrl.trim(),
        rating: revRating,
        reviewText: revText.trim(),
        verified: true,
        approved: revApproved,
      });
      setRevName('');
      setRevCountry('');
      setRevVehicle('');
      setRevPhotoUrl('');
      setRevRating(5);
      setRevText('');
    } finally {
      setSavingRev(false);
    }
  };

  const handleAddFaq = () => {
    if (!newFaqQ.trim() || !newFaqA.trim()) return;
    setDraft((prev) => ({
      ...prev,
      faqs: [
        ...prev.faqs,
        {
          id: `faq-${Date.now()}`,
          question: newFaqQ.trim(),
          answer: newFaqA.trim(),
        },
      ],
    }));
    setNewFaqQ('');
    setNewFaqA('');
  };

  return (
    <div className="space-y-6">
      {/* 1. Landing Page CMS Editor */}
      <form
        onSubmit={handleSaveCms}
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-950">
              Public Landing Page CMS &amp; SEO Manager
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Changes publish live to the Auzio Traders homepage in Firestore.
            </p>
          </div>
          <button
            type="submit"
            disabled={savingCms}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer disabled:opacity-60"
          >
            <Save className="w-3.5 h-3.5 text-amber-400" />
            <span>{savingCms ? 'Publishing...' : 'Publish Landing Changes'}</span>
          </button>
        </div>

        {/* Promo Banner */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
          <label className="flex items-center gap-2 font-bold text-slate-900 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.promoBannerEnabled}
              onChange={(e) => setDraft({ ...draft, promoBannerEnabled: e.target.checked })}
              className="rounded border-slate-300"
            />
            <span>Enable Top Promotional Announcement Banner</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-medium text-slate-600 mb-1">Banner Message</label>
              <input
                type="text"
                value={draft.promoBannerText}
                onChange={(e) => setDraft({ ...draft, promoBannerText: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-600 mb-1">CTA Label</label>
              <input
                type="text"
                value={draft.promoBannerCtaLabel}
                onChange={(e) => setDraft({ ...draft, promoBannerCtaLabel: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              />
            </div>
          </div>
        </div>

        {/* Hero Section Copy */}
        <div className="space-y-3 text-xs">
          <h3 className="text-sm font-bold text-slate-950">Hero Section Content</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-600 mb-1">Main Headline (H1)</label>
              <input
                type="text"
                value={draft.heroHeadline}
                onChange={(e) => setDraft({ ...draft, heroHeadline: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-600 mb-1">Secondary Headline</label>
              <input
                type="text"
                value={draft.heroSecondaryHeadline}
                onChange={(e) => setDraft({ ...draft, heroSecondaryHeadline: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block font-medium text-slate-600 mb-1">Hero Description</label>
            <textarea
              rows={2}
              value={draft.heroDescription}
              onChange={(e) => setDraft({ ...draft, heroDescription: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-600 mb-1">
              Customer Problem &amp; Solution Copy
            </label>
            <textarea
              rows={3}
              value={draft.heroProblemSolution}
              onChange={(e) => setDraft({ ...draft, heroProblemSolution: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-600 mb-1">
              Hero Image URL (leave blank to use default Yokohama export visual)
            </label>
            <input
              type="text"
              value={draft.heroImageUrl}
              onChange={(e) => setDraft({ ...draft, heroImageUrl: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-[11px]"
            />
          </div>
        </div>

        {/* Company Statistics */}
        <div className="space-y-3 text-xs">
          <h3 className="text-sm font-bold text-slate-950">Company Statistics Strip</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {draft.stats.map((stat, idx) => (
              <div key={stat.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
                <input
                  type="text"
                  value={stat.label}
                  onChange={(e) => {
                    const next = [...draft.stats];
                    next[idx] = { ...stat, label: e.target.value };
                    setDraft({ ...draft, stats: next });
                  }}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-semibold"
                />
                {stat.value !== null ? (
                  <div className="grid grid-cols-3 gap-1.5">
                    <input
                      type="number"
                      value={stat.value}
                      onChange={(e) => {
                        const next = [...draft.stats];
                        next[idx] = { ...stat, value: Number(e.target.value) };
                        setDraft({ ...draft, stats: next });
                      }}
                      className="col-span-2 px-2.5 py-1.5 bg-white border border-slate-300 rounded font-mono"
                    />
                    <input
                      type="text"
                      value={stat.suffix}
                      onChange={(e) => {
                        const next = [...draft.stats];
                        next[idx] = { ...stat, suffix: e.target.value };
                        setDraft({ ...draft, stats: next });
                      }}
                      placeholder="+"
                      className="px-2 py-1.5 bg-white border border-slate-300 rounded font-mono"
                    />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={stat.displayText || ''}
                    onChange={(e) => {
                      const next = [...draft.stats];
                      next[idx] = { ...stat, displayText: e.target.value };
                      setDraft({ ...draft, stats: next });
                    }}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-mono"
                  />
                )}
                <input
                  type="text"
                  value={stat.sublabel}
                  onChange={(e) => {
                    const next = [...draft.stats];
                    next[idx] = { ...stat, sublabel: e.target.value };
                    setDraft({ ...draft, stats: next });
                  }}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-[11px]"
                />
              </div>
            ))}
          </div>
        </div>

        {/* About Section & Contact / Social / SEO */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-950">About Us Content</h3>
            <input
              type="text"
              value={draft.aboutHeadline}
              onChange={(e) => setDraft({ ...draft, aboutHeadline: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
            />
            <textarea
              rows={2}
              value={draft.aboutIntro}
              onChange={(e) => setDraft({ ...draft, aboutIntro: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
            <textarea
              rows={2}
              value={draft.aboutMission}
              onChange={(e) => setDraft({ ...draft, aboutMission: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-950">Contact Details &amp; SEO Metadata</h3>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={draft.contactPhone}
                onChange={(e) => setDraft({ ...draft, contactPhone: e.target.value })}
                placeholder="Phone"
                className="px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
              <input
                type="text"
                value={draft.contactEmail}
                onChange={(e) => setDraft({ ...draft, contactEmail: e.target.value })}
                placeholder="Email"
                className="px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <input
              type="text"
              value={draft.contactAddress}
              onChange={(e) => setDraft({ ...draft, contactAddress: e.target.value })}
              placeholder="Yokohama Office Address"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
            <input
              type="text"
              value={draft.seoTitle}
              onChange={(e) => setDraft({ ...draft, seoTitle: e.target.value })}
              placeholder="SEO Meta Title"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
            <textarea
              rows={2}
              value={draft.seoDescription}
              onChange={(e) => setDraft({ ...draft, seoDescription: e.target.value })}
              placeholder="SEO Meta Description"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        {/* Social Media Links */}
        <div className="space-y-2 text-xs">
          <h3 className="text-sm font-bold text-slate-950">Social Media Links</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {(['facebook', 'instagram', 'youtube', 'linkedin'] as const).map((net) => (
              <div key={net}>
                <label className="block font-medium text-slate-600 mb-1 capitalize">{net}</label>
                <input
                  type="url"
                  value={draft.socialLinks[net]}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      socialLinks: { ...draft.socialLinks, [net]: e.target.value },
                    })
                  }
                  placeholder={`https://${net}.com/...`}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            ))}
          </div>
        </div>

        {/* FAQ Manager */}
        <div className="space-y-3 text-xs border-t border-slate-200 pt-5">
          <h3 className="text-sm font-bold text-slate-950">FAQ Manager ({draft.faqs.length})</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {draft.faqs.map((faq, idx) => (
              <div
                key={faq.id}
                className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-start justify-between gap-3"
              >
                <div className="flex-1 space-y-1.5">
                  <input
                    type="text"
                    value={faq.question}
                    onChange={(e) => {
                      const next = [...draft.faqs];
                      next[idx] = { ...faq, question: e.target.value };
                      setDraft({ ...draft, faqs: next });
                    }}
                    className="w-full px-2.5 py-1 bg-white border border-slate-300 rounded font-semibold"
                  />
                  <textarea
                    rows={2}
                    value={faq.answer}
                    onChange={(e) => {
                      const next = [...draft.faqs];
                      next[idx] = { ...faq, answer: e.target.value };
                      setDraft({ ...draft, faqs: next });
                    }}
                    className="w-full px-2.5 py-1 bg-white border border-slate-300 rounded"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      faqs: draft.faqs.filter((f) => f.id !== faq.id),
                    })
                  }
                  aria-label="Remove FAQ"
                  className="p-1.5 text-slate-400 hover:text-red-700 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2">
            <input
              type="text"
              value={newFaqQ}
              onChange={(e) => setNewFaqQ(e.target.value)}
              placeholder="New FAQ question..."
              className="sm:col-span-4 px-3 py-2 border border-slate-300 rounded-lg"
            />
            <input
              type="text"
              value={newFaqA}
              onChange={(e) => setNewFaqA(e.target.value)}
              placeholder="New FAQ answer..."
              className="sm:col-span-6 px-3 py-2 border border-slate-300 rounded-lg"
            />
            <button
              type="button"
              onClick={handleAddFaq}
              className="sm:col-span-2 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add FAQ</span>
            </button>
          </div>
        </div>
      </form>

      {/* 2. Verified Customer Testimonials Manager */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div>
          <h2 className="text-base font-bold text-slate-950">
            Verified Customer Testimonials Manager
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Only approved real customer reviews added here appear publicly on the landing page.
          </p>
        </div>

        <form onSubmit={handleAddTestimonial} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
          <div className="font-bold text-slate-900">Publish New Verified Buyer Review</div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              type="text"
              required
              value={revName}
              onChange={(e) => setRevName(e.target.value)}
              placeholder="Customer Name *"
              className="px-3 py-2 bg-white border border-slate-300 rounded-lg"
            />
            <input
              type="text"
              required
              value={revCountry}
              onChange={(e) => setRevCountry(e.target.value)}
              placeholder="Country *"
              className="px-3 py-2 bg-white border border-slate-300 rounded-lg"
            />
            <input
              type="text"
              required
              value={revVehicle}
              onChange={(e) => setRevVehicle(e.target.value)}
              placeholder="Vehicle Purchased (e.g. 2019 Toyota Prado) *"
              className="px-3 py-2 bg-white border border-slate-300 rounded-lg"
            />
            <select
              value={revRating}
              onChange={(e) => setRevRating(Number(e.target.value))}
              className="px-3 py-2 bg-white border border-slate-300 rounded-lg"
            >
              <option value={5}>5 Stars</option>
              <option value={4}>4 Stars</option>
              <option value={3}>3 Stars</option>
              <option value={2}>2 Stars</option>
              <option value={1}>1 Star</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="url"
              value={revPhotoUrl}
              onChange={(e) => setRevPhotoUrl(e.target.value)}
              placeholder="Optional Customer / Delivery Photo URL"
              className="px-3 py-2 bg-white border border-slate-300 rounded-lg"
            />
            <input
              type="text"
              required
              value={revText}
              onChange={(e) => setRevText(e.target.value)}
              placeholder="Verified customer review text *"
              className="sm:col-span-2 px-3 py-2 bg-white border border-slate-300 rounded-lg"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={revApproved}
                onChange={(e) => setRevApproved(e.target.checked)}
              />
              <span>Approve &amp; display publicly immediately</span>
            </label>
            <button
              type="submit"
              disabled={savingRev}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-white font-bold cursor-pointer disabled:opacity-60"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>{savingRev ? 'Saving...' : 'Save Testimonial'}</span>
            </button>
          </div>
        </form>

        {testimonials.length === 0 ? (
          <div className="text-xs text-slate-500 py-4 text-center">
            No customer testimonials stored yet. Add verified buyer reviews above to display them on
            the homepage.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {testimonials.map((t) => (
              <div key={t.id} className="py-3 flex flex-wrap items-start justify-between gap-3 text-xs">
                <div className="space-y-1 max-w-2xl">
                  <div className="flex items-center gap-2 font-bold text-slate-950">
                    <span>{t.customerName}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-600">{t.country}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-amber-700">{t.vehiclePurchased}</span>
                  </div>
                  <div className="flex items-center gap-0.5 text-amber-500">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-amber-500" />
                    ))}
                  </div>
                  <p className="text-slate-600">{t.reviewText}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void onSaveTestimonial(
                        {
                          customerName: t.customerName,
                          country: t.country,
                          vehiclePurchased: t.vehiclePurchased,
                          photoUrl: t.photoUrl,
                          rating: t.rating,
                          reviewText: t.reviewText,
                          verified: t.verified,
                          approved: !t.approved,
                        },
                        t.id
                      )
                    }
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                      t.approved
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{t.approved ? 'Published' : 'Hidden (Click to Publish)'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDeleteTestimonial(t.id)}
                    aria-label="Delete testimonial"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
