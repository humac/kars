# Asset Attestation Workflow Campaign Feature

## Overview

The Asset Attestation Workflow system allows system administrators to create monthly campaigns where employees attest to the status of their registered assets. This feature helps maintain accurate asset records and ensures SOC2 compliance.

## Architecture

### Database Schema

The feature adds 4 new tables to the database:

1. **attestation_campaigns** - Stores campaign information
   - Campaign name, description, dates
   - Reminder and escalation day settings
   - Status tracking (draft, active, completed, cancelled)
   - Targeting options (target_type, target_user_ids, target_company_ids)

2. **attestation_records** - Individual employee attestation records
   - Links campaigns to users
   - Tracks status (pending, in_progress, completed)
   - Records reminder and escalation timestamps

3. **attestation_assets** - Asset attestation details
   - Links attestation records to assets
   - Tracks status changes during attestation
   - Stores attestation notes

4. **attestation_new_assets** - New assets added during attestation
   - Assets discovered by employees that weren't registered
   - Full asset details for later registration

### Backend Components

**Database Layer** (`backend/database.js`)
- `attestationCampaignDb` - CRUD operations for campaigns
- `attestationRecordDb` - CRUD operations for attestation records
- `attestationAssetDb` - CRUD operations for attested assets
- `attestationNewAssetDb` - CRUD operations for new assets

**Email Service** (`backend/services/smtpMailer.js`)
- `sendAttestationLaunchEmail()` - Initial campaign notification
- `sendAttestationReminderEmail()` - Reminder to employees
- `sendAttestationEscalationEmail()` - Notification to managers
- `sendAttestationCompleteAdminNotification()` - Admin notification

**Background Scheduler** (`backend/services/attestationScheduler.js`)
- `processReminders()` - Sends automated reminders
- `processEscalations()` - Sends manager escalations
- `autoCloseExpiredCampaigns()` - Closes campaigns past end date
- `runScheduledTasks()` - Main scheduler function

**API Routes** (`backend/server.js`)

Admin endpoints:
- `POST /api/attestation/campaigns` - Create campaign
- `GET /api/attestation/campaigns` - List all campaigns
- `GET /api/attestation/campaigns/:id` - Get campaign details
- `PUT /api/attestation/campaigns/:id` - Update campaign
- `POST /api/attestation/campaigns/:id/start` - Start campaign
- `POST /api/attestation/campaigns/:id/cancel` - Cancel campaign
- `GET /api/attestation/campaigns/:id/dashboard` - Campaign dashboard
- `GET /api/attestation/campaigns/:id/export` - Export CSV

Employee endpoints:
- `GET /api/attestation/my-attestations` - Get pending attestations
- `GET /api/attestation/records/:id` - Get attestation details
- `PUT /api/attestation/records/:id/assets/:assetId` - Attest asset
- `POST /api/attestation/records/:id/assets/new` - Add new asset
- `POST /api/attestation/records/:id/complete` - Complete attestation

### Frontend Components

**AttestationPage.jsx** - Admin interface
- Campaign list with status badges
- Create campaign modal with configuration
- Campaign dashboard with completion statistics
- Employee records table
- Export functionality

**MyAttestationsPage.jsx** - Employee interface
- Pending attestation list
- Asset review table with confirmation buttons
- Add missing asset modal
- Attestation completion workflow

**Navigation** - Added to App.jsx
- "Attestation" menu item (admin only)
- "/my-attestations" route (all users)

## User Workflows

### Admin Workflow

1. **Create Campaign**
   - Navigate to Attestation page
   - Click "Create Campaign"
   - Fill in campaign details:
     - Name and description
     - Start/end dates
     - Reminder days (default: 7)
     - Escalation days (default: 10)
   - Choose targeting option:
     - **All Employees**: Send to all registered users (system-wide)
     - **Select Specific Employees**: Choose individual users to receive attestation
     - **By Company**: Send to employees with assets in specific companies
   - If selecting companies, choose one or more companies from the list
   - Save as draft

2. **Start Campaign**
   - Select draft campaign
   - Click "Start"
   - System creates attestation records for targeted users based on campaign type:
     - **All**: All registered users
     - **Selected**: Only the selected users
     - **Companies**: Users who own assets in the selected companies
   - Emails sent to targeted employees

3. **Monitor Progress**
   - View dashboard showing:
     - Total employees
     - Completed count
     - Pending count
     - Reminder/escalation statistics
   - Drill down to see specific employees

4. **Export Results**
   - Click "Export" to download CSV
   - Contains employee names, emails, completion status

### Employee Workflow

