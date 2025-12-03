# API Reference

Complete REST API documentation for the Asset Registration System.

## Base URL

- **Development:** `http://localhost:3001/api`
- **Production:** `https://assets.jvhlabs.com/api`

## Authentication

All endpoints (except `/health`, `/auth/register`, and `/auth/login`) require authentication via JWT token.

**Authorization Header:**
```http
Authorization: Bearer <your-jwt-token>
```

**Token Expiration:** 7 days

---

## Authentication Endpoints

### Register User

Create a new user account.

```http
POST /api/auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "first_name": "John",
  "last_name": "Doe"
}
```

**Response:** `201 Created`
```json
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "role": "employee",
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

**Role Assignment:**
- First user → `admin`
- User email matches `ADMIN_EMAIL` env var → `admin`
- Otherwise → `employee`

**Errors:**
- `400` - Missing required fields
- `409` - User already exists

---

### Login

Authenticate and receive JWT token.

```http
POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (without MFA):** `200 OK`
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "role": "employee",
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

**Response (with MFA enabled):** `200 OK`
```json
{
  "mfaRequired": true,
  "mfaSessionId": "abc123...",
  "message": "MFA verification required"
}
```

**Next Step:** Use `/api/auth/mfa/verify-login` with the `mfaSessionId` and verification code.

**Errors:**
- `400` - Missing email or password
- `401` - Invalid credentials

---

### Get Current User

Verify token and get current user info.

```http
GET /api/auth/me
```

**Headers:**
```http
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "John Doe",
  "role": "employee",
  "first_name": "John",
  "last_name": "Doe"
}
```

**Errors:**
- `401` - Invalid or expired token
- `404` - User not found

---

### Update Profile

Update user's first and last name.

```http
PUT /api/auth/profile
```

**Headers:**
```http
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "first_name": "Jane",
  "last_name": "Smith"
}
```

**Response:** `200 OK`
```json
{
  "message": "Profile updated successfully",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "Jane Smith",
    "role": "employee",
    "first_name": "Jane",
    "last_name": "Smith"
  }
}
```

**Errors:**
- `400` - Missing first_name or last_name
- `401` - Not authenticated

---

### Change Password

Change user's password with current password verification.

```http
PUT /api/auth/change-password
```

**Headers:**
```http
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword456",
  "confirmPassword": "newPassword456"
}
```

**Response:** `200 OK`
```json
{
  "message": "Password changed successfully"
}
```

**Errors:**
- `400` - Missing fields or passwords don't match
- `401` - Current password is incorrect
- `400` - New password too short (min 6 characters)

---

## Multi-Factor Authentication (MFA)

### Get MFA Status

Get current user's MFA enrollment status.

```http
GET /api/auth/mfa/status
```

**Headers:**
```http
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "enabled": true,
  "hasBackupCodes": true
}
```

---

### Start MFA Enrollment

Generate TOTP secret and QR code for MFA enrollment.

```http
POST /api/auth/mfa/enroll
```

**Headers:**
```http
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANS...",
  "secret": "JBSWY3DPEHPK3PXP",
  "message": "Scan QR code with your authenticator app"
}
```

**Errors:**
- `400` - MFA is already enabled

---

### Verify MFA Enrollment

Complete MFA enrollment by verifying first TOTP code.

```http
POST /api/auth/mfa/verify-enrollment
```

**Headers:**
```http
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "token": "123456"
}
```

**Response:** `200 OK`
```json
{
  "message": "MFA enabled successfully",
  "backupCodes": [
    "A1B2-C3D4",
    "E5F6-G7H8",
    "I9J0-K1L2",
    "..."
  ]
}
```

**Errors:**
- `400` - No pending enrollment or invalid code

---

### Disable MFA

Disable MFA for current user (requires password).

```http
POST /api/auth/mfa/disable
```

**Headers:**
```http
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "password": "userPassword123"
}
```

**Response:** `200 OK`
```json
{
  "message": "MFA disabled successfully"
}
```

