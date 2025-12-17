# Database Schema Migration Guide

## Overview

This document outlines database schema changes and migration considerations for the ACS application. The most recent update adds support for multiple asset types beyond just laptops.

## Latest Changes: Multi-Type Asset Support (December 2024)

### Breaking Change: Generic Asset Fields

The ACS application has been updated to support multiple asset types (laptops and mobile phones) by replacing laptop-specific fields with generic asset fields.

**⚠️ IMPORTANT: This is a breaking change. You must delete your existing database and start fresh.**

### Assets Table Schema Changes

**Old Schema (Laptop-Only):**
- `laptop_make` (TEXT) - Laptop manufacturer
- `laptop_model` (TEXT) - Laptop model
- `laptop_serial_number` (TEXT NOT NULL UNIQUE) - Laptop serial number
- `laptop_asset_tag` (TEXT NOT NULL UNIQUE) - Laptop asset tag

**New Schema (Multi-Type):**
- `asset_type` (TEXT NOT NULL) - Type of asset: 'laptop' or 'mobile_phone'
- `make` (TEXT) - Generic manufacturer/make
- `model` (TEXT) - Generic model
- `serial_number` (TEXT NOT NULL UNIQUE) - Generic serial number
- `asset_tag` (TEXT NOT NULL UNIQUE) - Generic asset tag

### Index Changes

**Renamed Indexes:**
- `idx_laptop_serial_number` → `idx_serial_number`
- `idx_laptop_asset_tag` → `idx_asset_tag`

### API Changes

All asset-related API endpoints now require the `asset_type` field and use generic field names:

**POST /api/assets**
- Required: `asset_type` ('laptop' or 'mobile_phone'), `serial_number`, `asset_tag`
- Optional: `make`, `model`

**PUT /api/assets/:id**
- Same field requirements as POST

**POST /api/assets/import**
- CSV must include: `asset_type`, `serial_number`, `asset_tag`
- CSV may include: `make`, `model`

### CSV Template Changes

The CSV import template has been updated:

**Old Header:**
```csv
employee_first_name,employee_last_name,employee_email,...,laptop_make,laptop_model,laptop_serial_number,laptop_asset_tag,...
```

**New Header:**
```csv
employee_first_name,employee_last_name,employee_email,...,asset_type,make,model,serial_number,asset_tag,...
```

### UI Changes

1. **Asset Registration Form**: Now includes an asset type dropdown with options: Laptop, Mobile Phone
2. **Asset Table**: Added "Type" column, renamed "Laptop" column to "Make/Model"
3. **Asset Edit Modal**: Displays asset type and generic make/model information
4. **Bulk Import**: Updated required fields documentation

### Benefits of Multi-Type Support

1. **Flexibility**: Track different types of assets (laptops, mobile phones, and potentially others in the future)
2. **Consistency**: Generic field names work for all asset types
3. **Scalability**: Easy to add new asset types in the future
4. **Better Organization**: Filter and sort by asset type

### Migration Instructions

Since this is a breaking change:

1. **Stop the ACS application**
2. **Delete the existing database file** (typically `backend/data/*.db` for SQLite)
3. **Update to the latest code**
4. **Restart the application** - new schema will be created automatically
5. **Re-import your data** using the new CSV format with `asset_type` field

---

## Previous Changes: Separated Name Fields (Earlier 2024)

The ACS application was previously updated to use separated first and last name fields for better data quality and improved user experience.

## What Changed

### Assets Table Schema

**Old Schema:**
- `employee_name` (TEXT) - Combined first and last name
- `manager_name` (TEXT) - Combined first and last name

**New Schema:**
- `employee_first_name` (TEXT NOT NULL) - Employee's first name
- `employee_last_name` (TEXT NOT NULL) - Employee's last name
- `manager_first_name` (TEXT) - Manager's first name (optional)
- `manager_last_name` (TEXT) - Manager's last name (optional)

### API Changes

All asset-related API endpoints now use the new separated field names:

**POST /api/assets**
- Required: `employee_first_name`, `employee_last_name`
- Optional: `manager_first_name`, `manager_last_name`

**PUT /api/assets/:id**
- Same field requirements as POST

**POST /api/assets/import**
- CSV must include: `employee_first_name`, `employee_last_name`
- CSV may include: `manager_first_name`, `manager_last_name`

## Migration for New Deployments

If you're deploying ACS for the first time, no migration is needed. The new schema will be created automatically.

## Benefits of the New Schema

1. **Better Data Quality**: Separated fields prevent inconsistent name formatting
2. **Improved Sorting**: Can sort by last name independently
3. **Better Reporting**: Easier to generate formal reports with proper name formatting
4. **User Experience**: More intuitive forms with clear first/last name fields
5. **Role-Based Access**: Enhanced prepopulation for employees registering assets

## UI Changes

### Asset Registration Form

**Employee Registration (Employees):**
- First name and last name fields are prepopulated from user profile
- Employee fields are readonly - employees can only register assets for themselves
- Manager fields are prepopulated from employee's manager information and readonly

**Asset Registration (Admins & Managers):**
- All fields editable
- Can register assets for any employee
- Separated first/last name fields for both employee and manager

### Asset Edit Modal

- Manager name now split into first and last name fields
- Both fields editable by admins and managers
- Character counters for each field

### Asset Table Display

- Employee names displayed as "First Last" in the table
- Search functionality works across both first and last names

### Bulk Import

**New CSV Template Format:**
```csv
employee_first_name,employee_last_name,employee_email,manager_first_name,manager_last_name,manager_email,company_name,laptop_make,laptop_model,laptop_serial_number,laptop_asset_tag,status,notes
```

**Download Updated Template:**
Use the "Download Example CSV" button in the Bulk Import modal to get the correct template.

## For Developers

### Frontend Components Updated

- `AssetRegisterModal.jsx` - Separated name fields with role-based prepopulation
- `AssetEditModal.jsx` - Manager name split into first/last fields
- `AssetBulkImportModal.jsx` - Updated field requirements display
- `AssetTable.jsx` - Display logic for combined names from first/last

### Backend Changes

- `database.js` - Updated schema and indexes
- `server.js` - Updated validation and API endpoints
- Test files updated to use new schema

### Database Indexes

New indexes created for improved query performance:
- `idx_employee_first_name`
- `idx_employee_last_name`
- `idx_manager_first_name`
- `idx_manager_last_name`

## Support

For questions or issues related to this migration, please:
1. Check the [API Reference](wiki/API-Reference.md)
2. Review the [Features Guide](wiki/Features.md)
3. Open an issue on GitHub

## Version Information

- **Schema Version**: 2.0
- **Introduced In**: December 2025
- **Breaking Change**: Yes - API field names changed
