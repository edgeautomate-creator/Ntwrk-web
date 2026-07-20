# DUPR Test Environment Configuration

## Overview

This application is configured to work with DUPR's UAT test environment for development and testing purposes.

## Authentication Methods

The app provides two ways to connect your DUPR account:

### Option 1: Production OAuth (Popup)
- Opens a popup window to `dashboard.dupr.com`
- Requires production client credentials
- Best for production deployments
- **Note**: Test credentials won't work with this method

### Option 2: UAT Test Credentials (Recommended for Testing)
- Enter your DUPR UAT email and password directly
- Authenticates via the UAT API endpoint
- Perfect for development and testing
- Uses the `password` grant type with your test credentials

## Test Credentials

Your test client credentials are configured in:
- Client Key: `test-ck-0a9d3935-1a00-46be-fbf9-6376d4af637c`
- Client Secret: `test-cs-8f3a3a1740114165fa16db499b4dc31d`

These are used by edge functions to authenticate with DUPR's UAT API.

## Environment Variables

These are already set in your `.env` file:

```env
DUPR_CLIENT_ID=test-ck-0a9d3935-1a00-46be-fbf9-6376d4af637c
DUPR_CLIENT_KEY=test-ck-0a9d3935-1a00-46be-fbf9-6376d4af637c
DUPR_CLIENT_SECRET=test-cs-8f3a3a1740114165fa16db499b4dc31d
```

These are automatically available in Supabase Edge Functions.

## UAT API Endpoints

All edge functions use these UAT endpoints:

- **Auth (Password)**: `https://uat.mydupr.com/api/auth/v1.0/token` (with `grant_type=password`)
- **User Info**: `https://uat.mydupr.com/api/user/v1.0/me`
- **Search Player**: `https://uat.mydupr.com/api/player/v1.0/search`
- **Submit Match**: `https://uat.mydupr.com/api/v1.0/match/result`

## Testing the Integration

### Using UAT Test Credentials (Recommended)

1. Click "Connect DUPR Account" in your profile
2. Select "Use UAT Test Credentials"
3. Enter your DUPR UAT test account email and password
4. Click "Connect UAT Account"
5. Your account will be linked and tokens saved to your profile

### Using Production OAuth (Requires Production Credentials)

1. Click "Connect DUPR Account" in your profile
2. Select "Use Production Login"
3. Popup opens to production DUPR
4. Login with production credentials
5. After login, user data is saved to your profile

## How It Works

The UAT authentication flow:

1. User enters email/password in the UI
2. Frontend calls `/functions/v1/dupr-auth` edge function
3. Edge function uses `password` grant type with UAT endpoint
4. Receives access token and refresh token from DUPR UAT
5. Fetches user info from `/api/user/v1.0/me`
6. Returns complete user profile with tokens
7. Frontend saves to Supabase profiles table

All subsequent API calls (search, submit matches) use the UAT endpoints and won't affect production data.

## Switching to Production

When ready for production:

1. Get production OAuth credentials from DUPR
2. Update `.env` with production credentials
3. Update edge functions to use production API endpoints:
   - Change `uat.mydupr.com/api` to `api.dupr.gg`
4. Deploy updated edge functions
5. Users will authenticate via production OAuth popup

## Known Limitations

- UAT environment may have limited player data compared to production
- Some features may behave differently in UAT
- The popup OAuth method requires production credentials (test credentials won't work)
- Use the direct credential input for UAT testing

## Troubleshooting

**"Invalid or incomplete integration" error on popup**:
- This means you're using test credentials with production OAuth
- Switch to "Use UAT Test Credentials" option instead

**"Failed to authenticate" error**:
- Verify your UAT test account credentials are correct
- Check that environment variables are set in Supabase
- Review edge function logs in Supabase dashboard
