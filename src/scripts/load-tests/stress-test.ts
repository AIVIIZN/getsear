/**
 * Legacy wrapper retained only to prevent stale load numbers.
 * Run the contract-checked suite instead:
 *   k6 run load-tests/full-shift.js
 */
export default function retiredStressLoadTest() {
  throw new Error('src/scripts/load-tests/stress-test.ts is retired. Use load-tests/full-shift.js; do not cite numbers from this stale script.')
}
