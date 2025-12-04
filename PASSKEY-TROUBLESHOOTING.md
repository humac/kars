# Passkey/WebAuthn Troubleshooting Guide

This guide helps you resolve common issues when registering or using passkeys (WebAuthn) for authentication.

## Common Error: "Relying party ID is not a registrable domain suffix"

### What This Error Means

This error occurs when the **Relying Party ID (RP ID)** doesn't match the domain you're accessing the application from. This is a security requirement of the WebAuthn standard.

### Quick Fix for Local Development

**Problem**: Accessing via `http://127.0.0.1:5173` but RP ID is set to `localhost`

**Solution**: Access the app via `http://localhost:5173` instead

1. If your browser is at `http://127.0.0.1:5173`, change it to `http://localhost:5173`
2. Try registering your passkey again

### Configuration for Local Development

Create a `.env` file in the `backend` directory with:

```bash
# Passkey Configuration for Local Development
PASSKEY_RP_ID=localhost
PASSKEY_RP_NAME=KARS - KeyData Asset Registration System
PASSKEY_ORIGIN=http://localhost:5173
```

**Important**: When testing locally:
- Always use `http://localhost:5173` (NOT `http://127.0.0.1:5173`)
- The RP ID must match your hostname exactly

### Configuration for Production

For production deployments, set these environment variables:

```bash
# Passkey Configuration for Production
PASSKEY_RP_ID=yourdomain.com          # Your actual domain (no protocol)
PASSKEY_RP_NAME=Your App Name
PASSKEY_ORIGIN=https://yourdomain.com  # Full URL with protocol
```

**Important**:
- RP ID must be the domain name WITHOUT protocol (no `https://`)
- Origin must be the full URL WITH protocol (`https://`)
- For subdomains like `app.example.com`, you can use either `app.example.com` or `example.com` as RP ID

### Debugging Steps

If you're still having issues, check the backend logs for diagnostic information:

```bash
# Docker logs
docker logs asset-registration-backend

# Or if running directly
npm run dev
```

Look for lines starting with `[Passkey Registration]` which will show:
- Current RP ID configuration
- Expected origin
- Request origin from browser
- Number of existing passkeys

Example output:
```
[Passkey Registration] Configuration: {
  rpID: 'localhost',
  rpName: 'KARS - KeyData Asset Registration System',
  expectedOrigin: 'http://localhost:5173',
  requestOrigin: 'http://127.0.0.1:5173',  # ⚠️ Mismatch!
  userEmail: 'user@example.com'
}
```

## Error: "Unable to start passkey registration" (Multiple Devices)

### What This Error Means

This error previously occurred when trying to register a second passkey because existing credential IDs were being passed incorrectly to the WebAuthn library.

### Solution

This has been fixed in the latest version. Update your code:

```bash
git pull origin main
# Or if using Docker
docker-compose pull
docker-compose up -d
```

The fix ensures that credential IDs are passed as base64url strings (not Buffers) in the `excludeCredentials` parameter.

## Platform-Specific Issues

### Windows Hello

**Issue**: Passkey registration works with browser extensions (1Password, etc.) but not with Windows Hello

**Cause**: Usually a Relying Party ID mismatch

**Solution**:
1. Verify you're accessing via the correct hostname
2. Check your `PASSKEY_RP_ID` environment variable
3. Restart the backend after changing environment variables
4. Clear browser cache and try again

### Touch ID / Face ID (macOS)

**Issue**: "This passkey can't be saved"

**Solution**:
1. Ensure you're using Safari or Chrome (latest versions)
2. Check that HTTPS is enabled (or localhost for development)
3. Verify RP ID matches your domain

### Android/Chrome

**Issue**: "No compatible authenticator found"

**Solution**:
1. Ensure Android device has a lock screen (PIN/pattern/biometric)
2. Update Chrome to latest version
3. Check that you're on HTTPS (localhost is exempt)

## Testing Your Configuration

Use these steps to verify your passkey setup:

### 1. Check Environment Variables

```bash
# In backend directory
cat .env | grep PASSKEY
```

Should show:
```
PASSKEY_RP_ID=localhost
PASSKEY_RP_NAME=KARS - KeyData Asset Registration System
PASSKEY_ORIGIN=http://localhost:5173
```

### 2. Verify Backend is Using Correct Config

Check backend logs on startup for:
```
[Passkey Registration] Configuration: { rpID: 'localhost', ... }
```

### 3. Test Registration

1. Log in to your account
2. Go to Profile → Security Settings
3. Click "Add Passkey"
4. Follow the prompts from your authenticator

Watch backend logs for diagnostic output.

### 4. Test Authentication

1. Log out
2. On login page, click "Sign in with Passkey"
3. Follow the prompts from your authenticator

## Common Configuration Mistakes

### ❌ Wrong: Using protocol in RP ID
```bash
PASSKEY_RP_ID=https://example.com  # Wrong!
```

### ✅ Correct: Domain only
```bash
PASSKEY_RP_ID=example.com
```

---

### ❌ Wrong: Accessing via IP when RP ID is domain
```bash
PASSKEY_RP_ID=localhost
# But accessing via http://127.0.0.1:5173
```

### ✅ Correct: Matching hostname
```bash
PASSKEY_RP_ID=localhost
# Access via http://localhost:5173
```

---

### ❌ Wrong: Missing origin protocol
```bash
PASSKEY_ORIGIN=localhost:5173  # Wrong!
```

### ✅ Correct: Full URL with protocol
```bash
PASSKEY_ORIGIN=http://localhost:5173
```

## Browser Developer Tools

Check for WebAuthn errors in browser console:

1. Open Developer Tools (F12)
2. Go to Console tab
3. Try registering a passkey
4. Look for errors containing "WebAuthn", "RP ID", or "domain"

## Still Having Issues?

If you're still experiencing problems:

1. **Check backend logs** for `[Passkey Registration]` diagnostic output
2. **Verify environment variables** are loaded (restart backend after changes)
3. **Test with different browsers** (Chrome, Safari, Firefox)
4. **Check platform authenticator** availability:
   ```javascript
   // In browser console
   PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
     .then(available => console.log('Platform authenticator:', available))
   ```
5. **Review the issue** on GitHub with:
   - Backend logs (with `[Passkey Registration]` lines)
   - Browser console errors
   - Your configuration (hide sensitive values)
   - Platform/browser details

## Additional Resources

- [WebAuthn Guide](https://webauthn.guide/) - Interactive guide
- [Can I Use WebAuthn](https://caniuse.com/webauthn) - Browser compatibility
- [FIDO Alliance](https://fidoalliance.org/) - Standards documentation

---

**Last Updated**: 2025-12-04
