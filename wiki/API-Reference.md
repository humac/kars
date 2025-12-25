# API Reference

Complete REST API documentation for the Asset Compliance System (ACS).

## Base URL

- **Development:** `http://localhost:3001/api`
- **Production:** `https://kars.jvhlabs.com/api`

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

## Passkey Authentication (WebAuthn)

### List Passkeys

Get all passkeys registered for the current user.

```http
GET /api/auth/passkeys
```

**Headers:**
```http
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "passkeys": [
    {
      "id": 1,
      "user_id": 1,
      "name": "MacBook Pro Touch ID",
      "credential_id": "AVdGcO...",
      "transports": ["internal"],
      "created_at": "2024-01-15T10:30:00Z",
      "last_used_at": "2024-01-20T14:25:00Z"
    }
  ]
}
```

---

### Generate Registration Options

Start passkey registration by generating WebAuthn challenge.

```http
POST /api/auth/passkeys/registration-options
```

**Headers:**
```http
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "challenge": "3Q2+7w...",
  "rp": {
    "name": "ACS - Asset Compliance System",
    "id": "localhost"
  },
  "user": {
    "id": "MQ==",
    "name": "user@example.com",
    "displayName": "John Doe"
  },
  "pubKeyCredParams": [
    { "type": "public-key", "alg": -7 },
    { "type": "public-key", "alg": -257 }
  ],
  "timeout": 60000,
  "attestation": "none",
  "excludeCredentials": [],
  "authenticatorSelection": {
    "residentKey": "preferred",
    "userVerification": "preferred"
  }
}
```

**Note:** Use this response with `navigator.credentials.create()` in the browser.

---

### Verify Registration

Complete passkey registration by verifying the WebAuthn response.

```http
POST /api/auth/passkeys/verify-registration
```

**Headers:**
```http
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "MacBook Pro Touch ID",
  "credential": {
    "id": "AVdGcO...",
    "rawId": "AVdGcO...",
    "response": {
      "attestationObject": "o2NmbXRk...",
      "clientDataJSON": "eyJ0eXBl..."
    },
    "type": "public-key",
    "clientExtensionResults": {},
    "transports": ["internal"]
  }
}
```

**Response:** `200 OK`
```json
{
  "passkey": {
    "id": 1,
    "user_id": 1,
    "name": "MacBook Pro Touch ID",
    "credential_id": "AVdGcO...",
    "transports": ["internal"],
    "created_at": "2024-01-15T10:30:00Z",
    "last_used_at": null
  }
}
```

**Errors:**
- `400` - No registration in progress or verification failed
- `500` - Unable to verify passkey registration

---

### Generate Authentication Options

Start passkey sign-in by generating WebAuthn challenge.

```http
POST /api/auth/passkeys/auth-options
```

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:** `200 OK`
```json
{
  "challenge": "3Q2+7w...",
  "timeout": 60000,
  "rpId": "localhost",
  "allowCredentials": [
    {
      "id": "AVdGcO...",
      "type": "public-key",
      "transports": ["internal"]
    }
  ],
  "userVerification": "preferred"
}
```

**Note:** Use this response with `navigator.credentials.get()` in the browser.

**Errors:**
- `400` - Missing email or no passkeys registered
- `500` - Unable to generate authentication options

---

### Verify Authentication

Complete passkey sign-in by verifying the WebAuthn response.

```http
POST /api/auth/passkeys/verify-authentication
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "credential": {
    "id": "AVdGcO...",
    "rawId": "AVdGcO...",
    "response": {
      "authenticatorData": "SZYN5YgO...",
      "clientDataJSON": "eyJ0eXBl...",
      "signature": "MEUCIQDm...",
      "userHandle": "MQ=="
    },
    "type": "public-key",
    "clientExtensionResults": {}
  }
}
```

