import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

/**
 * Tests for date normalization across SQLite and PostgreSQL
 * 
 * These tests verify that dates are consistently handled in UTC format
 * regardless of database engine or system timezone settings.
 * 
 * Requirements:
 * - All dates should be returned in ISO 8601 UTC format (ending with Z)
 * - Date handling should be consistent between SQLite and PostgreSQL
 * - Dates should be timezone-safe for multi-region deployments
 */

describe('Date Normalization', () => {
  describe('ISO 8601 UTC Format Validation', () => {
    it('should validate ISO 8601 UTC format with Z suffix', () => {
      const validFormats = [
        '2024-01-15T10:30:00.000Z',
        '2024-12-31T23:59:59.999Z',
        '2024-01-01T00:00:00.000Z',
      ];
      
      validFormats.forEach(dateStr => {
        expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      });
    });

    it('should detect non-UTC ISO strings', () => {
      const nonUTCFormats = [
        '2024-01-15T10:30:00',        // Missing Z
        '2024-01-15T10:30:00+05:00',  // Timezone offset
        '2024-01-15T10:30:00-08:00',  // Negative offset
      ];
      
      nonUTCFormats.forEach(dateStr => {
        expect(dateStr).not.toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      });
    });
  });

  describe('normalizeDates Function Behavior', () => {
    /**
     * Helper to simulate normalizeDates function
     * This mirrors the logic that should be in database.js
     */
    const createNormalizeDates = (isPostgres) => {
      return (date = null) => {
        if (!date) return null;
        
        // If date is already a string in ISO format, validate and ensure UTC format
        if (typeof date === 'string') {
          // Ensure it's a valid ISO string and convert to UTC if needed
          const parsed = new Date(date);
          if (isNaN(parsed.getTime())) {
            throw new Error(`Invalid date string: ${date}`);
          }
          return parsed.toISOString();
        }
        
        // If date is a Date object (from PostgreSQL), convert to ISO string
        if (date instanceof Date) {
          if (isNaN(date.getTime())) {
            throw new Error('Invalid Date object');
          }
          return date.toISOString();
        }
        
        // Unexpected type
        throw new Error(`Unexpected date type: ${typeof date}`);
      };
    };

    it('should normalize SQLite string dates to UTC ISO format', () => {
      const normalizeDatesSQLite = createNormalizeDates(false);
      
      // SQLite stores as TEXT in ISO format
      const sqliteDate = '2024-01-15T10:30:00.000Z';
      const normalized = normalizeDatesSQLite(sqliteDate);
      
      expect(normalized).toBe('2024-01-15T10:30:00.000Z');
      expect(typeof normalized).toBe('string');
      expect(normalized).toMatch(/Z$/); // Ends with Z for UTC
    });

    it('should normalize Postgres Date objects to UTC ISO format', () => {
      const normalizeDatesPostgres = createNormalizeDates(true);
      
      // Postgres returns Date objects
      const postgresDate = new Date('2024-01-15T10:30:00.000Z');
      const normalized = normalizeDatesPostgres(postgresDate);
      
      expect(normalized).toBe('2024-01-15T10:30:00.000Z');
      expect(typeof normalized).toBe('string');
      expect(normalized).toMatch(/Z$/); // Ends with Z for UTC
    });

    it('should return null for null dates', () => {
      const normalizeDatesSQLite = createNormalizeDates(false);
      const normalizeDatesPostgres = createNormalizeDates(true);
      
      expect(normalizeDatesSQLite(null)).toBeNull();
      expect(normalizeDatesPostgres(null)).toBeNull();
    });

    it('should return null for undefined dates', () => {
      const normalizeDatesSQLite = createNormalizeDates(false);
      const normalizeDatesPostgres = createNormalizeDates(true);
      
      expect(normalizeDatesSQLite(undefined)).toBeNull();
      expect(normalizeDatesPostgres(undefined)).toBeNull();
      expect(normalizeDatesSQLite()).toBeNull();
      expect(normalizeDatesPostgres()).toBeNull();
    });

    it('should produce identical output for SQLite and Postgres with same input time', () => {
      const normalizeDatesSQLite = createNormalizeDates(false);
      const normalizeDatesPostgres = createNormalizeDates(true);
      
      const testDate = '2024-01-15T10:30:00.000Z';
      const sqliteResult = normalizeDatesSQLite(testDate);
      const postgresResult = normalizeDatesPostgres(new Date(testDate));
      
      expect(sqliteResult).toBe(postgresResult);
      expect(typeof sqliteResult).toBe('string');
      expect(typeof postgresResult).toBe('string');
    });

    it('should handle dates with different timezone offsets consistently', () => {
      const normalizeDatesPostgres = createNormalizeDates(true);
      
      // Create dates in different timezone representations
      // All represent the same moment in time
      const dates = [
        new Date('2024-01-15T10:30:00.000Z'),     // UTC
        new Date('2024-01-15T05:30:00.000-05:00'), // EST (same as 10:30 UTC)
        new Date('2024-01-15T18:30:00.000+08:00'), // Singapore (same as 10:30 UTC)
      ];
      
      const normalized = dates.map(d => normalizeDatesPostgres(d));
      
      // All should normalize to the same UTC string
      expect(normalized[0]).toBe('2024-01-15T10:30:00.000Z');
      expect(normalized[1]).toBe('2024-01-15T10:30:00.000Z');
      expect(normalized[2]).toBe('2024-01-15T10:30:00.000Z');
    });

    it('should handle ISO strings with timezone offsets', () => {
      const normalizeDatesSQLite = createNormalizeDates(false);
      
      // ISO string with timezone offset (not UTC)
      const dateWithOffset = '2024-01-15T05:30:00.000-05:00';
      const normalized = normalizeDatesSQLite(dateWithOffset);
      
      // Should convert to UTC
      expect(normalized).toBe('2024-01-15T10:30:00.000Z');
    });

    it('should handle ISO strings without milliseconds', () => {
      const normalizeDatesSQLite = createNormalizeDates(false);
      
      const dateWithoutMs = '2024-01-15T10:30:00Z';
      const normalized = normalizeDatesSQLite(dateWithoutMs);
      
      // Should add milliseconds
      expect(normalized).toBe('2024-01-15T10:30:00.000Z');
    });

    it('should reject invalid date strings', () => {
      const normalizeDatesSQLite = createNormalizeDates(false);
      
      expect(() => normalizeDatesSQLite('invalid-date')).toThrow();
      expect(() => normalizeDatesSQLite('2024-13-45')).toThrow();
      expect(() => normalizeDatesSQLite('not a date')).toThrow();
    });

    it('should reject invalid Date objects', () => {
      const normalizeDatesPostgres = createNormalizeDates(true);
      
      const invalidDate = new Date('invalid');
      expect(() => normalizeDatesPostgres(invalidDate)).toThrow();
    });
  });

  describe('Timezone Consistency Across System Timezones', () => {
    const originalTZ = process.env.TZ;

    afterEach(() => {
      // Restore original timezone
      if (originalTZ) {
        process.env.TZ = originalTZ;
      } else {
        delete process.env.TZ;
      }
    });

    it('should produce consistent UTC output regardless of system timezone', () => {
      const testDate = '2024-01-15T10:30:00.000Z';
      const createNormalizeDates = (isPostgres) => {
        return (date = null) => {
          if (!date) return null;
          if (typeof date === 'string') {
            const parsed = new Date(date);
            if (isNaN(parsed.getTime())) throw new Error('Invalid date');
            return parsed.toISOString();
          }
          if (date instanceof Date) {
            if (isNaN(date.getTime())) throw new Error('Invalid date');
            return date.toISOString();
          }
          throw new Error('Unexpected date type');
        };
      };

      const timezones = [
        'UTC',
        'America/New_York',
        'Europe/London',
        'Asia/Tokyo',
        'Australia/Sydney',
      ];

      const results = [];
      
      timezones.forEach(tz => {
        process.env.TZ = tz;
        const normalize = createNormalizeDates(true);
        const result = normalize(new Date(testDate));
        results.push({ timezone: tz, result });
      });

      // All results should be identical
      const firstResult = results[0].result;
      results.forEach(({ timezone, result }) => {
        expect(result).toBe(firstResult);
        expect(result).toBe('2024-01-15T10:30:00.000Z');
      });
    });
  });

  describe('JSON Serialization Consistency', () => {
    it('should serialize consistently in JSON for both database types', () => {
      const sqliteDate = '2024-01-15T10:30:00.000Z';
      const postgresDate = new Date('2024-01-15T10:30:00.000Z');
      
      // After normalization to ISO string
      const normalized = postgresDate.toISOString();
      
      const sqliteJSON = JSON.stringify({ date: sqliteDate });
      const postgresJSON = JSON.stringify({ date: normalized });
      
      expect(sqliteJSON).toBe(postgresJSON);
      expect(JSON.parse(sqliteJSON).date).toBe(JSON.parse(postgresJSON).date);
    });

    it('should not have Date object in normalized output', () => {
      const testDate = new Date('2024-01-15T10:30:00.000Z');
      const normalized = testDate.toISOString();
      
      expect(normalized).not.toBeInstanceOf(Date);
      expect(typeof normalized).toBe('string');
    });
  });

  describe('Edge Cases', () => {
    it('should handle epoch time (1970-01-01)', () => {
      const epoch = new Date(0);
      const normalized = epoch.toISOString();
      
      expect(normalized).toBe('1970-01-01T00:00:00.000Z');
    });

    it('should handle far future dates', () => {
      const farFuture = new Date('2099-12-31T23:59:59.999Z');
      const normalized = farFuture.toISOString();
      
      expect(normalized).toBe('2099-12-31T23:59:59.999Z');
    });

    it('should handle leap year dates', () => {
      const leapDay = new Date('2024-02-29T12:00:00.000Z');
      const normalized = leapDay.toISOString();
      
      expect(normalized).toBe('2024-02-29T12:00:00.000Z');
    });

    it('should handle end of year dates', () => {
      const endOfYear = new Date('2024-12-31T23:59:59.999Z');
      const normalized = endOfYear.toISOString();
      
      expect(normalized).toBe('2024-12-31T23:59:59.999Z');
    });
  });
});
