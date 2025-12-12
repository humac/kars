# Admin Guide

Complete guide for system administrators.

## 📋 Table of Contents

1. [Admin Overview](#admin-overview)
2. [First Admin Setup](#first-admin-setup)
3. [User Management](#user-management)
4. [Company Management](#company-management)
5. [System Monitoring](#system-monitoring)
6. [Audit & Compliance](#audit--compliance)
7. [Security Best Practices](#security-best-practices)
8. [Backup & Maintenance](#backup--maintenance)

## Admin Overview

As an administrator, you have full access to all system features and settings. The admin role includes exclusive access to:

- **User Management** - Add, edit, and remove users; change roles
- **Company Management** - Full CRUD operations on companies
- **Complete Audit Logs** - View all system activity
- **All Assets** - View and manage all registered assets
- **System Settings** - Configure application settings

### Admin Navigation

Admins see additional tabs in the navigation:
- **Company Management** (admin-only tab)
- **Admin Settings** (purple tab, admin-only)

## First Admin Setup

### Method 1: First User Automatic Promotion (Recommended)

The **very first user** to register automatically becomes an admin.

**Steps:**
1. Deploy the application
2. Navigate to the registration page
3. Register your account
4. You'll be automatically assigned the admin role
5. Login and access all admin features

**Console Output:**
```
Creating admin user: your-email@domain.com (first user)
```

### Method 2: Environment Variable

Set a specific email to always become admin upon registration.

**Steps:**
1. Edit your `.env` file (or set in Portainer)
2. Add: `ADMIN_EMAIL=your-admin@domain.com`
3. Restart the backend service
4. Register with that email
5. You'll be assigned admin role

**Console Output:**
```
Creating admin user: your-admin@domain.com (admin email match)
```

### Method 3: Promote Existing User

If you're already an admin, promote another user:

1. Go to the **Users** page from the main navigation
2. Find the user in the table
3. Change their role dropdown to "Admin"
4. Role is updated immediately

## User Management

Access: **Users** page (main navigation - accessible to Managers and Admins)

**Managers** have read-only access to view user information, while **Admins** have full access to manage users.

### Viewing Users

The user table shows:
- **Name** - User's full name
- **Email** - User's email address
- **Role** - Current role (dropdown)
- **Created** - Account creation date
- **Last Login** - Last successful login
- **Actions** - Delete button

Total user count displayed at top right.

### Changing User Roles

**To change a user's role:**
1. Locate user in the table
2. Click the **Role** dropdown
3. Select new role:
   - Employee (default)
   - Manager
   - Admin
4. Change is saved automatically

**Restrictions:**
- Cannot change your own role
- Your role dropdown is disabled
- Prevents accidental self-demotion

**Role Capabilities:**

Understanding the permissions for each role is crucial for effective user management. Below is a comprehensive matrix showing what each role can do:

#### 📋 Role/Permissions Matrix

| Feature | Employee | Manager | Admin |
|---------|:--------:|:-------:|:-----:|
| **Assets** | | | |
| View own assets | ✅ | ✅ | ✅ |
| View team assets (direct reports) | ❌ | ✅ | ✅ |
| View all assets | ❌ | ✅ | ✅ |
| Register own assets | ✅ | ✅ | ✅ |
| Register assets for others | ❌ | ✅ | ✅ |
| Edit own assets | ✅ | ✅ | ✅ |
| Edit team assets | ❌ | ❌ | ✅ |
| Edit all assets | ❌ | ❌ | ✅ |
| Bulk import assets (CSV) | ❌ | ✅ | ✅ |
| **Companies** | | | |
| View company names (dropdown) | ✅ | ✅ | ✅ |
| Create companies | ❌ | ❌ | ✅ |
| Edit companies | ❌ | ❌ | ✅ |
| Delete companies | ❌ | ❌ | ✅ |
| Bulk import companies (CSV) | ❌ | ❌ | ✅ |
| **Users** | | | |
| View users page | ❌ | ✅ (read-only) | ✅ |
| Add new users | ❌ | ❌ | ✅ |
| Edit user roles | ❌ | ❌ | ✅ |
| Delete users | ❌ | ❌ | ✅ |
| **Audit & Reporting** | | | |
| View own audit logs | ✅ | ✅ | ✅ |
| View team audit logs | ❌ | ✅ | ✅ |
| View all audit logs | ❌ | ✅ | ✅ |
| Export audit logs (CSV) | ✅ (own) | ✅ (all) | ✅ (all) |
| View summary reports | ✅ (own) | ✅ (all) | ✅ (all) |
| **Profile & Security** | | | |
| Update own profile | ✅ | ✅ | ✅ |
| Change own password | ✅ | ✅ | ✅ |
| Enable/disable MFA | ✅ | ✅ | ✅ |
| Register passkeys | ✅ | ✅ | ✅ |
| **Admin Settings** | | | |
| Access Admin Settings | ❌ | ❌ | ✅ |
| Configure OIDC/SSO | ❌ | ❌ | ✅ |
| Configure passkey settings | ❌ | ❌ | ✅ |
| Manage branding | ❌ | ❌ | ✅ |
| Configure database engine | ❌ | ❌ | ✅ |
| Configure email/SMTP | ❌ | ❌ | ✅ |

**Key Differences:**
- **Employee**: Limited to personal asset management and profile settings
- **Manager**: Can view all assets and audit logs; bulk import assets; read-only access to users page; cannot edit other users' assets or access admin settings
- **Admin**: Full system access including user management, company management, and all admin settings

### Automatic Manager Role Assignment

- When users register or update their profile with a **manager email** matching an existing account, that person is automatically promoted to **Manager** (unless already Manager/Admin).
- If a newly registered user already has employees pointing to their email as manager, their role is automatically promoted to **Manager**.
- All auto-promotions are logged in the audit trail so admins can review and adjust roles if needed.

### Deleting Users

**To delete a user:**
1. Find user in the table
2. Click the **Delete** button (red)
3. Confirm the deletion
4. User is permanently removed

**Restrictions:**
- Cannot delete yourself
- Your delete button is disabled
- Prevents accidental self-deletion

**What gets deleted:**
- User account and credentials
- User profile information

**What remains:**
- Audit logs (user_email preserved)
- Assets created by user (employee_email preserved)

### User Statistics

View in **Admin Settings** → **System Overview**:
- Total users count
- Number of admins
- Number of managers
- Number of employees

## Company Management

Access: **Company Management** tab (admin-only)

### Viewing Companies

Companies listed in a table with:
- **Name** - Company name
- **Description** - Optional description
- **Created Date** - When added
- **Actions** - Edit, Delete buttons

### Adding a Company

**To add a new company:**
1. Go to **Company Management**
2. Click **+ Add Company** button
3. Enter company details:
   - **Name** (required, must be unique)
   - **Description** (optional)
4. Click **Save**
5. Company appears in list

**What happens:**
- Company added to database
- Available in dropdown for asset registration
- All users can now select this company
- Action logged in audit trail

### Editing a Company

**To edit a company:**
1. Find company in the table
2. Click **Edit** button (pencil icon)
3. Modify details:
   - Change name
   - Update description
4. Click **Save**
5. Changes applied immediately

**Restrictions:**
- Company name must be unique
- Cannot use name of existing company

### Deleting a Company

**To delete a company:**
1. Find company in the table
2. Click **Delete** button (trash icon)
3. Confirm deletion

**Protection:**
- Cannot delete if assets exist with this company
- Error message: "Cannot delete company with existing assets"
- Must reassign or delete assets first

**Safe deletion process:**
1. Search for assets with this company
2. Update assets to different company OR delete assets
3. Then delete the company

### Company Dropdown

All users (including employees and managers) can see company names in the dropdown when registering assets. This uses the `/api/companies/names` endpoint which returns only ID and name.

**Only admins** can:
- Add new companies
- Edit existing companies
- Delete companies

## System Monitoring

### System Overview Dashboard

Access: **Admin Settings** → **System Overview**

**Statistics Cards:**
- **Total Users** - All registered users
- **Administrators** - Admin count (purple)
- **Managers** - Manager count (green)
- **Employees** - Employee count (blue)

**System Information:**
- Application name and purpose
- SOC2 compliance statement
- Feature list
- Version information

### Health Monitoring

**Backend Health:**
- Endpoint: `/api/health`
- Returns: `{ status: 'ok', message: 'Asset Registration API is running' }`

**Check via Docker:**
```bash
docker exec asset-registration-backend curl http://localhost:3001/api/health
```

**Health Checks:**
- Backend: Every 30 seconds
- Frontend: Every 30 seconds
- Start period: 40 seconds
- Retries: 3 before marking unhealthy

### Container Monitoring

In Portainer:
1. Go to **Containers**
2. View status of:
   - `asset-registration-backend`
   - `asset-registration-frontend`
3. Check:
   - CPU usage
   - Memory usage
   - Network traffic
   - Uptime

### Log Monitoring

**View backend logs:**
```bash
docker logs asset-registration-backend
```

**View frontend logs:**
```bash
docker logs asset-registration-frontend
```

**Follow logs in real-time:**
```bash
docker logs -f asset-registration-backend
```

**Important log messages:**
- `Creating admin user: email (first user)` - Admin created
- `Database initialized successfully` - DB ready
- `Server listening on port 3001` - Backend started

## Audit & Compliance

### Viewing Audit Logs

Access: **Audit & Reporting** → **Audit Logs** tab

**As admin or manager, you see:**
- All audit logs from all users
- Complete system activity history
- No filtering based on user

**Filtering Options:**
- **Action Type:** CREATE, STATUS_CHANGE, UPDATE, DELETE
- **Entity Type:** asset, company
- **Date Range:** Start and end dates
- **User Email:** Filter by who performed the action
- **Limit:** 50, 100, 250, 500, or all records

### Audit Log Details

Each log entry shows:
- **Timestamp** - When action occurred
- **Action** - What was done
- **Entity Type** - What was affected
- **Entity Name** - Specific item
- **Details** - Additional information (JSON)
- **User Email** - Who did it

### Exporting Audit Logs

**To export logs:**
1. Go to **Audit & Reporting** → **Audit Logs**
2. Apply any desired filters
3. Click **Export to CSV**
4. File downloads automatically
5. Filename: `audit-logs-YYYY-MM-DD.csv`

**CSV includes:**
- ID, Timestamp, Action
- Entity Type, Entity Name
- Details, User Email

**Use cases:**
- SOC2 audit submissions
- Compliance reporting
- Security investigations
- Activity analysis

### Compliance Reports

Access: **Audit & Reporting** → **Summary Report**

**Report includes:**
- **Total Assets** - System-wide count
- **By Status** - Breakdown by asset status
- **By Company** - Assets per client
- **By Manager** - Assets per manager

**Statistics Tab:**
- Action counts by type
- Entity type statistics
- Time-based filtering

### SOC2 Compliance Features

✅ **Asset Tracking** - Complete laptop inventory
✅ **User Attribution** - Every action tied to a user
✅ **Timestamp Logging** - When everything occurred
✅ **Audit Trail** - Immutable activity log
✅ **Access Control** - Role-based permissions
✅ **Data Export** - Compliance report generation
✅ **Change Tracking** - Status change history

## Security Best Practices

### User Access Reviews

**Quarterly Tasks:**
1. Review **User Management** table
2. Check for:
   - Inactive users (old last login)
   - Terminated employees
   - Incorrect role assignments
3. Remove or update as needed
4. Document changes

### Role Management

**Guidelines:**
- **Principle of Least Privilege:** Assign minimum necessary role
- **Regular Reviews:** Audit roles quarterly
- **Manager Promotion:** Verify before promoting to manager
- **Admin Restrictions:** Limit admin count to 2-3 trusted users
- **Document Changes:** Keep record of role modifications

### Password Security

**Recommendations:**
- Enforce strong passwords (current minimum: 6 characters)
- Consider implementing:
  - Password complexity requirements
  - Regular password rotation
  - Multi-factor authentication (future enhancement)

**Current implementation:**
- bcrypt hashing (10 rounds)
- Passwords never stored in plain text
- Password confirmation on registration

### JWT Secret Management

**Critical:**
- Use strong, random JWT_SECRET
- Minimum 64 characters recommended
- Never commit to version control
- Rotate periodically (requires all users to re-login)

**Generate strong secret:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Update in Portainer:**
1. Go to stack environment variables
2. Update `JWT_SECRET`
3. Redeploy stack
4. All users must login again

### Audit Log Review

**Monthly Tasks:**
1. Export full audit logs
2. Review for:
   - Unusual activity patterns
   - Failed login attempts (future)
   - Bulk deletions
   - Off-hours activity
3. Investigate anomalies
4. Document findings

### System Updates

**Stay current:**
- Monitor GitHub for updates
- Review changelogs
- Test in staging first
- Schedule maintenance windows
- Backup before updating

## Backup & Maintenance

### Database Backups

**Manual Backup:**
```bash
# Create backup
docker run --rm \
  -v asset-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/asset-data-backup-$(date +%Y%m%d).tar.gz -C /data .
```

**Automated Backups:**
Schedule via cron:
```bash
# Daily at 2 AM
0 2 * * * cd /backup/location && docker run --rm -v asset-data:/data -v $(pwd):/backup alpine tar czf /backup/asset-data-$(date +\%Y\%m\%d).tar.gz -C /data .
```

**Backup Retention:**
- Daily backups: Keep 7 days
- Weekly backups: Keep 4 weeks
- Monthly backups: Keep 12 months

### Restore Database

**From backup:**
```bash
# Stop containers
docker-compose down

# Restore data
docker run --rm \
  -v asset-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/asset-data-backup-YYYYMMDD.tar.gz -C /data

# Start containers
docker-compose up -d
```

### Maintenance Tasks

**Weekly:**
- Review error logs
- Check disk space
- Monitor container health

**Monthly:**
- Review audit logs
- Check for updates
- Test backups (restore to staging)
- Review user access

**Quarterly:**
- User access review
- Role audit
- Security assessment
- Compliance check

### Disaster Recovery

**Preparation:**
1. Maintain offsite backups
2. Document recovery procedures
3. Test recovery process
4. Keep environment config backed up

**Recovery Steps:**
1. Provision new server
2. Install Docker and Portainer
3. Deploy stack
4. Restore database backup
5. Verify application functionality
6. Update DNS if needed

## Application Settings

Access: **Admin Settings** → **Application Settings**

### Company Management Guidance

- Link to Company Management tab
- Explanation of company CRUD operations
- Best practices for organization

### Audit & Compliance

- Feature overview
- Audit trail capabilities
- CSV export documentation
- Role-based visibility explanation

### Data Management

- SQLite information
- Backup recommendations
- Best practices:
  - Regular database backups
  - Periodic audit log reviews
  - User access reviews (quarterly)
  - Asset verification (monthly)

### Security Recommendations

⚠️ **Security Best Practices:**
- Regularly review user roles and permissions
- Remove inactive user accounts
- Enforce strong password policies
- Monitor audit logs for suspicious activity
- Keep the application updated

---

**Need help?** Review the [Quick Start](Quick-Start) for role walkthroughs or the [Deployment Guide](Deployment-Guide) for operational tips.
