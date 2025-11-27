# Client Asset Registration System

A comprehensive web application for tracking and managing client laptops assigned to consultants, designed for SOC2 compliance and audit requirements.

## Features

- **Self-Service Registration**: Consultants can register client laptops with all required information
- **Asset Tracking**: Complete database of all client assets with detailed information
- **Status Management**: Update asset status (Active, Returned, Lost, Damaged, Retired)
- **Advanced Search**: Search and filter assets by employee, manager, client, or status
- **Audit Trail**: Track registration dates and last update timestamps
- **Real-time Updates**: Instant synchronization between registration and inventory views

## Technology Stack

### Backend
- **Node.js** with Express.js
- **SQLite** database (better-sqlite3)
- RESTful API architecture
- CORS enabled for development

### Frontend
- **React 18** with Vite
- Modern, responsive UI design
- Client-side filtering and search
- Real-time form validation

## Required Information

When registering a client asset, consultants must provide:
- Employee Name
- Manager Name
- Client Name
- Laptop Serial Number (must be unique)
- Laptop Asset Tag (must be unique)
- Notes (optional)

## Installation

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd claude_app_poc
   ```

2. **Install Backend Dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install Frontend Dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

## Running the Application

You need to run both the backend and frontend servers.

### Start Backend Server

```bash
cd backend
npm start
```

The backend API will run on `http://localhost:3001`

For development with auto-reload:
```bash
npm run dev
```

### Start Frontend Development Server

In a new terminal:

```bash
cd frontend
npm run dev
```

The frontend will run on `http://localhost:3000`

## Using the Application

1. **Access the Application**: Open your browser and navigate to `http://localhost:3000`

2. **Register a New Asset**:
   - Fill out the registration form on the left side
   - All fields marked with * are required
   - Serial numbers and asset tags must be unique
   - Click "Register Asset" to submit

3. **View Asset Inventory**:
   - The right side displays all registered assets
   - Assets are sorted by registration date (newest first)

4. **Search Assets**:
   - Use the search filters at the top of the inventory
   - Search by employee name, manager name, client name, or status
   - Filters work in real-time as you type
   - Click "Clear Filters" to reset

5. **Update Asset Status**:
   - Click "Update Status" button for any asset
   - Select new status from dropdown
   - Add optional notes about the status change
   - Click "Update Status" to save

## API Endpoints

### Assets

- `GET /api/health` - Health check
- `GET /api/assets` - Get all assets
- `GET /api/assets/:id` - Get single asset
- `GET /api/assets/search?employee=...&manager=...&client=...&status=...` - Search assets
- `POST /api/assets` - Create new asset
- `PATCH /api/assets/:id/status` - Update asset status
- `PUT /api/assets/:id` - Update entire asset
- `DELETE /api/assets/:id` - Delete asset

### Status Values
- `active` - Asset is currently in use
- `returned` - Asset has been returned to client
- `lost` - Asset is lost or missing
- `damaged` - Asset is damaged
- `retired` - Asset has been retired from service

## Database Schema

The SQLite database contains a single `assets` table:

```sql
CREATE TABLE assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_name TEXT NOT NULL,
  manager_name TEXT NOT NULL,
  client_name TEXT NOT NULL,
  laptop_serial_number TEXT NOT NULL UNIQUE,
  laptop_asset_tag TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  registration_date TEXT NOT NULL,
  last_updated TEXT NOT NULL,
  notes TEXT
)
```

Indexes are created on:
- `employee_name`
- `manager_name`
- `client_name`
- `status`

## SOC2 Compliance Features

This system helps meet SOC2 compliance requirements by:

1. **Asset Inventory**: Maintaining a complete, searchable database of all client assets
2. **Accountability**: Tracking which employee has which asset and their manager
3. **Audit Trail**: Recording registration dates and last update timestamps
4. **Status Tracking**: Monitoring asset lifecycle from active use to return/retirement
5. **Data Integrity**: Enforcing unique serial numbers and asset tags
6. **Search & Reporting**: Enabling auditors to quickly find assets by multiple criteria

## Production Deployment

For production deployment:

1. **Backend**:
   - Set environment variables for production
   - Use a process manager (PM2, systemd)
   - Consider migrating to PostgreSQL or MySQL for larger datasets
   - Implement proper authentication and authorization
   - Enable HTTPS

2. **Frontend**:
   - Build the production bundle: `npm run build`
   - Serve static files through a web server (nginx, Apache)
   - Update API endpoint to point to production backend
   - Enable HTTPS

3. **Database**:
   - Backup the SQLite database regularly
   - Consider database encryption for sensitive data
   - Implement database migration strategy

## Future Enhancements

Potential improvements for the system:

- User authentication and role-based access control
- Email notifications for status changes
- Export functionality (CSV, Excel, PDF)
- Asset assignment history
- Dashboard with analytics and charts
- Bulk import/export capabilities
- Integration with HR systems
- Document attachments (purchase orders, agreements)
- Automated reminders for asset returns

## Security Considerations

- Currently, this is a basic implementation without authentication
- For production use, implement:
  - User authentication (JWT, OAuth, etc.)
  - Role-based access control (admin, manager, employee)
  - Input validation and sanitization
  - Rate limiting
  - HTTPS/TLS encryption
  - Database encryption for sensitive data
  - Audit logging

## Troubleshooting

### Backend won't start
- Ensure Node.js v18+ is installed
- Check if port 3001 is available
- Verify all dependencies are installed: `npm install`

### Frontend won't start
- Ensure Node.js v18+ is installed
- Check if port 3000 is available
- Verify all dependencies are installed: `npm install`
- Make sure backend is running first

### Can't register asset with duplicate serial number
- Serial numbers and asset tags must be unique
- Check if the asset is already registered
- Update the existing asset instead of creating a new one

### Search not working
- Ensure backend is running
- Check browser console for errors
- Try clearing filters and searching again

## License

MIT

## Support

For issues, questions, or contributions, please contact your system administrator or IT department.
