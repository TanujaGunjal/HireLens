/**
 * ═══════════════════════════════════════════════════════════════════════════
 * REDIS CACHE SERVICE
 * 
 * Production-ready Redis client with:
 * - Automatic connection handling
 * - Graceful error handling
 * - Reconnection logic
 * - Graceful shutdown
 * - Error-safe fallback
 * 
 * Features:
 * - Set/Get with TTL
 * - Delete keys
 * - Pattern-based deletion (for invalidation)
 * - Connection status tracking
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

const redis = require('redis');

// Redis client instance
let client = null;
let isConnected = false;
let isConnecting = false;

/**
 * Initialize and connect Redis client
 * Uses process.env.REDIS_URL with fallback to localhost:6379
 */
async function initRedis() {
  if (client && isConnected) {
    return client;
  }

  if (isConnecting) {
    // Wait for ongoing connection attempt
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (isConnected) {
          clearInterval(checkInterval);
          resolve(client);
        }
      }, 100);
      // Timeout after 10 seconds
      setTimeout(() => clearInterval(checkInterval), 10000);
    });
  }

  isConnecting = true;

  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    client = redis.createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.warn('⚠️  Redis: Max reconnection attempts reached');
            return new Error('Max Redis reconnection attempts reached');
          }
          return retries * 100; // Exponential backoff
        },
        connectTimeout: 5000,
      },
    });

    // Connection event handlers
    client.on('connect', () => {
      console.log('✅ Redis Connected');
      isConnected = true;
      isConnecting = false;
    });

    client.on('error', (err) => {
      console.error('❌ Redis Error:', err.message);
      isConnected = false;
    });

    client.on('reconnecting', () => {
      console.log('🔄 Redis Reconnecting...');
      isConnected = false;
    });

    client.on('ready', () => {
      console.log('✅ Redis Ready');
      isConnected = true;
    });

    // Connect client
    await client.connect();
    isConnected = true;
    isConnecting = false;

    console.log('✅ Redis client initialized and connected');
    return client;
  } catch (error) {
    console.error('❌ Failed to connect to Redis:', error.message);
    isConnected = false;
    isConnecting = false;
    
    // Return a mock client that fails gracefully
    return createFallbackClient();
  }
}

/**
 * Get Redis client (lazy initialization)
 */
async function getClient() {
  if (!client) {
    await initRedis();
  }
  return client;
}

/**
 * Check if Redis is connected
 */
function isRedisConnected() {
  return isConnected && client !== null;
}

/**
 * Set value in cache with TTL (in seconds)
 * @param {string} key - Cache key
 * @param {any} value - Value to cache (auto-JSON stringified)
 * @param {number} ttl - Time to live in seconds (default: 3600)
 */
async function set(key, value, ttl = 3600) {
  if (!isRedisConnected()) {
    return false; // Graceful fallback
  }

  try {
    const redisClient = await getClient();
    const jsonValue = JSON.stringify(value);
    
    if (ttl && ttl > 0) {
      await redisClient.setEx(key, ttl, jsonValue);
    } else {
      await redisClient.set(key, jsonValue);
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Cache SET error for key "${key}":`, error.message);
    return false; // Don't break application on cache error
  }
}

/**
 * Get value from cache
 * @param {string} key - Cache key
 * @returns {any} - Cached value or null if not found/expired
 */
async function get(key) {
  if (!isRedisConnected()) {
    return null; // Graceful fallback
  }

  try {
    const redisClient = await getClient();
    const value = await redisClient.get(key);
    
    if (value === null) {
      return null;
    }

    return JSON.parse(value);
  } catch (error) {
    console.error(`❌ Cache GET error for key "${key}":`, error.message);
    return null; // Don't break application on cache error
  }
}

/**
 * Delete a key from cache
 * @param {string} key - Cache key
 */
async function del(key) {
  if (!isRedisConnected()) {
    return false; // Graceful fallback
  }

  try {
    const redisClient = await getClient();
    await redisClient.del(key);
    return true;
  } catch (error) {
    console.error(`❌ Cache DEL error for key "${key}":`, error.message);
    return false;
  }
}

/**
 * Delete multiple keys from cache
 * @param {string[]} keys - Array of cache keys
 */
async function delMultiple(keys) {
  if (!isRedisConnected() || !keys || keys.length === 0) {
    return false;
  }

  try {
    const redisClient = await getClient();
    await redisClient.del(keys);
    return true;
  } catch (error) {
    console.error(`❌ Cache DELMULTIPLE error:`, error.message);
    return false;
  }
}

/**
 * Delete all keys matching a pattern (useful for invalidation)
 * @param {string} pattern - Pattern to match (e.g., "ats:*")
 */
async function deleteByPattern(pattern) {
  if (!isRedisConnected()) {
    return false;
  }

  try {
    const redisClient = await getClient();
    const keys = await redisClient.keys(pattern);
    
    if (keys.length === 0) {
      return true;
    }

    await redisClient.del(keys);
    console.log(`🗑️  Deleted ${keys.length} cache keys matching pattern: ${pattern}`);
    return true;
  } catch (error) {
    console.error(`❌ Cache DELETEBYPATTERN error for pattern "${pattern}":`, error.message);
    return false;
  }
}

/**
 * Clear all cache
 */
async function flush() {
  if (!isRedisConnected()) {
    return false;
  }

  try {
    const redisClient = await getClient();
    await redisClient.flushDb();
    console.log('🗑️  Redis cache flushed');
    return true;
  } catch (error) {
    console.error('❌ Cache FLUSH error:', error.message);
    return false;
  }
}

/**
 * Check if key exists
 * @param {string} key - Cache key
 */
async function exists(key) {
  if (!isRedisConnected()) {
    return false;
  }

  try {
    const redisClient = await getClient();
    const result = await redisClient.exists(key);
    return result === 1;
  } catch (error) {
    console.error(`❌ Cache EXISTS error for key "${key}":`, error.message);
    return false;
  }
}

/**
 * Get time to live for a key (in seconds)
 * @param {string} key - Cache key
 */
async function ttl(key) {
  if (!isRedisConnected()) {
    return -1;
  }

  try {
    const redisClient = await getClient();
    return await redisClient.ttl(key);
  } catch (error) {
    console.error(`❌ Cache TTL error for key "${key}":`, error.message);
    return -1;
  }
}

/**
 * Gracefully shutdown Redis client
 */
async function closeConnection() {
  if (client) {
    try {
      await client.quit();
      console.log('✅ Redis connection closed');
      isConnected = false;
      client = null;
    } catch (error) {
      console.error('⚠️  Error closing Redis connection:', error.message);
    }
  }
}

/**
 * Create a fallback client that simulates Redis behavior but doesn't actually cache
 * Used when Redis is unavailable to prevent application crashes
 */
function createFallbackClient() {
  console.warn('⚠️  Redis unavailable - using fallback (no caching)');
  
  return {
    set: async () => false,
    get: async () => null,
    del: async () => false,
    keys: async () => [],
    flushDb: async () => false,
    exists: async () => false,
    ttl: async () => -1,
  };
}

// Graceful shutdown on process termination
process.on('SIGTERM', closeConnection);
process.on('SIGINT', closeConnection);

module.exports = {
  initRedis,
  getClient,
  isRedisConnected,
  set,
  get,
  del,
  delMultiple,
  deleteByPattern,
  flush,
  exists,
  ttl,
  closeConnection,
};