**Errors:**
- `400` - Missing password
- `401` - Invalid password

---

### Verify MFA During Login

Verify TOTP code or backup code during login flow.

```http
POST /api/auth/mfa/verify-login
```

**Request Body:**
```json
{
  "mfaSessionId": "abc123...",
  "token": "123456",
  "useBackupCode": false
}
```

**Response:** `200 OK`
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "role": "employee"
  }
}
```

**Errors:**
- `400` - Invalid or expired session
- `401` - Invalid verification code

---

## OIDC/SSO Authentication

### Check OIDC Configuration

Check if OIDC/SSO is enabled.

```http
GET /api/auth/oidc/config
```

**Response:** `200 OK`
```json
{
  "enabled": true
}
```

---

### Initiate OIDC Login

Start OIDC login flow.

```http
GET /api/auth/oidc/login
```

**Response:** `200 OK`
```json
{
  "authUrl": "https://identity-provider.com/oauth/authorize?client_id=...",
  "state": "random-state-token"
}
```

**Usage:** Redirect user to `authUrl`

---

### OIDC Callback Handler

Handle OIDC provider callback (automatic redirect).

```http
GET /api/auth/oidc/callback?code=...&state=...
```

**Query Parameters:**
- `code` - Authorization code from provider
- `state` - State token for CSRF protection

**Response:** Redirects to frontend with token

---

### Get OIDC Settings (Admin)

Get current OIDC configuration.

```http
GET /api/admin/oidc-settings
```

**Permissions:** Admin only

**Headers:**
```http
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "enabled": 1,
  "issuer_url": "https://identity-provider.com",
  "client_id": "your-client-id",
  "has_client_secret": true,
  "redirect_uri": "https://your-app.com/auth/callback",
  "scope": "openid email profile",
  "role_claim_path": "roles",
  "default_role": "employee"
}
```

**Note:** `client_secret` is never returned, only `has_client_secret` boolean

---

### Update OIDC Settings (Admin)

Configure OIDC/SSO settings.

```http
PUT /api/admin/oidc-settings
```

**Permissions:** Admin only

**Headers:**
```http
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "enabled": true,
  "issuer_url": "https://identity-provider.com",
  "client_id": "your-client-id",
  "client_secret": "your-client-secret",
  "redirect_uri": "https://your-app.com/auth/callback",
  "scope": "openid email profile",
  "role_claim_path": "roles",
  "default_role": "employee"
}
```

**Response:** `200 OK`
```json
{
  "message": "OIDC settings updated successfully"
}
```

**Errors:**
- `400` - Missing required fields when enabled
- `403` - Not an admin

---

## User Management (Admin Only)

### Get All Users

List all users in the system.

```http
GET /api/auth/users
```

**Permissions:** Admin only

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "email": "admin@example.com",
    "name": "Admin User",
    "role": "admin",
    "created_at": "2024-01-01T00:00:00.000Z",
    "last_login": "2024-01-15T10:30:00.000Z"
  }
]
```

**Errors:**
- `401` - Not authenticated
- `403` - Not an admin

---

### Update User Role

Change a user's role.

```http
PUT /api/auth/users/:id/role
```

**Permissions:** Admin only

**Request Body:**
```json
{
  "role": "manager"
}
```

**Valid Roles:** `employee`, `manager`, `admin`

