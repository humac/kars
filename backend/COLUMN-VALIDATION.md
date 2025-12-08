# SQL Column Name Validation

## Overview

This document explains the SQL column name validation implemented in `database.js` to strengthen security around dynamic column selection during database migrations.

## Background

The KARS application performs database migrations that dynamically select columns based on schema introspection (using PRAGMA table_info for SQLite or information_schema for PostgreSQL). While these sources are trusted, we implement defense-in-depth validation to:

1. Catch potential bugs in schema parsing
2. Prevent future vulnerabilities if code is modified to accept untrusted sources
3. Document expected column name format explicitly
4. Protect against database corruption or manipulation

## Implementation

### Validation Functions

#### `isValidColumnName(columnName)`

Validates that a column name is safe to use in dynamic SQL.

**Validation Rules:**
- Must be a string
- Length: 1-64 characters
- Pattern: `^[a-zA-Z_][a-zA-Z0-9_-]*$`
  - Must start with letter or underscore
  - Can contain: alphanumeric, underscore, hyphen

**Returns:** `true` if valid, `false` otherwise

**Throws:** `TypeError` if input is not a string

**Example:**
```javascript
isValidColumnName('employee_name')  // true
isValidColumnName('company-name')   // true
isValidColumnName('id; DROP TABLE') // false
isValidColumnName("id' OR '1'='1") // false
```

#### `buildSafeColumnExpression(columnName, alias)`

Safely constructs a SQL SELECT expression with validation.

**Parameters:**
- `columnName`: Column name from PRAGMA table_info (required)
- `alias`: Optional alias for the column in SELECT

**Returns:** Safe SQL SELECT expression string

**Throws:** `Error` if column name or alias is invalid

**Example:**
```javascript
buildSafeColumnExpression('id')                              // "id"
buildSafeColumnExpression('client_name', 'company_name')    // "client_name AS company_name"
buildSafeColumnExpression('laptop_make')                     // "laptop_make"
buildSafeColumnExpression('DROP TABLE')                      // throws Error
```

### Usage in Migrations

The validation is applied in two critical migration functions:

#### 1. Migration for Nullable Manager Fields (line ~660)

This migration handles schema evolution from old schemas with `client_name` to new schemas with `company_name`:

```javascript
// Get columns from PRAGMA
const existingCols = await dbAll("PRAGMA table_info(assets)");

// Validate all column names from PRAGMA
existingCols.forEach(col => {
  if (!isValidColumnName(col.name)) {
    throw new Error(`Database schema contains invalid column name: "${col.name}"`);
  }
});

// Build safe expressions based on which columns exist
const hasCompanyName = existingCols.some(col => col.name === 'company_name');
const hasClientName = existingCols.some(col => col.name === 'client_name');

let companyExpr;
if (hasCompanyName) {
  companyExpr = buildSafeColumnExpression('company_name', 'company_name');
} else if (hasClientName) {
  companyExpr = buildSafeColumnExpression('client_name', 'company_name');
} else {
  companyExpr = "'' AS company_name";
}
```

#### 2. Migration for Column Rename (line ~790)

This migration handles renaming `client_name` to `company_name` with optional columns:

```javascript
const srcCols = await dbAll("PRAGMA table_info(assets)");

// Validate all column names
srcCols.forEach(col => {
  if (!isValidColumnName(col.name)) {
    throw new Error(`Database schema contains invalid column name: "${col.name}"`);
  }
});

// Build safe expressions for optional columns
const srcHasLaptopMake = srcCols.some(col => col.name === 'laptop_make');
const laptopMakeSrc = srcHasLaptopMake ? buildSafeColumnExpression('laptop_make') : "''";
```

## Security Guarantees

### What This Protects Against

1. **SQL Injection through Column Names**
   - Blocks: `id; DROP TABLE users--`
   - Blocks: `id' OR '1'='1`
   - Blocks: `name UNION SELECT password`

2. **Malformed Column Names**
   - Blocks: Column names with spaces
   - Blocks: Column names with special characters
   - Blocks: Column names that are too long

3. **Future Vulnerabilities**
   - If code is modified to accept user input as column names
   - If external data sources are used for column selection
   - If schema parsing has bugs

### What This Doesn't Protect Against

- This validation only applies to column names, not to other SQL components
- User input should still never be used directly in SQL queries
- Parameterized queries should be used for all user-provided values

## Testing

Comprehensive test suite in `database-column-validation.test.js`:

- **36 tests** covering:
  - Valid column name patterns
  - SQL injection attempts (8+ attack patterns)
  - Edge cases (length, type safety, unicode)
  - Schema evolution scenarios
  - Documentation and requirements

Run tests:
```bash
npm test database-column-validation.test.js
```

## Usage Requirements

### ✅ DO

- Use with column names from PRAGMA table_info
- Use with column names from information_schema (PostgreSQL)
- Apply validation to all dynamically selected columns
- Document why a column name is trusted

### ❌ DON'T

- Never use with user-provided input
- Never use with HTTP request parameters
- Never use with form data
- Never use with external API responses
- Never use with untrusted configuration files

## Best Practices

1. **Prefer Static Column References**
   - Use dynamic selection only when necessary for migrations
   - Static SQL is always safer and more performant

2. **Validate Before Use**
   - Always validate column names from PRAGMA before use
   - Check the validation result and handle errors

3. **Document Sources**
   - Add comments explaining where column names come from
   - Make it clear that PRAGMA table_info is the trusted source

4. **Test Schema Evolution**
   - Add tests for each schema migration scenario
   - Verify both old and new schema formats work

## Maintenance

### When Adding New Migrations

1. Use PRAGMA table_info or information_schema to get column names
2. Validate all column names before use:
   ```javascript
   cols.forEach(col => {
     if (!isValidColumnName(col.name)) {
       throw new Error(`Invalid column name: "${col.name}"`);
     }
   });
   ```
3. Use `buildSafeColumnExpression()` for dynamic SQL construction
4. Add tests for the new migration scenario

### When Modifying Validation Rules

1. Update `isValidColumnName()` function
2. Update tests in `database-column-validation.test.js`
3. Verify all existing migrations still work
4. Update this documentation

## References

- Issue: "Optional: Strengthen SQL dynamic column selection for safety"
- Implementation: `database.js` lines 93-164
- Tests: `database-column-validation.test.js`
- Code Review: Addressed unused parameter feedback
- Security Scan: CodeQL - 0 alerts

## Questions?

If you're unsure whether a column source is trusted, ask:
- Does this come directly from PRAGMA table_info?
- Does this come from information_schema?
- Could this ever be influenced by user input?

If the answer to the last question is "yes", do NOT use it with these functions.
