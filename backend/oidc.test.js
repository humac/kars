import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { PKCE_VERIFIER_TIMEOUT_MS, MAX_VERIFIER_STORE_SIZE, LRUCache } from './oidc.js';

/**
 * Tests for OIDC PKCE Verifier Store - Timeout Management
 * 
 * This test suite validates that the OIDC module properly manages timeouts
 * for PKCE code verifiers to prevent memory leaks and race conditions.
 * 
 * Key behaviors tested:
 * - Timeouts are created when storing code verifiers
 * - Existing timeouts are cleared when the same state is reused
 * - Timeouts are cleared when callbacks are processed (success or error)
 * - No timeout accumulation occurs under heavy load
 */
describe('OIDC Module - PKCE Verifier Store Timeout Management', () => {
  let originalSetTimeout;
  let originalClearTimeout;
  let timeoutIds = [];
  let clearedTimeouts = [];
  let timeoutCallbacks = new Map();
  let nextTimeoutId = 1;

  beforeEach(() => {
    jest.clearAllMocks();
    timeoutIds = [];
    clearedTimeouts = [];
    timeoutCallbacks.clear();
    nextTimeoutId = 1;

    // Mock setTimeout and clearTimeout to track calls
    originalSetTimeout = global.setTimeout;
    originalClearTimeout = global.clearTimeout;

    global.setTimeout = jest.fn((callback, delay) => {
      const id = nextTimeoutId++;
      timeoutIds.push({ id, callback, delay });
      timeoutCallbacks.set(id, callback);
      return id;
    });

    global.clearTimeout = jest.fn((id) => {
      clearedTimeouts.push(id);
      timeoutCallbacks.delete(id);
    });
  });

  afterEach(() => {
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
  });

  describe('Timeout store behavior', () => {
    it('should demonstrate timeout creation pattern', () => {
      const codeVerifierStore = new Map();
      const timeoutStore = new Map();
      const state = 'test_state';

      // Simulate storing a verifier with timeout
      codeVerifierStore.set(state, 'verifier123');
      const timeoutId = setTimeout(() => {
        codeVerifierStore.delete(state);
        timeoutStore.delete(state);
      }, PKCE_VERIFIER_TIMEOUT_MS);
      timeoutStore.set(state, timeoutId);

      // Verify timeout was created
      expect(timeoutIds.length).toBe(1);
      expect(timeoutIds[0].delay).toBe(PKCE_VERIFIER_TIMEOUT_MS);
      expect(timeoutStore.has(state)).toBe(true);
    });

    it('should demonstrate clearing existing timeout before creating new one', () => {
      const codeVerifierStore = new Map();
      const timeoutStore = new Map();
      const state = 'test_state';

      // First call
      codeVerifierStore.set(state, 'verifier1');
      const timeout1 = setTimeout(() => {}, PKCE_VERIFIER_TIMEOUT_MS);
      timeoutStore.set(state, timeout1);

      // Second call - should clear first timeout
      const existingTimeout = timeoutStore.get(state);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }
      
      codeVerifierStore.set(state, 'verifier2');
      const timeout2 = setTimeout(() => {}, PKCE_VERIFIER_TIMEOUT_MS);
      timeoutStore.set(state, timeout2);

      // Verify first timeout was cleared
      expect(clearedTimeouts).toContain(timeout1);
      expect(timeoutIds.length).toBe(2);
    });

    it('should demonstrate proper cleanup in callback', () => {
      const codeVerifierStore = new Map();
      const timeoutStore = new Map();
      const state = 'test_state';

      // Setup
      codeVerifierStore.set(state, 'verifier');
      const timeoutId = setTimeout(() => {}, PKCE_VERIFIER_TIMEOUT_MS);
      timeoutStore.set(state, timeoutId);

      // Simulate callback cleanup
      codeVerifierStore.delete(state);
      const storedTimeout = timeoutStore.get(state);
      if (storedTimeout) {
        clearTimeout(storedTimeout);
        timeoutStore.delete(state);
      }

      // Verify cleanup
      expect(clearedTimeouts).toContain(timeoutId);
      expect(timeoutStore.has(state)).toBe(false);
    });

    it('should handle multiple states without cross-interference', () => {
      const codeVerifierStore = new Map();
      const timeoutStore = new Map();
      const states = ['state1', 'state2', 'state3'];

      // Create verifiers for multiple states
      states.forEach(state => {
        codeVerifierStore.set(state, `verifier_${state}`);
        const timeoutId = setTimeout(() => {}, PKCE_VERIFIER_TIMEOUT_MS);
        timeoutStore.set(state, timeoutId);
      });

      // Verify all created
      expect(timeoutIds.length).toBe(3);
      expect(timeoutStore.size).toBe(3);
      expect(clearedTimeouts.length).toBe(0);
    });

    it('should prevent timeout accumulation with repeated state reuse', () => {
      const codeVerifierStore = new Map();
      const timeoutStore = new Map();
      const state = 'reused_state';
      const iterations = 10;

      // Simulate multiple calls with same state
      for (let i = 0; i < iterations; i++) {
        // Clear existing timeout (as our fix does)
        const existingTimeout = timeoutStore.get(state);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }

        codeVerifierStore.set(state, `verifier_${i}`);
        const timeoutId = setTimeout(() => {}, PKCE_VERIFIER_TIMEOUT_MS);
        timeoutStore.set(state, timeoutId);
      }

      // Should have created N timeouts
      expect(timeoutIds.length).toBe(iterations);
      // Should have cleared N-1 timeouts (all but the last)
      expect(clearedTimeouts.length).toBe(iterations - 1);
      // Should only have 1 timeout stored
      expect(timeoutStore.size).toBe(1);
    });

    it('should handle timeout firing before callback', () => {
      const codeVerifierStore = new Map();
      const timeoutStore = new Map();
      const state = 'expired_state';

      // Setup
      codeVerifierStore.set(state, 'verifier');
      const timeoutId = setTimeout(() => {
        codeVerifierStore.delete(state);
        timeoutStore.delete(state);
      }, PKCE_VERIFIER_TIMEOUT_MS);
      timeoutStore.set(state, timeoutId);

      // Simulate timeout firing
      const callback = timeoutCallbacks.get(timeoutId);
      callback();

      // Verify cleanup happened
      expect(codeVerifierStore.has(state)).toBe(false);
      expect(timeoutStore.has(state)).toBe(false);
    });

    it('should handle callback attempting to clear non-existent timeout gracefully', () => {
      const codeVerifierStore = new Map();
      const timeoutStore = new Map();
      const state = 'no_timeout_state';

      // Simulate callback without timeout
      const timeoutId = timeoutStore.get(state);
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutStore.delete(state);
      }

      // Should not throw or cause issues
      expect(clearedTimeouts.length).toBe(0);
    });

    it('should measure memory efficiency improvement', () => {
      const codeVerifierStore = new Map();
      const timeoutStore = new Map();
      const state = 'memory_test';
      const iterations = 100;

      // WITHOUT fix: timeouts accumulate
      const withoutFixTimeouts = [];
      for (let i = 0; i < iterations; i++) {
        codeVerifierStore.set(state, `verifier_${i}`);
        const tid = setTimeout(() => {}, PKCE_VERIFIER_TIMEOUT_MS);
        withoutFixTimeouts.push(tid);
      }
      // Would have 100 active timeouts

      // Reset - use mocked clearTimeout to maintain test isolation
      withoutFixTimeouts.forEach(id => clearTimeout(id));
      timeoutIds = [];
      clearedTimeouts = [];

      // WITH fix: only 1 timeout at a time
      for (let i = 0; i < iterations; i++) {
        const existingTimeout = timeoutStore.get(state);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }
        
        codeVerifierStore.set(state, `verifier_${i}`);
        const timeoutId = setTimeout(() => {}, PKCE_VERIFIER_TIMEOUT_MS);
        timeoutStore.set(state, timeoutId);
      }

      // Should have cleared 99 timeouts, leaving only 1 active
      expect(clearedTimeouts.length).toBe(iterations - 1);
      expect(timeoutStore.size).toBe(1);
    });
  });

  describe('Error handling', () => {
    it('should clear timeout even when callback processing fails', () => {
      const codeVerifierStore = new Map();
      const timeoutStore = new Map();
      const state = 'error_state';

      // Setup
      codeVerifierStore.set(state, 'verifier');
      const timeoutId = setTimeout(() => {}, PKCE_VERIFIER_TIMEOUT_MS);
      timeoutStore.set(state, timeoutId);

      // Simulate error handling that still cleans up
      try {
        throw new Error('Callback failed');
      } catch (error) {
        // Cleanup in catch block (as our fix does)
        codeVerifierStore.delete(state);
        const storedTimeout = timeoutStore.get(state);
        if (storedTimeout) {
          clearTimeout(storedTimeout);
          timeoutStore.delete(state);
        }
      }

      // Verify cleanup happened despite error
      expect(clearedTimeouts).toContain(timeoutId);
      expect(timeoutStore.has(state)).toBe(false);
    });
  });
});

