import heroExportYardImg from '../assets/images/hero_japan_export_yard_1795523967591.jpg';
import serviceAuctionLaneImg from '../assets/images/service_japan_auction_lane_1795523969638.jpg';
import serviceInspectionImg from '../assets/images/service_vehicle_inspection_1795523968408.jpg';
import serviceOceanShippingImg from '../assets/images/service_ocean_roro_shipping_1795523967885.jpg';
import type { LandingPageContent } from '../types/portal';

export const OFFICIAL_LOGO_URL = '/assets/aistudio/Auzio_Traders_Logo_0425918c.jpeg';

export const LANDING_MEDIA = {
  yard: heroExportYardImg,
  auction: serviceAuctionLaneImg,
  inspection: serviceInspectionImg,
  shipping: serviceOceanShippingImg,
} as const;

export const WHY_CHOOSE_ITEMS = [
  {
    id: 'direct-auctions',
    title: 'Direct Access to Japanese Auctions',
    description:
      'Access live vehicle listings directly from major Japanese auto auctions across USS, TAA, HAA, JU, and ARAI venues.',
  },
  {
    id: 'verified-inspections',
    title: 'Verified Vehicle Inspections',
    description:
      'Clear inspection sheets, translated auction remarks, mileage verification, and JEVIC / QISJ pre-shipment checks.',
  },
  {
    id: 'transparent-pricing',
    title: 'Transparent Pricing & Cost Breakdown',
    description:
      'Clear FOB, CIF, inspection, and ocean freight cost structures with zero hidden fees or surprise destination add-ons.',
  },
  {
    id: 'worldwide-shipping',
    title: 'Worldwide Shipping Solutions',
    description:
      'Reliable Ro-Ro and dedicated container shipping from Yokohama, Nagoya, Kobe, Osaka, and Hakata to major global ports.',
  },
  {
    id: 'dedicated-support',
    title: 'Dedicated Customer & Dealer Support',
    description:
      'Step-by-step guidance from vehicle sourcing and Max Bid Ceiling approval to customs documentation and port arrival.',
  },
  {
    id: 'real-time-tracking',
    title: 'Real-Time Order & Shipment Tracking',
    description:
      'Stay updated at every milestone from auction purchase and export yard arrival to vessel booking, Bill of Lading, and ETA.',
  },
];

export const PROCESS_STEPS = [
  {
    step: '01',
    title: 'Search and Select',
    description:
      'Browse available stock, explore live Japanese auctions, or submit a custom vehicle sourcing request.',
  },
  {
    step: '02',
    title: 'Purchase and Auction',
    description:
      'Receive transparent CIF pricing, approve your quotation and Max Bid Ceiling, and complete vehicle purchase or bidding.',
  },
  {
    step: '03',
    title: 'Vehicle Inspection',
    description:
      'Review auction grades, verified odometer reports, pre-export yard photos, and mandatory destination inspections.',
  },
  {
    step: '04',
    title: 'International Shipping',
    description:
      'We coordinate Japanese export deregistration, customs clearance, Ro-Ro or container vessel booking, and DHL documentation.',
  },
  {
    step: '05',
    title: 'Track Your Vehicle',
    description:
      'Follow your vehicle shipment across 14 live trade milestones until vessel discharge at your destination port.',
  },
];

