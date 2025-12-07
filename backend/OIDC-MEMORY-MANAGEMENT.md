# OIDC Memory Management - LRU Cache Implementation

## Overview

The OIDC module uses PKCE (Proof Key for Code Exchange) for secure authentication flows. Each authentication attempt stores a code verifier temporarily in memory until the callback completes or times out.

## Memory Leak Risk & Mitigation

### Previous Risk
The original implementation used a plain `Map()` which could grow indefinitely under:
- Heavy load with many concurrent authentication attempts
- Repeated failed OIDC attempts
- Timeout cleanup failures
- Attack scenarios with abandoned flows

### Current Solution: LRU Cache with Size Limits

The `codeVerifierStore` now uses an LRU (Least Recently Used) cache with the following characteristics:

1. **Maximum Size Limit**: 1000 concurrent OIDC flows (configurable via `MAX_VERIFIER_STORE_SIZE`)
2. **Automatic Eviction**: When capacity is reached, the oldest (least recently used) entries are automatically removed
3. **Age-Based Cleanup**: Existing 10-minute timeout mechanism still operates for normal cleanup
4. **Memory Bounds**: Hard limit prevents unbounded memory growth

### Implementation Details

```javascript
// Simple LRU Cache with 1000 entry limit
let codeVerifierStore = new LRUCache(1000);

// Timeout cleanup still operates (10 minutes)
const PKCE_VERIFIER_TIMEOUT_MS = 10 * 60 * 1000;
```

### How It Works

1. **Normal Flow**: User initiates OIDC login → verifier stored → callback completes → cleanup happens
2. **Timeout Flow**: User abandons login → 10-minute timeout fires → automatic cleanup
3. **Heavy Load Flow**: >1000 concurrent attempts → LRU automatically evicts oldest entries → prevents memory exhaustion
4. **Combined Protection**: Both timeout-based and size-based eviction work together

## Monitoring Recommendations

### Production Monitoring

Monitor the following metrics to ensure healthy OIDC operation:

1. **Store Size** (if exposed via metrics endpoint):
   - Normal: < 100 entries
   - Warning: > 500 entries (indicates high load or slow callbacks)
   - Critical: Approaching 1000 (may indicate attack or performance issue)

2. **OIDC Flow Metrics**:
   - Success rate (callbacks that complete successfully)
   - Average time from authorization to callback
   - Timeout frequency (10-minute expiration events)

3. **Memory Usage**:
   - Overall Node.js heap size
   - Unexpected growth patterns

### Logging

The implementation logs important events:
- OIDC initialization success/failure
- Invalid state or expired verifier errors (may indicate timing issues)

### Alert Conditions

Consider alerting on:
- OIDC callback error rate > 10%
- Sustained high verifier store size (> 500 for extended period)
- Multiple "Invalid state or code verifier expired" errors (may indicate timeout too short)

## Configuration

### Adjusting the Cache Size

If you need to adjust the maximum number of concurrent flows:

```javascript
// In oidc.js
const MAX_VERIFIER_STORE_SIZE = 1000; // Increase if needed
let codeVerifierStore = new LRUCache(MAX_VERIFIER_STORE_SIZE);
```

**Sizing Guidelines**:
- **Default (1000)**: Handles up to 1000 concurrent OIDC login attempts
- **Small deployment**: 100-500 entries may be sufficient
- **Large deployment**: Consider 2000-5000 for high-traffic scenarios
- **Memory impact**: ~1KB per entry (approximate), so 1000 entries ≈ 1MB

### Adjusting the Timeout

If users frequently report "expired verifier" errors:

```javascript
// In oidc.js
const PKCE_VERIFIER_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes (default)
// Consider increasing to 15 or 20 minutes if needed
```

## Security Considerations

### Attack Mitigation

The LRU cache provides protection against:

1. **Memory Exhaustion Attacks**: Attacker cannot exhaust memory by creating unlimited OIDC flows
2. **DoS via Abandoned Flows**: Old flows are automatically evicted under load
3. **Slow Loris Style Attacks**: Size limit prevents resource starvation

### Best Practices

1. **Monitor for Anomalies**: Sudden spikes in OIDC flow creation may indicate attack
2. **Rate Limiting**: Consider adding rate limiting at the API gateway level
3. **State Validation**: Existing cryptographic state validation remains in place
4. **Timeout Tuning**: Balance user experience with resource conservation

## Testing

Comprehensive test coverage includes:
- Basic LRU operations (get, set, delete)
- Eviction behavior under capacity limits
- Heavy load scenarios (1000+ concurrent flows)
- Integration with existing timeout mechanism
- Edge cases and error handling

Run tests:
```bash
npm test -- oidc.test.js
```

## Performance Impact

- **Memory**: Bounded at ~1MB (1000 entries × ~1KB each)
- **CPU**: Minimal overhead (LRU operations are O(1) amortized)
- **Latency**: No measurable impact on OIDC flow performance

## Future Enhancements

Potential improvements if needed:
1. **Metrics Endpoint**: Expose store size for monitoring
2. **Dynamic Sizing**: Auto-adjust cache size based on load
3. **Persistent Storage**: Move to Redis for distributed deployments
4. **Advanced Eviction**: Implement TTL-based eviction with LRU

## References

- [PKCE Specification (RFC 7636)](https://tools.ietf.org/html/rfc7636)
- [OIDC Core Specification](https://openid.net/specs/openid-connect-core-1_0.html)
- Issue: "Memory leak risk in OIDC codeVerifierStore"
