# DUPR Token Expiration Fix

## Problem Overview

Users were experiencing "token might have expired" errors when fetching DUPR clubs. This was caused by the system not properly managing DUPR authentication tokens.

## Root Cause

The original implementation had several issues:

1. **Stored user tokens were never used** - The system stored `dupr_user_token` and `dupr_refresh_token` in the database but never utilized them
2. **No automatic token refresh** - When tokens expired, there was no mechanism to refresh them
3. **Single point of failure** - Only relied on client credentials which could fail
4. **Poor error handling** - No graceful fallback when authentication failed

## Solution Implemented

### Multi-Strategy Authentication Flow

The updated `dupr-user-clubs` Edge Function now implements a 4-strategy authentication flow:

#### Strategy 1: Use Stored User Token
- First attempts to use the stored `dupr_user_token` from the user's profile
- If successful, returns fresh club data
- If it fails with 401 (expired), moves to Strategy 2

#### Strategy 2: Refresh User Token
- Uses the stored `dupr_refresh_token` to obtain a new access token
- Automatically updates both tokens in the database
- Retries fetching clubs with the fresh token
- If refresh fails, moves to Strategy 3

#### Strategy 3: Client Credentials Fallback
- Falls back to using DUPR client credentials (API key/secret)
- Generates a temporary token for the request
- This ensures backward compatibility
- If this fails, moves to Strategy 4

#### Strategy 4: Return Cached Data
- Returns cached club data from the `user_dupr_clubs` table
- Shows a warning that data may be outdated
- Suggests the user reconnect their DUPR account
- Only fails completely if no cache exists

### New Edge Function: dupr-refresh-token

Created a dedicated endpoint for manually refreshing DUPR tokens:
- Endpoint: `/functions/v1/dupr-refresh-token`
- Method: POST
- Requires: User authentication
- Returns: Success confirmation
- Updates: Both access and refresh tokens in database

## How Token Refresh Works

```
User Token Expired → Call DUPR Refresh API → Get New Tokens → Update Database → Return New Access Token
```

The refresh process:
1. Takes the stored `dupr_refresh_token`
2. Calls DUPR's refresh endpoint with client credentials
3. Receives new `access_token` and `refresh_token`
4. Updates both in the user's profile
5. Returns the new access token for immediate use

## Benefits

1. **Automatic token refresh** - No user intervention needed when tokens expire
2. **Multiple fallback strategies** - System stays functional even if one method fails
3. **Better caching** - Always updates cache on successful fetch
4. **Improved error messages** - Users get clear feedback about what's happening
5. **Debug information** - Response includes `tokenSource` to track which strategy worked

## Testing the Fix

### Test 1: Fresh Token Flow
1. Link your DUPR account (stores fresh tokens)
2. Create a tournament requiring DUPR
3. Should use Strategy 1 (stored token)
4. Response includes `"tokenSource": "user_token"`

### Test 2: Expired Token Flow
1. Wait for token to expire (or manually corrupt it)
2. Attempt to fetch clubs
3. Should automatically refresh (Strategy 2)
4. Response includes `"tokenSource": "refreshed_token"`

### Test 3: Client Credentials Fallback
1. Remove refresh token from database
2. Corrupt the user token
3. Should fall back to client credentials (Strategy 3)
4. Response includes `"tokenSource": "client_credentials"`

### Test 4: Cache Fallback
1. Disable DUPR API access
2. Should return cached data (Strategy 4)
3. Response includes `"cached": true` and warning message

## Monitoring

Check Supabase Edge Function logs to see which authentication strategy is being used:

```
Strategy 1: Attempting to use stored user token
Strategy 2: Attempting to refresh user token
Strategy 3: Attempting to use client credentials
Strategy 4: All token strategies failed, falling back to cached data
```

## Database Changes

No migrations required - the system uses existing columns:
- `profiles.dupr_user_token` - User's DUPR access token
- `profiles.dupr_refresh_token` - Token for refreshing expired access tokens
- `user_dupr_clubs` - Cache table for club data

## API Response Format

### Success Response
```json
{
  "clubs": [
    { "id": "123", "name": "My Club" }
  ],
  "cached": false,
  "tokenSource": "user_token",
  "lastSyncedAt": "2026-03-26T10:30:00Z"
}
```

### Cached Response
```json
{
  "clubs": [
    { "id": "123", "name": "My Club" }
  ],
  "cached": true,
  "lastSyncedAt": "2026-03-25T15:20:00Z",
  "warning": "DUPR authentication failed - showing cached data. Please reconnect your DUPR account if data seems outdated."
}
```

### Error Response
```json
{
  "error": "Failed to authenticate with DUPR and no cached data available",
  "details": "All authentication methods failed. Please reconnect your DUPR account.",
  "clubs": [],
  "cached": false
}
```

## Maintenance Notes

### Token Lifecycle
- Access tokens expire after a certain period (DUPR-defined)
- Refresh tokens have a longer lifetime
- Both are automatically updated when refreshed
- Users should reconnect their DUPR account if refresh tokens expire

### DUPR API Endpoints Used
- Authentication: `https://uat.mydupr.com/api/auth/v1.0/token`
- Refresh: `https://uat.mydupr.com/api/auth/v1.0/refresh`
- Clubs: `https://uat.mydupr.com/api/user/v1.0/{duprId}/clubs`

Note: Currently using UAT environment. Update URLs to production when ready.

## Future Improvements

1. Add token expiration tracking to avoid unnecessary refresh attempts
2. Implement background job to refresh tokens before they expire
3. Add analytics to track which authentication strategy is most commonly used
4. Consider implementing token refresh for other DUPR API calls
5. Add user notification when they need to reconnect their DUPR account