**Response:** `200 OK`
```json
{
  "message": "User role updated successfully",
  "user": {
    "id": 2,
    "email": "user@example.com",
    "name": "John Doe",
    "role": "manager",
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

**Errors:**
- `400` - Invalid role
- `403` - Cannot change own role
- `404` - User not found

---

### Delete User

Remove a user from the system.

```http
DELETE /api/auth/users/:id
```

**Permissions:** Admin only

**Response:** `200 OK`
```json
{
  "message": "User deleted successfully"
}
```

**Errors:**
- `403` - Cannot delete own account
- `404` - User not found

---

## Asset Endpoints

### Get All Assets

List assets with role-based filtering.

```http
GET /api/assets
```

**Role-Based Filtering:**
- **Employee:** Only assets where `employee_email` matches user email
- **Manager:** Assets where `employee_email` OR `manager_email` matches user email
- **Admin:** All assets

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "employee_name": "John Doe",
    "employee_email": "john@example.com",
    "manager_name": "Jane Smith",
    "manager_email": "jane@example.com",
    "client_name": "Acme Corp",
    "laptop_serial_number": "SN123456",
    "laptop_asset_tag": "ASSET-001",
    "status": "active",
    "registration_date": "2024-01-01T00:00:00.000Z",
    "last_updated": "2024-01-01T00:00:00.000Z",
    "notes": "MacBook Pro 16-inch"
  }
]
```

**Status Values:** `active`, `returned`, `lost`, `damaged`, `retired`

---

### Create Asset

Register a new asset.

```http
POST /api/assets
```

**Request Body:**
```json
{
  "employee_name": "John Doe",
  "employee_email": "john@example.com",
  "manager_name": "Jane Smith",
  "manager_email": "jane@example.com",
  "client_name": "Acme Corp",
  "laptop_serial_number": "SN123456",
  "laptop_asset_tag": "ASSET-001",
  "notes": "MacBook Pro 16-inch"
}
```

**Response:** `201 Created`
```json
{
  "message": "Asset registered successfully",
  "asset": {
    "id": 1,
    "employee_name": "John Doe",
    "employee_email": "john@example.com",
    "manager_name": "Jane Smith",
    "manager_email": "jane@example.com",
    "client_name": "Acme Corp",
    "laptop_serial_number": "SN123456",
    "laptop_asset_tag": "ASSET-001",
    "status": "active",
    "registration_date": "2024-01-01T00:00:00.000Z",
    "last_updated": "2024-01-01T00:00:00.000Z",
    "notes": "MacBook Pro 16-inch"
  }
}
```

**Errors:**
- `400` - Missing required fields
- `409` - Duplicate serial number or asset tag

---

### Update Asset Status

Update the status of an asset.

```http
PATCH /api/assets/:id/status
```

**Request Body:**
```json
{
  "status": "returned",
  "notes": "Returned to IT department"
}
```

**Response:** `200 OK`
```json
{
  "message": "Asset status updated successfully",
  "asset": {
    "id": 1,
    "status": "returned",
    "last_updated": "2024-01-15T10:00:00.000Z",
    "notes": "Returned to IT department"
  }
}
```

**Errors:**
- `404` - Asset not found
- `400` - Invalid status

---

## Company Endpoints

### Get All Companies (Admin)

List all companies with full details.

```http
GET /api/companies
```

**Permissions:** Admin only

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "name": "Acme Corp",
    "description": "Enterprise software company",
    "created_date": "2024-01-01T00:00:00.000Z"
  }
]
```

---

### Get Company Names (All Users)

Get company names for dropdown selection.

```http
GET /api/companies/names
```

**Permissions:** All authenticated users

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "name": "Acme Corp"
  },
  {
    "id": 2,
    "name": "TechStart Inc"
  }
]
```

---

### Create Company (Admin)

Add a new company.

```http
POST /api/companies
```

**Permissions:** Admin only

**Request Body:**
```json
{
  "name": "NewCo Ltd",
  "description": "Technology consulting firm"
}
```

**Response:** `201 Created`
```json
{
  "message": "Company registered successfully",
  "company": {
    "id": 3,
    "name": "NewCo Ltd",
    "description": "Technology consulting firm",
    "created_date": "2024-01-15T00:00:00.000Z"
  }
}
```

**Errors:**
- `400` - Missing name
- `409` - Company name already exists

---

### Update Company (Admin)

Update company details.

```http
PUT /api/companies/:id
```

**Permissions:** Admin only

**Request Body:**
```json
{
  "name": "NewCo Limited",
  "description": "Updated description"
}
```

