#!/bin/bash
# Verification script for critical backend files
# This script ensures that key files are complete and tracked by git

set -e

echo "=== Critical Files Verification ==="
echo ""

ERRORS=0

# Function to verify a file
verify_file() {
    local file=$1
    local min_lines=$2
    local description=$3
    
    echo "Checking: $description ($file)"
    
    # Check if file exists
    if [ ! -f "$file" ]; then
        echo "  ❌ ERROR: File does not exist!"
        ERRORS=$((ERRORS + 1))
        return
    fi
    
    # Check if tracked by git
    if ! git ls-files --error-unmatch "$file" >/dev/null 2>&1; then
        echo "  ❌ ERROR: File is not tracked by git!"
        ERRORS=$((ERRORS + 1))
        return
    fi
    
    # Check line count
    local lines=$(wc -l < "$file")
    if [ "$lines" -lt "$min_lines" ]; then
        echo "  ❌ ERROR: File has only $lines lines (expected at least $min_lines)!"
        ERRORS=$((ERRORS + 1))
        return
    fi
    
    # Check if file is ASCII text (not binary or corrupted)
    if ! file "$file" | grep -q "text"; then
        echo "  ⚠️  WARNING: File may not be a text file!"
    fi
    
    echo "  ✅ OK ($lines lines)"
}

# Verify critical backend files
# Note: Line count thresholds are set at ~80% of current size to catch major issues
# (like file truncation) while allowing for normal code evolution and refactoring.
# After Phase 2 refactoring, server.js was split into route modules (364 lines entry point).

# Core entry points
verify_file "backend/server.js" 300 "Backend Server (entry point)"
verify_file "backend/database.js" 1200 "Database Module"
verify_file "backend/package.json" 30 "Backend Package Config"

# Authentication modules
verify_file "backend/auth.js" 50 "Authentication Module"
verify_file "backend/oidc.js" 50 "OIDC Module"
verify_file "backend/mfa.js" 50 "MFA Module"

# Route modules (extracted from server.js in Phase 2)
verify_file "backend/routes/index.js" 200 "Route Module Index"
verify_file "backend/routes/auth.js" 500 "Auth Routes"
verify_file "backend/routes/assets.js" 400 "Assets Routes"
verify_file "backend/routes/admin.js" 900 "Admin Routes"

# Middleware (created in Phase 2)
verify_file "backend/middleware/validation.js" 150 "Validation Middleware"

# Utils (created in Phase 2)
verify_file "backend/utils/logger.js" 100 "Logger Utility"

# Verify critical frontend files
verify_file "frontend/package.json" 30 "Frontend Package Config"
verify_file "frontend/src/App.jsx" 50 "Frontend Main App"

echo ""
if [ $ERRORS -eq 0 ]; then
    echo "=== ✅ All critical files verified successfully ==="
    exit 0
else
    echo "=== ❌ $ERRORS error(s) found ==="
    exit 1
fi
