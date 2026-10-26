# Single-Transaction Notification & Credit Conservation Policy

## 1. Credit Conservation Rules by Service Domain

### Account Verification Lifecycle
- **Registration & Profile Creation**: NEVER send external SMS or Email on account creation or pending review state.
- **Terminal State**: Send external SMS and Email ONCE upon official Admin verification (`Verified`) or rejection (`Rejected` / `Action Needed`).

### Document Request Lifecycle
- **Submission & Processing**: NEVER send external SMS or Email on `Pending`, `Processing`, or `Completed` (Claimed).
- **Terminal Actionable State**: Send external SMS and Email ONCE when the document is signed and marked as `Ready for Pickup` (or `Rejected`).

### Health & Clinic Appointments (Nurse / BHW)
- **Booking & Scheduling**: NEVER send external SMS or Email on `Pending` (Booking) or `Approved` (Scheduled).
- **Completion**: Send external SMS and Email ONCE when the appointment/consultation is officially finalized as `Completed` (or `Cancelled`).

---

## 2. Dual-Dispatch Prevention Invariant
- **Backend-Handled API Calls**: If a backend controller (e.g. `approveResident`, `rejectResident`, `updateDocumentStatus`, `updateAppointment`) dispatches external SMS/Email, frontend callers MUST pass `externalDispatchedByBackend: true` to `dispatchResidentNotification` to prevent duplicate client-side dispatch.
- **Generic Notification Endpoint**: `POST /api/notifications` must only dispatch external SMS if `send_sms: true` is explicitly passed; default is in-app database logging only.

---

## 3. In-App Notification Center Invariant
- All lifecycle transitions (e.g. `Pending`, `Processing`, `Completed`) must continue recording persistent in-app notifications (`UserNotification` in MySQL and client `notificationStore`).
- Residents and staff must retain 100% visibility into their application and healthcare tracking inside the portal notification bell without incurring third-party SMS or email gateway costs.
