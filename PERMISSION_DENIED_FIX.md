# Permission Denied Error - Complete Fix

## Problem Summary

Users were experiencing "Permission denied. Please log in again." errors when attempting to create tournaments, pickup sessions, or leagues, even after being authenticated. This occurred because Row-Level Security (RLS) policies were not recognizing the authenticated user.

## Root Cause Analysis

The issue was caused by a race condition and lack of robust session validation:

1. **Timing Issue**: The auth context (`useAuth()`) showed a user existed, but the Supabase client's session state hadn't fully synchronized
2. **No Pre-flight Validation**: No checks were performed to verify:
   - Session was valid
   - User profile existed in database
   - Auth token was properly attached to requests
3. **Limited Error Information**: Errors lacked detailed logging to diagnose RLS failures

## Solution Implemented

### 1. New Authentication Helper Function

Created `ensureAuthReady()` in `lib/auth-helpers.ts` that:
- Validates the session exists and is active
- Verifies the user's profile exists in the database
- Returns detailed error information for debugging
- Provides a consistent authentication check across all creation flows

```typescript
export async function ensureAuthReady(): Promise<AuthReadyResult> {
  // Checks session validity
  // Verifies profile exists
  // Returns success/error with detailed information
}
```

### 2. Enhanced Error Logging

Added comprehensive error logging throughout creation flows:
- Logs user ID being used for database operations
- Logs full Supabase error details (message, details, hint, code)
- Console logs successful operations for debugging
- Provides specific error messages for different failure scenarios

### 3. Updated Tournament Creation

**File**: `app/dashboard/tournaments/create/page.tsx`

Changes:
- Added `ensureAuthReady()` check before database operations
- Enhanced error logging with full error details
- Improved error messages for RLS failures
- Added console logging for debugging

### 4. Updated Pickup Session Creation

**File**: `app/dashboard/pickup/create/page.tsx`

Changes:
- Added `ensureAuthReady()` check at start of handleCreate
- Enhanced error logging with detailed Supabase errors
- Uses userId from auth check instead of user context directly
- Added success logging

### 5. Updated League Creation

**File**: `app/dashboard/leagues/create/page.tsx`

Changes:
- Added `ensureAuthReady()` check before league creation
- Enhanced error logging with full error object details
- Toast notification for authentication errors
- Added console logging for debugging

## Verification Performed

### Database Trigger Check
- Verified `on_auth_user_created` trigger exists and is enabled
- Confirmed all existing users have profiles in the database
- Trigger properly creates profiles on user signup

### RLS Policies Review
- Confirmed tournaments table has proper INSERT policy
- Policy checks `created_by = auth.uid()`
- All users have valid profiles with matching IDs

### Build Verification
- All TypeScript compilation successful
- No runtime errors
- All pages build correctly

## How This Fix Works

### Before Fix
```typescript
// Simple check, no validation
if (!user) {
  setError('Please log in to continue.');
  return;
}

// Direct database insert - might fail if session not synced
const { data, error } = await supabase
  .from('tournaments')
  .insert({ created_by: user.id, ... });
```

### After Fix
```typescript
// Comprehensive authentication check
const authCheck = await ensureAuthReady();

if (!authCheck.success) {
  setError(authCheck.error || 'Authentication check failed.');
  return;
}

// Use verified userId
const userId = authCheck.userId!;

console.log('Creating tournament with user ID:', userId);

// Enhanced error logging
if (insertError) {
  console.error('Tournament insert error:', {
    message: insertError.message,
    details: insertError.details,
    hint: insertError.hint,
    code: insertError.code
  });
  // Specific error handling
}
```

## Benefits

1. **Reliability**: Pre-flight authentication check prevents RLS failures
2. **Debugging**: Detailed error logging makes issues easy to diagnose
3. **Consistency**: Same pattern across tournaments, pickup, and leagues
4. **User Experience**: Clear error messages guide users to solutions
5. **Maintainability**: Centralized auth check in single helper function

## Testing Recommendations

1. **Happy Path Tests**:
   - Log in and create a tournament
   - Log in and create a pickup session
   - Log in and create a league
   - Verify all operations succeed

2. **Error Scenario Tests**:
   - Try creating without logging in (should redirect)
   - Check browser console for detailed error logs
   - Verify error messages are user-friendly

3. **Session State Tests**:
   - Create tournament immediately after login
   - Create pickup after being logged in for a while
   - Switch between different creation pages
   - Verify no authentication errors occur

4. **Browser Console Monitoring**:
   - Watch for "Creating [resource] with user ID:" logs
   - Check that user IDs match expected values
   - Verify error logs include full details when issues occur

## Files Modified

- `lib/auth-helpers.ts` - Added `ensureAuthReady()` function
- `app/dashboard/tournaments/create/page.tsx` - Enhanced auth and logging
- `app/dashboard/pickup/create/page.tsx` - Enhanced auth and logging
- `app/dashboard/leagues/create/page.tsx` - Enhanced auth and logging

## Expected Behavior Now

1. User opens creation page (tournament/pickup/league)
2. `ensureAuthReady()` checks:
   - Session exists and is valid
   - User profile exists in database
   - Returns user ID if all checks pass
3. If any check fails, user sees specific error message
4. If checks pass, creation proceeds with verified user ID
5. All operations logged to console for debugging
6. Success or detailed error shown to user

## Monitoring

Check browser console for these logs:

**Success**:
```
Creating tournament with user ID: 800ef6de-036b-40d5-b0f5-49275969e1d9
Tournament created successfully: abc-123-def-456
```

**Auth Failure**:
```
Session error: [error details]
```

**RLS Failure**:
```
Tournament insert error: {
  message: "new row violates row-level security policy",
  details: "...",
  hint: "...",
  code: "42501"
}
```

## Prevention

To prevent similar issues in the future:

1. Always use `ensureAuthReady()` before RLS-protected database operations
2. Log user IDs and operation details for debugging
3. Include full error details in console.error calls
4. Verify session state before critical operations
5. Test immediately after login and after extended sessions