1. **Receive Notification**
   - Email received when campaign starts
   - Email includes link to attestation page

2. **Review Assets**
   - Navigate to "My Attestations"
   - Click "Start Attestation"
   - Review each asset in the list
   - Click "Confirm Status" for each asset

3. **Add Missing Assets**
   - Click "Add Missing Asset"
   - Fill in asset details:
     - Asset type, make, model
     - Serial number and asset tag
     - Optional notes
   - Submit to add to list

4. **Complete Attestation**
   - Review all assets are confirmed
   - Click "Complete Attestation"
   - Admin receives notification email

### Automated Processes

**Reminders** (Daily Check)
- For each active campaign:
  - Check if `reminder_days` have passed since start
  - Find pending records without reminder sent
  - Send reminder email to employees
  - Mark reminder as sent

**Escalations** (Daily Check)
- For each active campaign:
  - Check if `escalation_days` have passed since start
  - Find pending records without escalation sent
  - Send escalation email to managers
  - Mark escalation as sent

**Auto-Close** (Daily Check)
- For each active campaign with end_date:
  - Check if end_date has passed
  - Update status to 'completed'

## Configuration

### Environment Variables

Optional configuration for attestation scheduler:
- `RUN_ATTESTATION_SCHEDULER=true` - Enable automated scheduler
- `FRONTEND_URL` - Base URL for email links (default: http://localhost:3000)

### Campaign Settings

When creating a campaign, configure:
- **Reminder Days**: Days after campaign start to send reminder (default: 7)
- **Escalation Days**: Days after campaign start to escalate to manager (default: 10)
- **End Date**: Optional campaign end date for auto-closing

## Email Templates

All emails use the SMTP configuration from Admin Settings and include:
- Custom branding (logo if enabled)
- Responsive HTML design
- Plain text fallback
- Action buttons with URLs

## Security & Compliance

### Authentication & Authorization
- All endpoints require JWT authentication
- Admin endpoints require admin role
- Employees can only access their own attestations

### Audit Trail
- All campaign actions logged
- Asset status changes tracked
- Audit logs include:
  - User email
  - Action type (CREATE, UPDATE, COMPLETE, etc.)
  - Resource type and ID
  - Timestamp and details

### Data Privacy
- Employees only see their own assets
- Managers receive limited info in escalation emails
- Admins have full visibility for compliance

## Testing

**Backend Tests** (`backend/attestation.test.js`)
- Database table creation
- Campaign CRUD operations
- Record management
- Asset attestation tracking
- Full workflow validation

**Manual Testing**
- API endpoint verification
- Email delivery (requires SMTP configuration)
- Frontend component rendering
- End-to-end workflow

## Future Enhancements

### Suggested Improvements
1. Replace native `confirm()` dialogs with shadcn/ui Dialog components
2. Add campaign templates for recurring attestations
3. Support for asset categories/filters in employee view
4. Campaign scheduling (auto-start on specific dates)
5. Notification preferences per user
6. Mobile-responsive email templates
7. Dashboard analytics and trends
8. Bulk asset updates during attestation
9. Integration with asset lifecycle management
10. Custom attestation questions/fields

### Running the Scheduler

To enable automated reminders and escalations:

**Option 1: Environment Variable**
```bash
RUN_ATTESTATION_SCHEDULER=true node server.js
```

**Option 2: Cron Job**
```bash
# Run daily at 2 AM
0 2 * * * cd /path/to/backend && node -e "import('./services/attestationScheduler.js').then(m => m.runScheduledTasks())"
```

**Option 3: Separate Process**
```bash
# In backend directory
node -e "process.env.RUN_ATTESTATION_SCHEDULER='true'; import('./services/attestationScheduler.js')"
```

## Troubleshooting

### Emails Not Sending
- Verify SMTP settings in Admin Settings
- Check SMTP credentials and port
- Enable email notifications in settings
- Check backend logs for errors

### Scheduler Not Running
- Verify `RUN_ATTESTATION_SCHEDULER=true` is set
- Check backend logs for scheduler messages
- Ensure server has been running for 24+ hours
- Verify campaigns have correct dates set

### Attestation Not Showing
- Verify campaign status is 'active'
- Check user has email address
- Verify attestation record was created
- Check browser console for errors

### Database Issues
- Run `npm test` in backend to verify schema
- Check database file permissions
- Verify foreign key relationships
- Check for duplicate records

## Support

For issues or questions:
1. Check backend logs for errors
2. Verify database schema with tests
3. Test API endpoints with curl/Postman
4. Review audit logs for action history
5. Check email service configuration