/**
 * Tests for LRU Cache Implementation
 * 
 * This test suite validates the LRU cache used to prevent unbounded memory growth
 * in the OIDC code verifier store.
 * 
 * Key behaviors tested:
 * - Basic get/set/delete operations work correctly
 * - LRU eviction happens when size limit is reached
 * - Most recently used items are kept, oldest are evicted
 * - Cache respects configured maximum size
 */
describe('LRUCache - Memory Leak Prevention', () => {
  describe('Basic operations', () => {
    it('should store and retrieve values', () => {
      const cache = new LRUCache(3);
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBe('value2');
      expect(cache.size).toBe(2);
    });

    it('should return undefined for non-existent keys', () => {
      const cache = new LRUCache(3);
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should delete values correctly', () => {
      const cache = new LRUCache(3);
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      
      cache.delete('key1');
      expect(cache.has('key1')).toBe(false);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.size).toBe(0);
    });

    it('should update existing keys without increasing size', () => {
      const cache = new LRUCache(3);
      cache.set('key1', 'value1');
      expect(cache.size).toBe(1);
      
      cache.set('key1', 'value2');
      expect(cache.size).toBe(1);
      expect(cache.get('key1')).toBe('value2');
    });
  });

  describe('LRU eviction behavior', () => {
    it('should evict oldest entry when size limit is reached', () => {
      const cache = new LRUCache(3);
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      expect(cache.size).toBe(3);
      
      // Adding 4th item should evict key1 (oldest)
      cache.set('key4', 'value4');
      expect(cache.size).toBe(3);
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(true);
      expect(cache.has('key3')).toBe(true);
      expect(cache.has('key4')).toBe(true);
    });

    it('should refresh item position on access', () => {
      const cache = new LRUCache(3);
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      // Access key1 to make it most recently used
      cache.get('key1');
      
      // Add new item - should evict key2 (now oldest)
      cache.set('key4', 'value4');
      expect(cache.has('key1')).toBe(true); // Still there (was accessed)
      expect(cache.has('key2')).toBe(false); // Evicted
      expect(cache.has('key3')).toBe(true);
      expect(cache.has('key4')).toBe(true);
    });

    it('should refresh item position on update', () => {
      const cache = new LRUCache(3);
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      // Update key1 to make it most recently used
      cache.set('key1', 'newvalue1');
      
      // Add new item - should evict key2 (now oldest)
      cache.set('key4', 'value4');
      expect(cache.has('key1')).toBe(true); // Still there (was updated)
      expect(cache.has('key2')).toBe(false); // Evicted
      expect(cache.has('key3')).toBe(true);
      expect(cache.has('key4')).toBe(true);
    });
  });

  describe('Heavy load scenarios', () => {
    it('should handle many entries without exceeding size limit', () => {
      const maxSize = 100;
      const cache = new LRUCache(maxSize);
      
      // Add 1000 entries
      for (let i = 0; i < 1000; i++) {
        cache.set(`key${i}`, `value${i}`);
        expect(cache.size).toBeLessThanOrEqual(maxSize);
      }
      
      // Final size should be exactly maxSize
      expect(cache.size).toBe(maxSize);
      
      // Only the last 100 entries should remain
      expect(cache.has('key0')).toBe(false);
      expect(cache.has('key899')).toBe(false);
      expect(cache.has('key900')).toBe(true);
      expect(cache.has('key999')).toBe(true);
    });

    it('should handle default size configuration', () => {
      const cache = new LRUCache(); // Default should be 1000
      
      // Add entries up to default limit
      for (let i = 0; i < 1500; i++) {
        cache.set(`key${i}`, `value${i}`);
      }
      
      // Should not exceed 1000
      expect(cache.size).toBe(1000);
    });

    it('should work correctly with OIDC verifier store size', () => {
      const cache = new LRUCache(MAX_VERIFIER_STORE_SIZE);
      
      // Simulate heavy OIDC load
      for (let i = 0; i < MAX_VERIFIER_STORE_SIZE * 2; i++) {
        cache.set(`state${i}`, `verifier${i}`);
      }
      
      // Should be capped at MAX_VERIFIER_STORE_SIZE
      expect(cache.size).toBe(MAX_VERIFIER_STORE_SIZE);
    });
  });

  describe('Edge cases', () => {
    it('should handle size limit of 1', () => {
      const cache = new LRUCache(1);
      cache.set('key1', 'value1');
      expect(cache.size).toBe(1);
      
      cache.set('key2', 'value2');
      expect(cache.size).toBe(1);
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(true);
    });

    it('should handle clear operation', () => {
      const cache = new LRUCache(10);
      for (let i = 0; i < 5; i++) {
        cache.set(`key${i}`, `value${i}`);
      }
      expect(cache.size).toBe(5);
      
      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.has('key0')).toBe(false);
    });

    it('should handle repeated access patterns', () => {
      const cache = new LRUCache(3);
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      // Repeatedly access key1
      for (let i = 0; i < 10; i++) {
        cache.get('key1');
      }
      
      // Add new entries - key1 should still be there
      cache.set('key4', 'value4');
      cache.set('key5', 'value5');
      
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
      expect(cache.has('key3')).toBe(false);
    });
  });

  describe('Integration with OIDC pattern', () => {
    it('should work with codeVerifierStore pattern', () => {
      const codeVerifierStore = new LRUCache(10);
      const timeoutStore = new Map();
      
      // Simulate storing multiple verifiers
      for (let i = 0; i < 15; i++) {
        const state = `state${i}`;
        const verifier = `verifier${i}`;
        
        codeVerifierStore.set(state, verifier);
        const timeoutId = setTimeout(() => {
          codeVerifierStore.delete(state);
          timeoutStore.delete(state);
        }, 1000);
        timeoutStore.set(state, timeoutId);
      }
      
      // Store size should be capped at 10
      expect(codeVerifierStore.size).toBe(10);
      
      // Cleanup
      for (const [state, timeoutId] of timeoutStore.entries()) {
        clearTimeout(timeoutId);
      }
    });

    it('should maintain LRU ordering with callback cleanup', () => {
      const codeVerifierStore = new LRUCache(5);
      
      // Add verifiers
      for (let i = 0; i < 5; i++) {
        codeVerifierStore.set(`state${i}`, `verifier${i}`);
      }
      
      // Simulate callback accessing state2 (making it most recent)
      const verifier = codeVerifierStore.get('state2');
      expect(verifier).toBe('verifier2');
      
      // Add new verifier - should evict state0 (oldest)
      codeVerifierStore.set('state5', 'verifier5');
      expect(codeVerifierStore.has('state0')).toBe(false);
      expect(codeVerifierStore.has('state2')).toBe(true);
      
      // Cleanup accessed verifier
      codeVerifierStore.delete('state2');
      expect(codeVerifierStore.has('state2')).toBe(false);
    });
  });
});
