# Features

Complete feature overview of the KeyData Asset Registration System (KARS).

## 🎯 Core Features

### Asset Management

**Asset Registration**
- Self-service registration by consultants
- Required fields: employee name/email, manager name/email, client company, serial number, asset tag
- Optional notes field for additional information
- Company selection via dropdown (populated from admin-managed companies)
- Automatic timestamp tracking (registration date, last updated)

**Asset Tracking**
- View all assets you have access to (based on role)
- Search and filter by:
  - Employee name or email
  - Manager name or email
  - Client company
  - Asset status
- Clear filter button to reset all filters
- Asset count display
- Sortable table view with pagination

**Asset Status Management**
- Update asset status: Active, Returned, Lost, Damaged, Retired
- Add notes when updating status
- Status change tracking in audit logs
- Visual status badges with color coding
- History of all status changes

### User Authentication

**Registration & Login**
- Secure user registration with email and password
- Password requirements: minimum 6 characters
- Password confirmation during registration
- First name and last name collection
- JWT token-based authentication
- Remember me functionality via localStorage
- Secure password hashing (bcrypt, 10 rounds)
- 7-day token expiration

**Passkey/WebAuthn Support**
- FIDO2/WebAuthn standard compliance for passwordless authentication
- Platform authenticators:
  - Touch ID (macOS/iOS)
  - Face ID (iOS)
  - Windows Hello (Windows)
  - Android biometric unlock
- Security key support:
  - YubiKey
  - Titan Security Key
  - Any FIDO2-compliant hardware key
- Passkey management from Profile:
  - Register multiple passkeys per account
  - Name passkeys for easy identification
  - View all registered passkeys with creation dates
  - Delete unused passkeys
  - Track last usage timestamp
- Passwordless sign-in:
  - "Sign in with Passkey" button on login page
  - Email-based passkey discovery
  - Automatic credential selection (when available)
  - Fallback to password if needed
- Enhanced security:
  - Phishing-resistant authentication
  - No passwords to leak or guess
  - Hardware-bound credentials
  - Counter-based replay protection
  - Transport preference tracking (USB, NFC, BLE, internal)

**Multi-Factor Authentication (MFA/2FA)**
- TOTP-based two-factor authentication
- QR code enrollment with authenticator apps:
  - Google Authenticator
  - Microsoft Authenticator
  - Authy
  - Any TOTP-compatible app
- Manual secret key entry option
- 6-digit verification codes with clock drift tolerance
- 10 backup codes for account recovery
- One-time use backup codes (consumed after use)
- User-controlled enrollment from profile
- Password confirmation required to disable MFA
- Audit logging of MFA enable/disable actions
- Modal-based setup wizard with 3 steps:
  1. QR code scanning
  2. Code verification
  3. Backup code storage

**OIDC/SSO Authentication**
- External identity provider integration:
  - Auth0
  - Google Workspace
  - Azure AD
  - Okta
  - Any OIDC-compliant provider
- Just-In-Time (JIT) user provisioning
- Role mapping from OIDC claims/scopes
- Configurable role claim path
- Default role assignment for new users
- Database-backed configuration (no env vars)
- Admin UI for SSO settings management
- PKCE flow for enhanced security
- State token CSRF protection
- Automatic account linking by email
- Seamless "Sign In with SSO" button
- Optional SSO (can be disabled)

**Profile Management**
- Update first name and last name
- View current role and email
- Upload and manage a personal profile photo for the header avatar
- Change password with current password verification
- Color-coded role badge display
- MFA enrollment status display
- Enable/disable two-factor authentication
- Passkey management:
  - View all registered passkeys
  - Register new passkeys with custom names
  - Delete unused passkeys
  - See passkey creation and last usage dates
- Real-time profile updates (no page reload)
- Profile data validation
- Four-tab layout: Account Info, Security (Password + MFA), Passkeys, Manager Info

### Role-Based Access Control (RBAC)

**Three User Roles:**

**Employee**
- Register and manage own assets
- View only assets where they are listed as employee
- Update status of own assets
- View own audit logs
- Access profile management

**Manager**
- All employee capabilities
- View assets where they are listed as manager
- View assets of employees they manage
- Access team audit logs and reports
- View aggregated team statistics

