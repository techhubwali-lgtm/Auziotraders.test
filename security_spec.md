# Auzio Traders — Firestore Security Specification (Phase 0)

## 1. Data Invariants

1. **Admin Authority Invariant**: Only verified administrators (`request.auth != null && request.auth.token.email_verified == true` matching the bootstrapped owner email or registered in `/admins/{uid}`) may create, modify, or delete `/vehicles`, `/companySettings`, `/admins`, or read/modify `/inquiries`.
2. **PII Isolation Invariant**: Buyer contact information (`buyerName`, `buyerEmail`, `buyerPhone`, `buyerCountry`, `message`) is strictly stored in `/inquiries/{inquiryId}` and can NEVER be read (`get` or `list`) by unauthenticated or non-admin users.
3. **Public Non-PII Tracking Invariant**: `/orderStatus/{trackingCode}` contains strictly non-PII milestone summary fields and permits `get` only by exact valid `trackingCode`; `list` is restricted to admins to prevent enumeration.
4. **Atomic Creation Invariant**: Creating a buyer inquiry in `/inquiries/{inquiryId}` MUST atomically create the paired `/orderStatus/{trackingCode}` document in the same batch (`existsAfter`), and vice versa.
5. **Reference Integrity Invariant**: Buyer inquiries must reference either an existing `/vehicles/{vehicleId}` document or the explicit `'GENERAL'` sourcing sentinel.
6. **Temporal & Immutability Invariant**: `createdAt` must equal `request.time` on creation and never change on update; `updatedAt` must equal `request.time` on create and update; `trackingCode` and `inquiryId` are immutable after creation.
7. **Volumetric Guard Invariant**: Every document ID matches `^[a-zA-Z0-9_-]+$` (`<= 128` chars), every string enforces explicit min/max length bounds, and every array enforces a strict maximum item count.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Unverified Admin Spoof**: Attempt `/vehicles` write with matching email but `email_verified: false` -> `PERMISSION_DENIED`.
2. **Shadow Field Injection**: Create `/inquiries` document containing an extra undeclared field `isApproved: true` -> `PERMISSION_DENIED`.
3. **PII Blanket Read**: Unauthenticated or non-admin `get` or `list` on `/inquiries/{id}` -> `PERMISSION_DENIED`.
4. **OrderStatus Enumeration**: Unauthenticated `list` query on `/orderStatus` -> `PERMISSION_DENIED`.
5. **Orphaned Inquiry Write**: Create `/inquiries/{id}` without atomic paired `/orderStatus/{trackingCode}` -> `PERMISSION_DENIED`.
6. **Fake Initial Milestone**: Buyer creates `/inquiries` or `/orderStatus` with initial `status: "deposit_confirmed"` instead of `"received"` -> `PERMISSION_DENIED`.
7. **ID Poisoning**: Document ID exceeding 128 characters or containing special characters (`../../admins`) -> `PERMISSION_DENIED`.
8. **Value Poisoning on Update**: Admin updates `/vehicles` with `fobPriceUsd: "free"` or `fobPriceUsd: -500` -> `PERMISSION_DENIED`.
9. **Timestamp Forgery**: Create `/inquiries` with backdated client `createdAt` instead of `request.time` -> `PERMISSION_DENIED`.
10. **Self-Assigned Admin Privilege**: Non-admin user attempts `create` on `/admins/{uid}` -> `PERMISSION_DENIED`.
11. **Oversized Array Exhaustion**: Admin creates `/vehicles` with `images` array exceeding 6 items or `features` exceeding 20 items -> `PERMISSION_DENIED`.
12. **Bank Details Tampering**: Non-admin user attempts `update` on `/companySettings/exportProfile` to swap SWIFT/account details -> `PERMISSION_DENIED`.