**Response:** `200 OK`
```json
{
  "message": "Passkey sign-in successful",
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

**Errors:**
- `400` - Missing email or credential
- `401` - Passkey verification failed
- `404` - User or passkey not found
- `500` - Unable to verify passkey authentication

---

### Delete Passkey

Remove a passkey from the user's account.

```http
DELETE /api/auth/passkeys/:id
```

**Headers:**
```http
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "message": "Passkey deleted successfully"
}
```

**Errors:**
- `404` - Passkey not found or not owned by user
- `500` - Unable to delete passkey

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
- **Manager:** All assets (same as admin)
- **Admin:** All assets

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "employee_first_name": "John",
    "employee_last_name": "Doe",
    "employee_email": "john@example.com",
    "manager_first_name": "Jane",
    "manager_last_name": "Smith",
    "manager_email": "jane@example.com",
    "company_name": "Acme Corp",
    "laptop_make": "Apple",
    "laptop_model": "MacBook Pro 16\"",
    "laptop_serial_number": "SN123456",
    "laptop_asset_tag": "ASSET-001",
    "status": "active",
    "issued_date": "2024-01-01",
    "returned_date": null,
    "registration_date": "2024-01-01T00:00:00.000Z",
    "last_updated": "2024-01-01T00:00:00.000Z",
    "notes": "Primary development laptop"
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
  "employee_first_name": "John",
  "employee_last_name": "Doe",
  "employee_email": "john@example.com",
  "manager_first_name": "Jane",
  "manager_last_name": "Smith",
  "manager_email": "jane@example.com",
  "company_name": "Acme Corp",
  "laptop_make": "Apple",
  "laptop_model": "MacBook Pro 16\"",
  "laptop_serial_number": "SN123456",
  "laptop_asset_tag": "ASSET-001",
  "status": "active",
  "issued_date": "2024-01-01",
  "notes": "Primary development laptop"
}
```

**Required Fields:**
- `employee_first_name` - Employee's first name
- `employee_last_name` - Employee's last name
- `employee_email` - Employee's email address
- `company_name` - Client company name
- `laptop_serial_number` - Unique laptop serial number
- `laptop_asset_tag` - Unique asset tag

**Optional Fields:**
- `manager_first_name` - Manager's first name
- `manager_last_name` - Manager's last name
- `manager_email` - Manager's email address
- `laptop_make` - Laptop manufacturer (Dell, Apple, Lenovo, etc.)
- `laptop_model` - Laptop model
- `status` - Asset status (defaults to 'active')
- `issued_date` - Date asset was issued to employee (YYYY-MM-DD format)
- `notes` - Additional notes

**Conditional Fields:**
- `returned_date` - Required when status is 'returned' (YYYY-MM-DD format)

**Response:** `201 Created`
```json
{
  "message": "Asset registered successfully",
  "asset": {
    "id": 1,
    "employee_first_name": "John",
    "employee_last_name": "Doe",
    "employee_email": "john@example.com",
    "manager_first_name": "Jane",
    "manager_last_name": "Smith",
    "manager_email": "jane@example.com",
    "company_name": "Acme Corp",
    "laptop_make": "Apple",
    "laptop_model": "MacBook Pro 16\"",
    "laptop_serial_number": "SN123456",
    "laptop_asset_tag": "ASSET-001",
    "status": "active",
    "issued_date": "2024-01-01",
    "returned_date": null,
    "registration_date": "2024-01-01T00:00:00.000Z",
    "last_updated": "2024-01-01T00:00:00.000Z",
    "notes": "Primary development laptop"
  }
}
```

**Errors:**
- `400` - Missing required fields (employee_first_name, employee_last_name, employee_email, company_name, laptop_serial_number, laptop_asset_tag)
- `400` - Missing returned_date when status is 'returned'
- `409` - Duplicate serial number or asset tag

---

### Bulk Import Assets

Import multiple assets from a CSV file (Admin & Manager only).

```http
POST /api/assets/import
Content-Type: multipart/form-data
```

**Request:**
- Form field: `file` (CSV file)

**CSV Format:**
Required columns:
- `employee_first_name`
- `employee_last_name`
- `employee_email`
- `company_name`
- `laptop_serial_number`
- `laptop_asset_tag`

Optional columns:
- `manager_first_name`
- `manager_last_name`
- `manager_email`
- `laptop_make`
- `laptop_model`
- `status` (active, returned, lost, damaged, retired)
- `issued_date` (YYYY-MM-DD format)
- `returned_date` (YYYY-MM-DD format, should be provided when status is 'returned')
- `notes`

**Example CSV:**
```csv
employee_first_name,employee_last_name,employee_email,manager_first_name,manager_last_name,manager_email,company_name,laptop_make,laptop_model,laptop_serial_number,laptop_asset_tag,status,issued_date,returned_date,notes
Jane,Doe,jane.doe@example.com,John,Manager,john.manager@example.com,Acme Corp,Lenovo,ThinkPad T14,ABC12345,AT-1001,active,2024-01-15,,Primary laptop issued Q1
Sam,Smith,sam.smith@example.com,John,Manager,john.manager@example.com,Globex Inc,Apple,MacBook Pro,XYZ98765,AT-1002,returned,2023-06-01,2024-01-10,Returned after project completion
```

**Response:** `200 OK`
```json
{
  "message": "Imported 2 assets",
  "imported": 2,
  "failed": 0,
  "errors": []
}
```

