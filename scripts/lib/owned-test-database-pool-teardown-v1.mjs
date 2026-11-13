// Test harness cleanup only. Never bind this to a product/authority pool.
import assert from 'node:assert/strict';
export function guardOwnedTestDatabasePoolTeardownV1(pool, database) {
  let ownDropStarted = false;
  pool.on('error', (error, client) => {
    const clientDatabase = client?.database ?? client?.connectionParameters?.database;
    if (ownDropStarted && database && clientDatabase === database && error?.code === '57P01') return;
    throw error;
  });
  return {
    beginOwnDrop() {
      assert.ok(typeof database === 'string' && database.length > 0, 'OWNED_TEST_DATABASE_REQUIRED');
      ownDropStarted = true;
    },
  };
}
