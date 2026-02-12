# Security Policy (Auth + Session)

## Token Storage

- **Production** uses **HttpOnly Secure Cookies** for access/refresh tokens.
- The frontend **does not** store tokens in `localStorage` or `sessionStorage`.
- API requests include cookies via `fetch(..., { credentials: "include" })`.

## CORS Requirements

- **No wildcard** origins when credentials are enabled.
- Use an allowlist and set `Access-Control-Allow-Credentials: true`.

## JWT Verification

- Backend verifies JWT signatures using `JWT_SECRET`.
- Invalid or expired tokens result in `401 UNAUTHENTICATED` for protected routes.