export const DEFAULT_LANDING_CONTENT: LandingPageContent = {
  promoBannerEnabled: false,
  promoBannerText:
    'Live Japanese Auction Desk Active — Weekly Yokohama, Nagoya & Kobe Ro-Ro Departures Worldwide.',
  promoBannerCtaLabel: 'Explore Live Auctions',
  heroHeadline: 'Your Trusted Partner in Japanese Used Car Exports',
  heroSecondaryHeadline: 'Find. Buy. Ship. Worldwide.',
  heroDescription:
    'Discover quality Japanese used vehicles, access live Japanese car auctions and experience a transparent vehicle purchasing, inspection and international shipping process with Auzio Traders.',
  heroProblemSolution:
    'Buying a vehicle from overseas can feel complicated. Hidden costs, unreliable sellers and unclear shipping procedures create uncertainty. Auzio Traders solves these challenges by providing verified Japanese vehicle stock, direct access to Japanese auto auctions, clear FOB and CIF pricing, inspection support, export documentation and reliable international shipping to ports around the world.',
  heroImageUrl: heroExportYardImg,
  stats: [
    {
      id: 'cars-exported',
      value: 8126,
      suffix: '+',
      label: 'Cars Exported',
      sublabel: 'Delivered from Japanese ports worldwide',
    },
    {
      id: 'countries-served',
      value: 13,
      suffix: '+',
      label: 'Countries Served',
      sublabel: 'Active Ro-Ro & container corridors',
    },
    {
      id: 'years-experience',
      value: 4,
      suffix: '+',
      label: 'Years of Experience',
      sublabel: 'Licensed Yokohama export operations',
    },
    {
      id: 'auction-access',
      value: null,
      suffix: '',
      displayText: 'Direct',
      label: 'Japanese Auction Access',
      sublabel: 'Live USS, TAA, HAA, JU & ARAI lanes',
    },
  ],
  services: [
    {
      id: 'used-car-export',
      title: 'Japanese Used Car Export',
      description:
        'Direct export of inspected Japanese sedans, SUVs, hybrids, pickups, and commercial vans straight from our Yokohama, Nagoya, Kobe, and Osaka export yards.',
      ctaLabel: 'Browse Stock',
      ctaTarget: 'catalog',
      imageKey: 'yard',
    },
    {
      id: 'live-japanese-auctions',
      title: 'Live Japanese Car Auctions',
      description:
        'Search live Japanese auto auction lots in real time with translated inspection sheets, JPY-to-CIF estimates, and strict customer-authorized Max Bid Ceilings.',
      ctaLabel: 'Explore Live Auctions',
      ctaTarget: 'live_auctions',
      imageKey: 'auction',
    },
    {
      id: 'vehicle-sourcing',
      title: 'Vehicle Sourcing',
      description:
        'Looking for a specific chassis code, trim, mileage limit, or auction grade? Our Yokohama buyers shortlist matching Japanese vehicles tailored to your exact budget.',
      ctaLabel: 'Request a Vehicle',
      ctaTarget: 'sourcing',
      imageKey: 'auction',
    },
    {
      id: 'vehicle-purchasing',
      title: 'Vehicle Purchasing',
      description:
        'Secure purchasing backed by itemized Proforma Invoices, verified Sumitomo Mitsui Banking Corporation (SMBC Tokyo) Telegraphic Transfer instructions, and trade audit logs.',
      ctaLabel: 'How to Buy',
      ctaTarget: 'how_to_buy',
      imageKey: 'yard',
    },
    {
      id: 'vehicle-inspection',
      title: 'Vehicle Inspection',
      description:
        'Every export unit undergoes verified odometer checks, auction sheet translation, and destination-mandated JEVIC, QISJ, EAA, MPI, or DAFF biosecurity inspections.',
      ctaLabel: 'Learn Our Process',
      ctaTarget: 'how_to_buy',
      imageKey: 'inspection',
    },
    {
      id: 'international-shipping',
      title: 'International Shipping',
      description:
        'Scheduled Ro-Ro car carriers and 20ft/40ft container loading from major Japanese export ports to East & Southern Africa, Oceania, the Caribbean, UK, and Middle East.',
      ctaLabel: 'Check Shipping Routes',
      ctaTarget: 'shipping',
      imageKey: 'shipping',
    },
    {
      id: 'export-documentation',
      title: 'Export Documentation',
      description:
        'Complete handling of Export Certificates, English translations, Commercial Invoices, Inspection Certificates, and Original Bills of Lading dispatched via DHL Express.',
      ctaLabel: 'Contact Export Desk',
      ctaTarget: 'contact',
      imageKey: 'inspection',
    },
    {
      id: 'dealer-wholesale',
      title: 'Dealer and Wholesale Solutions',
      description:
        'Dedicated account coordinators, multi-unit container consolidation, wholesale auction access, and transparent pipeline tracking for international dealerships and fleet buyers.',
      ctaLabel: 'Partner With Us',
      ctaTarget: 'contact',
      imageKey: 'shipping',
    },
  ],
  aboutHeadline: 'Built in Japan for Transparent Global Automotive Trade',
  aboutIntro:
    'Auzio Traders is a Yokohama-headquartered Japanese vehicle export company connecting individual buyers, corporate fleets, and automotive dealerships worldwide directly with Japan’s cleanest used vehicle inventory and live auto auctions.',
  aboutMission:
    'Our mission is to eliminate uncertainty from cross-border vehicle purchasing by combining direct Japanese auction access, thorough pre-shipment verification, honest FOB and CIF pricing, and accountable end-to-end maritime logistics.',
  aboutTransparency:
    'From your initial sourcing request and Max Bid Ceiling approval to SMBC Tokyo wire settlement, JEVIC/QISJ inspection, and original Bill of Lading delivery, every step is documented and visible inside your dedicated Auzio Traders portal.',
  aboutImageUrl: serviceInspectionImg,
  faqs: [
    {
      id: 'faq-how-to-buy',
      question: 'How do I buy a vehicle from Auzio Traders?',
      answer:
        'Select an available stock vehicle or live Japanese auction lot, choose your destination country and port to calculate CIF costs, and request a Proforma Invoice or submit a custom sourcing request. Once you approve the quotation and settle payment via official Bank Telegraphic Transfer, we handle inspection, Japanese export customs, and ocean shipping.',
    },
    {
      id: 'faq-payment-methods',
      question: 'What payment methods do you accept?',
      answer:
        'All international vehicle purchases and auction deposits are settled via official Bank Telegraphic Transfer (TT) directly to our corporate account at Sumitomo Mitsui Banking Corporation (SMBC) in Japan, referencing your Proforma Invoice number. Original transaction amounts are invoiced in USD for accounting accuracy.',
    },
    {
      id: 'faq-fob-vs-cif',
      question: 'What is the difference between FOB and CIF pricing?',
      answer:
        'FOB (Free on Board) covers the vehicle price, Japanese inland transport, and export customs clearance up to loading at the Japanese departure port. CIF (Cost, Insurance, and Freight) includes FOB plus ocean freight (Ro-Ro or container), mandatory pre-shipment inspection (such as QISJ, JEVIC, or DAFF), and optional marine transit insurance to your destination port.',
    },
    {
      id: 'faq-inspections',
      question: 'Are vehicles inspected before shipping?',
      answer:
        'Yes. In addition to independent Japanese auction inspection sheets and odometer verification, we arrange every destination-mandated pre-shipment inspection—including QISJ for Kenya, EAA/TBS for Tanzania, JEVIC for Uganda, Zambia, Zimbabwe, South Africa, and New Zealand, and DAFF biosecurity cleaning for Australia.',
    },
    {
      id: 'faq-live-auctions',
      question: 'Can I participate in live Japanese car auctions?',
      answer:
        'Yes. You can browse live Japanese auction lots directly in our Live Auctions catalog, review translated auction grades and lot details, and submit an authorized Max Bid Ceiling. Our licensed Yokohama auction buyers never bid above your written ceiling.',
    },
    {
      id: 'faq-shipping-time',
      question: 'How long does international shipping take?',
      answer:
        'Transit time depends on your destination port and vessel schedule. Typical sea transit from Japan is 12–19 days to Australia and New Zealand, 18–24 days to UAE (Jebel Ali), 24–35 days to East and Southern Africa (Mombasa, Dar es Salaam, Durban), and 30–44 days to the Caribbean and United Kingdom.',
    },
    {
      id: 'faq-track-order',
      question: 'How can I track my order and shipment?',
      answer:
        'Every confirmed inquiry and export order receives an official tracking code (e.g., AUZ-2026-XXXX). Enter your code in our Track Order page—or sign in to your Customer/Dealer Portal—to monitor all 14 milestones including vessel name, voyage number, ETD/ETA, and downloadable export documents.',
    },
    {
      id: 'faq-dealers-bulk',
      question: 'Do you work with car dealers and bulk buyers?',
      answer:
        'Yes. Auzio Traders supports international automotive dealers and fleet importers with wholesale auction access, multi-vehicle 40ft container consolidation, dedicated sales coordinators, and unified order & document management.',
    },
    {
      id: 'faq-custom-request',
      question: 'Can I request a specific vehicle not currently listed?',
      answer:
        'Absolutely. Use our "Request a Vehicle" sourcing wizard to specify your desired make, model, manufacturing years, maximum mileage, auction grade, steering type, and target budget. Our buyers in Japan will shortlist live auction and partner-yard options for your review.',
    },
  ],
  contactPhone: '+81-45-550-8924',
  contactWhatsapp: '+81-45-550-8924',
  contactEmail: 'export@auziotraders.com',
  contactAddress: '2-14-8 Daikoku-futo, Tsurumi-ku, Yokohama, Kanagawa 230-0054, Japan',
  socialLinks: {
    facebook: 'https://www.facebook.com/auziotraders',
    instagram: 'https://www.instagram.com/auziotraders',
    youtube: 'https://www.youtube.com/@auziotraders',
    linkedin: 'https://www.linkedin.com/company/auziotraders',
  },
  seoTitle: 'Japanese Used Cars & Live Car Auctions | Auzio Traders',
  seoDescription:
    'Explore Japanese used cars, live car auctions, vehicle sourcing, inspection and international shipping services with Auzio Traders.',
};