**Admin**
- Full system access
- Manage all users (view, edit roles, delete)
- Manage all companies (add, edit, delete)
- View all assets and audit logs
- Access admin settings panel
- System configuration and monitoring

**Automatic Manager Role Assignment**
- When a user registers with a **manager email** that matches an existing account, that person is automatically promoted to **Manager** (unless already Manager/Admin).
- If a newly registered user already has employees pointing to their email as manager, their role is auto-promoted to **Manager**.
- Manager role auto-promotions are logged for auditability.

### Company Management

**Admin-Only Features:**
- Add new client companies via modal dialog
- Edit company details (name, description)
- Delete companies (with protection if assets exist)
- View company list with creation dates
- Modal-based interface for focused data entry
- Clean card-based layout
- Automatic dropdown population for asset registration

**All User Access:**
- View company names in dropdown during asset registration
- Select from existing companies when registering assets

### Audit & Reporting

**Comprehensive Audit Logging**
- Automatic logging of all system operations:
  - Asset creation
  - Asset updates
  - Status changes
  - Company management actions
  - User management actions
- Captured information:
  - Action type (CREATE, UPDATE, STATUS_CHANGE, DELETE)
  - Entity type (asset, company, user)
  - Entity details
  - User email (who performed the action)
  - Timestamp (when it occurred)

**Audit Log Viewing**
- Three-tabbed interface:
  - Audit Logs (detailed activity log)
  - Summary Report (aggregated statistics)
  - Statistics (action counts)
- Filtering options:
  - By action type
  - By entity type
  - By date range
  - By user email
  - Limit results (50, 100, 250, 500, or all)
- Role-based log visibility:
  - Employees see only their logs
  - Managers see team logs
  - Admins see all logs

**Reporting Features**
- Asset summary report with breakdowns:
  - Total asset count
  - By status (active, returned, etc.)
  - By company
  - By manager
- CSV export functionality
- Customizable export filters
- Downloadable compliance reports

### Admin Settings

**User Management**
- View all registered users
- See user details:
  - Name, email, role
  - Account creation date
  - Last login timestamp
- Change user roles via dropdown:
  - Promote to manager or admin
  - Demote to employee
- Delete user accounts
- Protection against self-modification
- Total user statistics

**System Overview**
- User count by role:
  - Total administrators
  - Total managers
  - Total employees
  - Total users
- System information display
- Feature highlights
- Version information

**Application Settings**
- Company management guidance
- Audit & compliance features overview
- Data management best practices
- Security recommendations:
  - Regular role reviews
  - Inactive account removal
  - Password policy enforcement
  - Audit log monitoring
  - System update reminders

**OIDC/SSO Configuration**
- Enable/disable SSO authentication
- Configure identity provider settings:
  - Issuer URL
  - Client ID
  - Client Secret (masked in UI)
  - Redirect URI
  - OAuth scopes
- Role mapping configuration:
  - Custom claim path for roles
  - Default role for new users
- Live configuration without server restart
- Database-backed settings (no env vars)
- Test SSO login from login page
- Track configuration changes in audit logs

## 🔐 Security Features

**Authentication Security**
- JWT token authentication
- Passkey/WebAuthn authentication (FIDO2)
- Multi-factor authentication (TOTP-based)
- OIDC/SSO integration with PKCE flow
- Secure password hashing (bcrypt, 10 rounds)
- Token expiration (7 days)
- Token verification on every request
- Automatic logout on invalid token
- Protected routes (backend middleware)
- MFA session timeout (5 minutes)
- State token CSRF protection for OAuth
- Backup code one-time consumption
- Hardware-bound passkey credentials
- Phishing-resistant authentication

**Authorization**
- Role-based access control
- Middleware authorization checks
- Admin-only endpoints protection
- Manager-level permission checks
- Data filtering by user role

**Data Protection**
- Input validation on all forms
- SQL injection prevention
- XSS protection
- CSRF token consideration
- Secure cookie handling
- HTTPS enforcement (via Cloudflare)

**Audit & Compliance**
- Complete activity logging
- User attribution for all actions
- Timestamp tracking
- Immutable audit trail
- SOC2 compliance support
- Export capabilities for audits

