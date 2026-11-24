/**
 * Structured UI copy dictionary prepared for future multi-language localization.
 */
export const EN_COPY = {
  brandName: 'AUZIO TRADERS',
  brandOrigin: 'Yokohama, Japan',
  nav: {
    browseStock: 'Browse Stock',
    shippingRates: 'Shipping Rates',
    howToBuy: 'How to Buy',
    trackOrder: 'Track Order',
    dealerPortal: 'Dealer Portal',
    staffConsole: 'Staff Console',
    customerLogin: 'Dealer Login',
    staffLogin: 'Staff / Admin Login',
  },
  transparency: {
    title: 'Platform & Workflow Status',
    subtitle: 'Transparent disclosure of how AUZIO TRADERS operates live trade workflows.',
    auctionNotice:
      'Japanese auto auction listings (USS, TAA, CAA, HAA) operate as staff-managed sourcing and bidding workflows rather than automated direct auction API feeds. Auction listings are marked as Not Yet Purchased and remain subject to live auction outcomes and prior sale.',
    vesselNotice:
      'Ro-Ro and container carrier schedules (Vessel Name, Voyage #, ETD/ETA, Bill of Lading) are entered and verified by our Yokohama Operations Desk upon carrier booking confirmation.',
    paymentNotice:
      'All export payments are settled exclusively via official Bank Telegraphic Transfer (TT) against a signed AUZIO TRADERS Proforma Invoice to our Sumitomo Mitsui Banking Corporation (SMBC) Tokyo account. We do not process card checkouts.',
  },
  listingTypes: {
    auzio_stock: {
      label: 'Auzio Physical Stock',
      shortLabel: 'Physical Stock',
      note: 'Owned and inspected in our Yokohama / Kobe export compound. Ready for immediate Proforma Invoice.',
    },
    auction_listing: {
      label: 'Auction Listing — Not Yet Purchased',
      shortLabel: 'Auction Listing',
      note: 'Subject to live Japanese auction bidding outcome and prior sale. Requires customer Maximum Bid Ceiling authorization.',
    },
    partner_stock: {
      label: 'Supplier / Partner Stock',
      shortLabel: 'Partner Stock',
      note: 'Available via vetted Japanese domestic dealer network; stock confirmation completed within 4 business hours.',
    },
  },
  legal: {
    maxBidClause:
      'I authorize AUZIO TRADERS to source and bid on my behalf strictly up to my stated Maximum Bid Ceiling. I understand auction units are subject to live auction outcome and final settlement requires Bank TT payment against an official Proforma Invoice.',
  },
} as const;
