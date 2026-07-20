# DUPR Authentication Fix - Iframe Implementation

## Problem
The authentication flow was using a popup window approach, but DUPR's external login system is designed to work with **embedded iframes**, not popups.

## Root Cause
According to DUPR's official documentation (https://dupr.gitbook.io/dupr-raas/tutorials/login-with-dupr), the correct implementation requires:
1. Embedding the DUPR login URL in an `<iframe>`
2. Listening for postMessage events from the iframe
3. The embedded JS emits an event to the **parent window** (not window.opener)

## Solution: Iframe-Based Implementation

### DUPRLoginModal Component (`components/dupr-login-modal.tsx`)

**Complete Redesign:**
- Changed from popup window to embedded iframe
- Iframe shows DUPR login page directly in the modal
- Listens for postMessage events from iframe (not popup)
- When user logs in, DUPR iframe sends message to parent window
- Message contains: `userToken`, `refreshToken`, `id`, `duprId`, `stats`

**Key Implementation Details:**

```typescript
// Iframe URL format (per DUPR docs):
// UAT: https://uat.dupr.gg/login-external-app/:clientId
// Production: https://dashboard.dupr.com/login-external-app/:clientId
// where :clientId is base64 encoded client key

const duprLoginUrl = `${duprBaseUrl}/login-external-app/${clientKeyBase64}`;

// Embed in iframe:
<iframe
  src={duprLoginUrl}
  className="w-full h-[600px] border rounded-lg"
  title="DUPR Login"
  allow="clipboard-read; clipboard-write"
/>

// Listen for message from iframe:
window.addEventListener('message', handleMessage);
```

**Message Handling:**
- Only requires `userToken` (essential field)
- Accepts both `data.duprId` and `data.id` as DUPR ID
- Automatically hides iframe after successful login
- Saves data to database and closes modal

### DUPR Callback Page (`app/dupr-callback/page.tsx`)

**Status:** This page is no longer used in the iframe flow but kept for backwards compatibility. It now acts as a relay if accidentally opened.

## Flow Diagram

```
User clicks "Connect with DUPR"
    ↓
Modal displays embedded iframe with DUPR login
    ↓
User logs in within the iframe
    ↓
DUPR embedded JS sends postMessage to parent window
    ↓
DUPRLoginModal receives message event
    ↓
Modal validates origin and extracts tokens
    ↓
Data saved to Supabase profiles table
    ↓
Iframe hidden, modal closes, success callback triggered
```

## Message Structure (Per DUPR Docs)

```javascript
{
  userToken: string,      // Access token (read-only permissions)
  refreshToken: string,   // Refresh token
  id: string,            // User ID
  duprId: string,        // DUPR ID (same as id)
  stats: {
    singles: number,     // Singles rating
    doubles: number      // Doubles rating
  }
}
```

## Origin Validation

Messages are only accepted from:
- `https://uat.dupr.gg`
- `https://dupr.gg`
- `https://dashboard.dupr.com`
- `https://uat.mydupr.com`

## Testing

Build completes successfully with no errors.

## Reference

Official DUPR Documentation: https://dupr.gitbook.io/dupr-raas/tutorials/login-with-dupr