## 🎨 User Interface Features

**Material-UI Design System**
- Professional Material Design components
- Consistent design language across application
- Pre-built, accessible components
- Responsive grid system
- Theme customization support
- Icon library integration

**Responsive Design**
- Mobile-friendly interface
- Tablet optimization
- Desktop layouts
- Adaptive navigation
- Fluid typography
- Flexible component sizing

**Visual Feedback**
- Color-coded status badges with chips
- Role badges with distinct colors:
  - Admin: Error (Red)
  - Manager: Warning (Orange)
  - Employee: Info (Blue)
- Success/error alert messages
- Loading states with spinners
- Form validation feedback
- Snackbar notifications
- Progress indicators

**Navigation**
- Tabbed interface for main sections
- Conditional tab visibility based on role
- Active tab highlighting
- App bar with user menu
- Drawer navigation support
- Breadcrumb trails
- Logout functionality

**Modal Dialogs**
- MFA enrollment wizard (3-step stepper)
- MFA verification during login
- Company add/edit forms
- MFA disable confirmation
- Password confirmation dialogs
- Focused user interactions
- Backdrop blur effects
- Escape key handling

**Forms**
- Material-UI TextField components
- Inline validation with helper text
- Required field indicators
- Helpful placeholder text
- Error message display below fields
- Success confirmations with alerts
- Auto-focus on first field
- Disabled state during submission

**Cards & Layouts**
- Card-based information display
- Consistent spacing with Grid system
- Paper elevation for depth
- Divider components for sections
- Box components for layouts
- Flexbox utilities
- Equal-height card layouts

**Tables**
- Material-UI DataGrid ready
- Sortable columns
- Search functionality
- Filter controls
- Clear filters option
- Pagination support
- Empty state messages
- Action buttons per row
- Hover effects

## 🚀 Deployment Features

**Docker Support**
- Multi-stage frontend build
- Production-ready images
- Nginx reverse proxy
- Volume persistence
- Health checks
- Auto-restart policies

**CI/CD Integration**
- GitHub Actions workflow
- Automated builds on push
- Container registry integration
- Portainer webhook deployment
- Manual workflow dispatch
- Build caching for speed

**Cloudflare Integration**
- Tunnel configuration
- SSL/TLS termination
- DDoS protection
- CDN capabilities
- DNS management
- Secure external access

**Environment Configuration**
- Environment variable support
- Development vs production modes
- Configurable JWT secrets
- Admin email configuration
- Port configuration
- Database path configuration

## 📊 Data Management

**Database**
- SQLite (default) or PostgreSQL (production)
- Automatic schema creation for both engines
- Migration support
- Indexed tables for performance
- Foreign key constraints
- Transaction support
- Environment-based or config-based database selection
- PostgreSQL connection pooling
- SSL support for PostgreSQL connections

**Data Persistence**
- Docker volume mounting
- Backup capabilities
- Restore functionality
- Data export (CSV)
- Import considerations

**Data Validation**
- Email format validation
- Required field enforcement
- Unique constraint checking
- Serial number uniqueness
- Asset tag uniqueness
- Company name uniqueness

## 🔧 Developer Features

**API Design**
- RESTful endpoints
- JSON request/response
- Consistent error handling
- HTTP status codes
- CORS support
- API versioning ready

**Code Quality**
- Modular architecture
- Separation of concerns
- Database abstraction
- Authentication middleware
- Error handling
- Code comments

**Development Tools**
- Hot reload (Vite)
- Development mode
- Debug logging
- Error stack traces
- Health check endpoints

## 📈 Future Enhancement Possibilities

While not currently implemented, the architecture supports:
- Advanced reporting dashboards with charts
- Asset lifecycle management workflows
- Automated email notifications
- Bulk import/export capabilities
- Custom fields configuration
- Asset photos/document attachments
- Mobile app (React Native)
- API rate limiting and throttling
- WebSocket real-time updates
- Database encryption at rest
- Asset barcode scanning
- Scheduled reports
- Data retention policies
- Enhanced passkey features (conditional UI, autofill)

---

**Next:** Learn how to install and run the system locally → [Installation Guide](Installation)
