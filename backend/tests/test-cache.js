/* eslint-disable no-console */
// test-cache.js (run manually)
const { cacheService, redisClient } = require('../src/infrastructure/cache/index');

async function test() {
  await redisClient.connect();

  // Test basic get/set
  await cacheService.set('test:key', { hello: 'world' }, 60);
  const result = await cacheService.get('test:key');
  console.log('GET/SET:', result); // { hello: 'world' }

  // Test cache-aside
  const data = await cacheService.getOrSet(
    'test:aside',
    async () => ({ fetched: true, time: Date.now() }),
    30,
  );
  console.log('Cache-aside:', data);

  // Test distributed lock
  const lock = await cacheService.acquireLock('test:lock', 5);
  console.log('Lock acquired:', !!lock);
  await cacheService.releaseLock('test:lock', lock);

  // Test rate limiting
  const rl = await cacheService.checkRateLimit('test:rl', 3, 60);
  console.log('Rate limit:', rl);

  // Test health
  const health = await cacheService.getHealth();
  console.log('Health:', health);

  // Cleanup
  await cacheService.del('test:key');
  await cacheService.del('test:aside');
  await redisClient.disconnect();
}

test().catch(console.error);