**Response:** `200 OK`
```json
{
  "message": "Company updated successfully",
  "company": {
    "id": 3,
    "name": "NewCo Limited",
    "description": "Updated description",
    "created_date": "2024-01-15T00:00:00.000Z"
  }
}
```

**Errors:**
- `404` - Company not found
- `409` - Name conflicts with existing company

---

### Delete Company (Admin)

Remove a company.

```http
DELETE /api/companies/:id
```

**Permissions:** Admin only

**Response:** `200 OK`
```json
{
  "message": "Company deleted successfully"
}
```

**Errors:**
- `404` - Company not found
- `409` - Company has existing assets

---

## Audit & Reporting Endpoints

### Get Audit Logs

Retrieve audit logs with optional filtering.

```http
GET /api/audit/logs?action=CREATE&entityType=asset&limit=100
```

**Query Parameters:**
- `action` - Filter by action type (CREATE, UPDATE, STATUS_CHANGE, DELETE)
- `entityType` - Filter by entity (asset, company)
- `startDate` - Start date (ISO 8601)
- `endDate` - End date (ISO 8601)
- `userEmail` - Filter by user
- `limit` - Maximum records (default: unlimited)

**Role-Based Filtering:**
- **Employee:** Only logs where `user_email` matches
- **Manager:** Logs for self and managed employees
- **Admin:** All logs

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "action": "CREATE",
    "entity_type": "asset",
    "entity_id": 1,
    "entity_name": "SN123456 - John Doe",
    "details": "{\"employee_name\":\"John Doe\",\"client_name\":\"Acme Corp\"}",
    "timestamp": "2024-01-15T10:00:00.000Z",
    "user_email": "john@example.com"
  }
]
```

---

### Export Audit Logs

Download audit logs as CSV.

```http
GET /api/audit/export?startDate=2024-01-01&endDate=2024-01-31
```

**Query Parameters:** Same as Get Audit Logs

**Response:** `200 OK`
```
Content-Type: text/csv
Content-Disposition: attachment; filename=audit-logs-2024-01-15.csv

ID,Timestamp,Action,Entity Type,Entity Name,Details,User Email
1,2024-01-15T10:00:00.000Z,CREATE,asset,"SN123456 - John Doe","...",john@example.com
```

---

### Get Audit Statistics

Get aggregated statistics.

```http
GET /api/audit/stats?startDate=2024-01-01&endDate=2024-01-31
```

**Query Parameters:**
- `startDate` - Start date (ISO 8601)
- `endDate` - End date (ISO 8601)

**Response:** `200 OK`
```json
[
  {
    "action": "CREATE",
    "entity_type": "asset",
    "count": 45
  },
  {
    "action": "STATUS_CHANGE",
    "entity_type": "asset",
    "count": 23
  }
]
```

---

### Get Summary Report

Get asset summary with breakdowns.

```http
GET /api/reports/summary
```

**Role-Based Filtering:** Same as Get All Assets

**Response:** `200 OK`
```json
{
  "total": 150,
  "by_status": {
    "active": 120,
    "returned": 25,
    "lost": 3,
    "damaged": 2
  },
  "by_company": {
    "Acme Corp": 75,
    "TechStart Inc": 50,
    "NewCo Ltd": 25
  },
  "by_manager": {
    "Jane Smith": 80,
    "Bob Johnson": 70
  }
}
```

---

## Utility Endpoints

### Health Check

Check if the API is running.

```http
GET /api/health
```

**No authentication required**

**Response:** `200 OK`
```json
{
  "status": "ok",
  "message": "Asset Registration API is running"
}
```

---

## Error Responses

### Standard Error Format

All errors follow this format:

```json
{
  "error": "Error message description"
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (not authenticated)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate data)
- `500` - Internal Server Error

---

## Rate Limiting

Currently **not implemented**. Consider adding for production:
- 100 requests per 15 minutes per IP
- 1000 requests per hour per authenticated user

## Versioning

Current API version: **v1** (implicit in `/api` prefix)

Future versions may use `/api/v2` prefix.

---

**Next:** See [Authentication Guide](Authentication) for security details
