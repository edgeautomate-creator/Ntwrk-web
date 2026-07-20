# DUPR Token Setup Instructions

The edge function needs the DUPR_API_TOKEN to be set as a secret in Supabase.

## Setting the Secret in Supabase Dashboard

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/evsrrxfqxbgaubxskpko
2. Navigate to **Project Settings** (gear icon in the sidebar)
3. Click on **Edge Functions**
4. Under **Secrets**, add a new secret:
   - Name: `DUPR_API_TOKEN`
   - Value: Your DUPR token (the long JWT token from your authentication response)

5. Save the secret

## Updating the Token Daily

Since the DUPR token expires daily, you'll need to:

1. Get a new token from DUPR authentication
2. Go to Supabase Dashboard > Project Settings > Edge Functions > Secrets
3. Edit the `DUPR_API_TOKEN` secret
4. Replace with the new token value
5. Save

The edge functions will automatically use the updated token without needing to redeploy.

## Current Token

Your current token (expires: 2026-02-19T20:30:53Z):

```
eyJhbGciOiJSUzUxMiJ9.eyJpc3MiOiJodHRwczovL2R1cHIuZ2ciLCJpYXQiOjE3NzE1Mjk0NTMsImV4cCI6MTc3MTUzMzA1MywianRpIjoiNTEwMTQzNjMwMyIsInN1YiI6ImRHVnpkQzFqYXkwd1lUbGtNemt6TlMweFlUQXdMVFEyWW1VdFptSm1PUzAyTXpjMlpEUmhaall6TjJNPSJ9.W0LMVXs9ZHMgnF_NlOOlUAYuFMxTHUcp1aAYsCnDCKQC81QGUm0dgJ65r4FqhkMjDqkAVsCb-pUx_LQGUntmhcm3IMOK-s4vIxNFuIGJWsqwidfsZgoBncmnZlyRxlr6gvMv8B73pZCQD3VRDDzl9AraCRrrUHbbleqNvXelRB1Xl181dVg2EiIJJakXTb5oNfNQChxstRJzJDZmRh9jr1SlCdl-mH9WTSlAmozkffoEbJ9vPPoyftd4nrPxWhtMqxBKHorzN2lPjpx5VV6wvsMzKn7ZzgY0ml70W061n9j8fqE1lqXXvUkx2Yz9cqODoqb2wRwZR1MW3m5ULsirhg
```
