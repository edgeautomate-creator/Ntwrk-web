# DUPR OAuth Integration - Complete Setup Review

## Overview
The DUPR OAuth integration uses an **iframe-based authentication flow** where users log in to DUPR within an embedded iframe, and the credentials are automatically saved to their profile.

## Authentication Flow

### 1. User Initiates Connection
**Location**: `/dashboard/profile`
- User clicks "Connect with DUPR" button
- Button component: `<DUPRLoginButton />` from `components/dupr-login-modal.tsx`
- Action: Redirects to `/dupr-login` page

### 2. DUPR Login Page
**Location**: `/app/dupr-login/page.tsx`
- Full-page iframe displaying DUPR's login interface
- iframe URL: `https://uat.dupr.gg/login-external-app/{base64EncodedClientKey}`
- For production: `https://dashboard.dupr.com/login-external-app/{base64EncodedClientKey}`

### 3. PostMessage Communication
After the user logs in within the iframe:
- DUPR's embedded JS sends a `postMessage` to the parent window
- Message contains authentication data and user stats
- Origin validation ensures messages only from trusted DUPR domains

### 4. Data Storage
**Table**: `profiles`
- `dupr_user_token` - Access token for DUPR API calls
- `dupr_refresh_token` - Token refresh capability
- `dupr_id` - User's DUPR ID
- `full_name` - User's name from DUPR
- `dupr_singles_rating` - Singles rating
- `dupr_doubles_rating` - Doubles rating

### 5. Success & Redirect
- Data saved to database
- User redirected back to `/dashboard/profile`
- Profile page shows connected status with ratings

## Components

### DUPRLoginButton (`components/dupr-login-modal.tsx`)
```typescript
export function DUPRLoginButton() {
  const router = useRouter();

  const handleConnect = () => {
    router.push('/dupr-login');
  };

  return (
    <Button onClick={handleConnect}>
      Connect with DUPR
    </Button>
  );
}
```

### DUPR Login Page (`app/dupr-login/page.tsx`)
Key features:
- Displays iframe with DUPR login URL
- Listens for postMessage events
- Validates message origin (must be from DUPR domains)
- Extracts user data from message
- Saves to Supabase profiles table
- Redirects to profile page on success

### Profile Page (`app/dashboard/profile/page.tsx`)
- Shows connection status
- Displays DUPR ratings when connected
- Allows disconnection
- Refreshes data after successful connection

## Environment Variables

Required in `.env`:
```bash
NEXT_PUBLIC_DUPR_ENV=uat                      # or 'production'
NEXT_PUBLIC_DUPR_CLIENT_KEY=test-ck-...       # Your DUPR client key
```

## Message Format

DUPR sends the following data via postMessage:
```javascript
{
  userToken: string,           // Access token
  refreshToken: string,        // Refresh token
  id: string,                  // User ID
  duprId: string,             // DUPR ID (same as id)
  fullName: string,           // User's name
  email: string,              // User's email
  stats: {
    provisionalRatings: {
      singlesRating: number,  // Singles rating
      doublesRating: number   // Doubles rating
    }
  }
}
```

## Security

### Origin Validation
Only messages from these domains are accepted:
- `https://uat.dupr.gg`
- `https://dupr.gg`
- `https://dashboard.dupr.com`
- `https://uat.mydupr.com`

### Database Security
- RLS policies ensure users can only update their own profile
- Tokens stored securely in database
- Only accessible by profile owner

## Database Schema

### Profiles Table Columns
```sql
CREATE TABLE profiles (
  id uuid PRIMARY KEY,
  dupr_id text,
  dupr_user_token text,
  dupr_refresh_token text,
  full_name text,
  dupr_singles_rating numeric,
  dupr_doubles_rating numeric,
  dupr_singles_wins integer,
  dupr_singles_losses integer,
  dupr_doubles_wins integer,
  dupr_doubles_losses integer,
  dupr_data jsonb,
  created_at timestamptz,
  updated_at timestamptz
);
```

## Testing

1. Navigate to `/dashboard/profile`
2. Click "Connect with DUPR"
3. Log in with DUPR UAT credentials in the iframe
4. After login, you'll be automatically redirected back
5. Profile page should show your DUPR ID and ratings

## File Structure

```
app/
├── dashboard/
│   └── profile/
│       └── page.tsx           # Shows DUPR connection status
├── dupr-login/
│   └── page.tsx              # Full-page iframe for DUPR login
└── dupr-callback/
    └── page.tsx              # Legacy callback (still exists but unused)

components/
└── dupr-login-modal.tsx      # Button component that redirects to /dupr-login

supabase/
└── migrations/
    ├── 20260219031412_create_profiles_table.sql
    ├── 20260219201420_add_dupr_stats_to_profiles.sql
    └── 20260220034204_add_dupr_tokens_to_profiles.sql
```

## Key Points

1. **No API credentials needed on frontend** - OAuth flow handles authentication
2. **Iframe-based** - No popups, no redirects to external sites
3. **Automatic data sync** - Tokens and ratings saved automatically
4. **Secure** - Origin validation and RLS policies
5. **User-friendly** - Single click to connect, instant feedback

## Status

✅ Build completed successfully
✅ All components connected
✅ Database columns properly configured
✅ Security policies in place
✅ OAuth flow complete and ready for testing