**Response with Errors:** `200 OK`
```json
{
  "message": "Imported 1 assets with 1 issues",
  "imported": 1,
  "failed": 1,
  "errors": [
    "Row 3: Asset with this serial number or asset tag already exists"
  ]
}
```

**Errors:**
- `400` - No file uploaded or invalid CSV format
- `403` - Insufficient permissions (employees cannot bulk import)

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
  "returned_date": "2024-01-15",
  "notes": "Returned to IT department"
}
```

**Fields:**
- `status` - New status (active, returned, lost, damaged, retired)
- `returned_date` - Required when status is 'returned' (YYYY-MM-DD format)
- `notes` - Optional notes about the status change

**Response:** `200 OK`
```json
{
  "message": "Asset status updated successfully",
  "asset": {
    "id": 1,
    "status": "returned",
    "returned_date": "2024-01-15",
    "last_updated": "2024-01-15T10:00:00.000Z",
    "notes": "Returned to IT department"
  }
}
```

**Errors:**
- `404` - Asset not found
- `400` - Invalid status
- `400` - Missing returned_date when status is 'returned'

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
- **Manager:** All logs (same as admin)
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

**Role-Based Filtering:**
- **Employee:** Only own assets
- **Manager:** All assets (same as admin)
- **Admin:** All assets

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

## Attestation Endpoints

### Create Campaign (Admin)

Create a new attestation campaign.

```http
POST /api/attestation/campaigns
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
  "name": "Q1 2024 Asset Attestation",
  "description": "Please review and confirm all assets in your possession",
  "start_date": "2024-01-01",
  "end_date": "2024-01-31",
  "reminder_days": 7,
  "escalation_days": 10
}
```

**Response:** `201 Created`
```json
{
  "message": "Campaign created successfully",
  "campaign": {
    "id": 1,
    "name": "Q1 2024 Asset Attestation",
    "description": "Please review and confirm all assets in your possession",
    "start_date": "2024-01-01",
    "end_date": "2024-01-31",
    "reminder_days": 7,
    "escalation_days": 10,
    "status": "draft",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

**Errors:**
- `400` - Missing required fields
- `403` - Not an admin

---

### List Campaigns (Admin)

Get all attestation campaigns.

```http
GET /api/attestation/campaigns
```

**Permissions:** Admin only

**Response:** `200 OK`
```json
{
  "campaigns": [
    {
      "id": 1,
      "name": "Q1 2024 Asset Attestation",
      "description": "Please review and confirm all assets in your possession",
      "start_date": "2024-01-01",
      "end_date": "2024-01-31",
      "reminder_days": 7,
      "escalation_days": 10,
      "status": "active",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### Get Campaign Details (Admin)

Get details of a specific campaign.

```http
GET /api/attestation/campaigns/:id
```

**Permissions:** Admin only

**Response:** `200 OK`
```json
{
  "id": 1,
  "name": "Q1 2024 Asset Attestation",
  "description": "Please review and confirm all assets in your possession",
  "start_date": "2024-01-01",
  "end_date": "2024-01-31",
  "reminder_days": 7,
  "escalation_days": 10,
  "status": "active",
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

**Errors:**
- `404` - Campaign not found

---

### Update Campaign (Admin)

Update a draft campaign.

```http
PUT /api/attestation/campaigns/:id
```

**Permissions:** Admin only

**Request Body:**
```json
{
  "name": "Updated Campaign Name",
  "description": "Updated description",
  "start_date": "2024-01-05",
  "end_date": "2024-02-05",
  "reminder_days": 10,
  "escalation_days": 14
}
```

**Response:** `200 OK`
```json
{
  "message": "Campaign updated successfully"
}
```

**Errors:**
- `400` - Cannot update non-draft campaign
- `404` - Campaign not found

---

### Start Campaign (Admin)

Launch an attestation campaign.

```http
POST /api/attestation/campaigns/:id/start
```

**Permissions:** Admin only

**Response:** `200 OK`
```json
{
  "message": "Campaign started successfully",
  "recordsCreated": 25
}
```

**What happens:**
- Creates attestation records for all active employees
- Sends launch emails to all employees
- Changes campaign status to "active"

**Errors:**
- `400` - Campaign already started or not in draft status
- `404` - Campaign not found

---

### Cancel Campaign (Admin)

Cancel an active campaign.

```http
POST /api/attestation/campaigns/:id/cancel
```

**Permissions:** Admin only

**Response:** `200 OK`
```json
{
  "message": "Campaign cancelled successfully"
}
```

**Errors:**
- `400` - Campaign not active
- `404` - Campaign not found

---

### Get Campaign Dashboard (Admin)

Get campaign statistics and employee records.

```http
GET /api/attestation/campaigns/:id/dashboard
```

**Permissions:** Admin only

**Response:** `200 OK`
```json
{
  "campaign": {
    "id": 1,
    "name": "Q1 2024 Asset Attestation",
    "status": "active"
  },
  "stats": {
    "total_employees": 25,
    "completed": 18,
    "pending": 7,
    "completion_rate": 72,
    "reminders_sent": 5,
    "escalations_sent": 2
  },
  "records": [
    {
      "id": 1,
      "user_email": "john@example.com",
      "user_name": "John Doe",
      "status": "completed",
      "assets_attested": 3,
      "new_assets_reported": 0,
      "completed_at": "2024-01-05T10:30:00.000Z"
    }
  ]
}
```

---

### Export Campaign Results (Admin)

Download campaign results as CSV.

```http
GET /api/attestation/campaigns/:id/export
```

**Permissions:** Admin only

**Response:** `200 OK`
```
Content-Type: text/csv
Content-Disposition: attachment; filename=attestation-campaign-1.csv

User Email,User Name,Status,Assets Attested,New Assets Reported,Completed At
john@example.com,John Doe,completed,3,0,2024-01-05T10:30:00.000Z
```

---

### Get My Attestations (All Users)

Get pending attestations for current user.

```http
GET /api/attestation/my-attestations
```

**Response:** `200 OK`
```json
{
  "attestations": [
    {
      "id": 1,
      "campaign_id": 1,
      "campaign_name": "Q1 2024 Asset Attestation",
      "campaign_description": "Please review and confirm all assets in your possession",
      "status": "pending",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### Get Attestation Details (All Users)

Get details of a specific attestation record.

```http
GET /api/attestation/records/:id
```

**Response:** `200 OK`
```json
{
  "id": 1,
  "campaign_id": 1,
  "campaign_name": "Q1 2024 Asset Attestation",
  "status": "in_progress",
  "assets": [
    {
      "id": 1,
      "asset_id": 101,
      "laptop_make": "Apple",
      "laptop_model": "MacBook Pro 16\"",
      "laptop_serial_number": "SN123456",
      "laptop_asset_tag": "ASSET-001",
      "current_status": "active",
      "attested": false
    }
  ],
  "new_assets": []
}
```

**Errors:**
- `403` - Not your attestation record
- `404` - Record not found

---

### Attest Asset (All Users)

Confirm or update an asset during attestation.

```http
PUT /api/attestation/records/:id/assets/:assetId
```

**Request Body:**
```json
{
  "status": "active",
  "notes": "Asset in good condition"
}
```

**Request Body (when status is 'returned'):**
```json
{
  "status": "returned",
  "returned_date": "2024-01-15",
  "notes": "Returned to IT department"
}
```

**Fields:**
- `status` - Asset status (active, returned, lost, damaged)
- `returned_date` - Required when status is 'returned' (YYYY-MM-DD format)
- `notes` - Optional notes

**Response:** `200 OK`
```json
{
  "message": "Asset attested successfully"
}
```

**Errors:**
- `400` - Missing returned_date when status is 'returned'
- `403` - Not your attestation record
- `404` - Record or asset not found

---

### Add New Asset During Attestation (All Users)

Report an unregistered asset discovered during attestation.

```http
POST /api/attestation/records/:id/assets/new
```

**Request Body:**
```json
{
  "asset_type": "laptop",
  "laptop_make": "Dell",
  "laptop_model": "Latitude 5420",
  "laptop_serial_number": "SN789012",
  "laptop_asset_tag": "ASSET-999",
  "issued_date": "2024-01-01",
  "notes": "Found this device that wasn't in the system"
}
```

**Fields:**
- `asset_type` - Type of asset (laptop, mobile phone)
- `laptop_make` - Manufacturer
- `laptop_model` - Model name
- `laptop_serial_number` - Serial number
- `laptop_asset_tag` - Asset tag
- `issued_date` - Optional date asset was issued (YYYY-MM-DD format)
- `notes` - Optional notes

**Response:** `201 Created`
```json
{
  "message": "New asset reported successfully",
  "id": 5
}
```

**Errors:**
- `403` - Not your attestation record
- `404` - Record not found

---

### Complete Attestation (All Users)

Mark attestation as complete.

```http
POST /api/attestation/records/:id/complete
```

**Response:** `200 OK`
```json
{
  "message": "Attestation completed successfully"
}
```

**What happens:**
- Changes status to "completed"
- Records completion timestamp
- Sends notification to admin
- Prevents further modifications

**Errors:**
- `400` - Not all assets attested
- `403` - Not your attestation record
- `404` - Record not found

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
