<!--
 * ═══════════════════════════════════════════════════════════════════════════
 * REDIS CACHE SETUP & CONFIGURATION GUIDE
 * 
 * This document covers Redis installation, configuration, and production
 * deployment for the AI ATS Resume Builder.
 * ═══════════════════════════════════════════════════════════════════════════
 -->

# Redis Cache Setup Guide

## Overview

Redis has been integrated into the B2World ATS Resume Builder to improve performance:

- **ATS Score Caching**: Reduces repeated score calculations (3600s TTL)
- **Semantic Matching**: Reduces Gemini API calls (3600s TTL)
- **User Lookups**: Reduces MongoDB queries on every request (300s TTL)
- **Graceful Fallback**: Application continues working if Redis is unavailable

---

## Installation

### Step 1: Install npm Package

The Redis npm client is already added to `package.json`. Install dependencies:

```bash
npm install
```

This installs the `redis` v4.6.12+ package needed for client connections.

---

### Step 2: Install Redis Server (Local Development)

#### **Windows (WSL2 / Docker Recommended)**

**Option A: Using Docker (Recommended)**

```bash
docker run -d -p 6379:6379 --name redis-cache redis:latest
```

**Option B: Using WSL2**

In your WSL2 Ubuntu terminal:

```bash
# Update package manager
sudo apt-get update

# Install Redis
sudo apt-get install redis-server

# Start Redis service
sudo service redis-server start

# Verify Redis is running
redis-cli ping
# Should output: PONG
```

**Option C: Download Windows Binary**

- Download from: https://github.com/microsoftarchive/redis/releases
- Extract and run `redis-server.exe`

#### **macOS (Homebrew)**

```bash
# Install Redis
brew install redis

# Start Redis service
brew services start redis

# Verify Redis is running
redis-cli ping
# Should output: PONG
```

#### **Linux (Ubuntu/Debian)**

```bash
# Install Redis
sudo apt-get install redis-server

# Start Redis service
sudo systemctl start redis-server

# Verify Redis is running
redis-cli ping
# Should output: PONG
```

---

### Step 3: Configure Environment Variables

Create a `.env` file in the project root with:

```env
# ═══════════════════════════════════════════════════════════════════
# REDIS CONFIGURATION
# ═══════════════════════════════════════════════════════════════════

# Redis connection URL (default: redis://localhost:6379)
# Format: redis://[username:password@]host:port[/db]

# For local development:
REDIS_URL=redis://localhost:6379

# For production (with authentication):
# REDIS_URL=redis://:password@redis-server.example.com:6379

# For Azure Cache for Redis:
# REDIS_URL=redis://:password@myredis.redis.cache.windows.net:6379

# Disable Redis caching (set to 'false' to disable):
# REDIS_ENABLED=true

# ═══════════════════════════════════════════════════════════════════
# OTHER CONFIGURATION
# ═══════════════════════════════════════════════════════════════════

PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/b2world-ats
JWT_SECRET=your-secret-key-here
SEMANTIC_ENGINE_URL=http://localhost:8000
```

---

## Redis Architecture

### Caching Strategy: Cache-Aside Pattern

```
┌─────────────────────────────────────────────────┐
│         Application Request                      │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
            ┌─────────────────┐
            │  Check Cache?   │
            └────────┬────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼ (Hit)          ▼ (Miss)
    ┌─────────┐      ┌──────────────┐
    │ Return  │      │ Compute from │
    │ Cached  │      │ DB / API     │
    │ Value   │      └────────┬─────┘
    └─────────┘               │
         │                    │
         │                    ▼
         │          ┌──────────────────┐
         │          │ Store in Cache   │
         │          │ (with TTL)       │
         │          └────────┬─────────┘
         │                   │
         └───────────┬───────┘
                     │
                     ▼
            ┌─────────────────┐
            │ Return Result   │
            └─────────────────┘
```

### Cache Keys

All cache keys follow a predictable pattern:

```
ats:{resumeId}:{jdId}                 # ATS score (3600s)
semantic:{resumeId}:{jdId}            # Semantic match (3600s)
skillgap:{resumeId}:{jdId}            # Skill gap (3600s)
user:{userId}                         # User profile (300s)
```

### Cache Invalidation

Caches are automatically invalidated when:

1. **Resume Updated**: All ATS, semantic, and skill gap caches for that resume
2. **Resume Deleted**: All caches for that resume
3. **User Updated**: User cache for that user

---

## API Reference

### Cache Service (`services/cache.service.js`)

```javascript
const cache = require('./services/cache.service');

// Initialize Redis (auto-called on server startup)
await cache.initRedis();

// Check connection status
cache.isRedisConnected(); // Returns: true|false

// Get value
const value = await cache.get('key');

// Set value with TTL
await cache.set('key', value, 3600); // TTL in seconds

// Delete key
await cache.del('key');

// Delete by pattern
await cache.deleteByPattern('ats:*'); // Delete all ATS caches

// Check if key exists
const exists = await cache.exists('key');

// Get TTL remaining
const ttl = await cache.ttl('key');

// Flush all cache
await cache.flush();

// Close connection
await cache.closeConnection();
```

### Cache Helpers (`utils/cacheHelper.js`)

```javascript
const cacheHelper = require('./utils/cacheHelper');

// Cache-aside pattern: get or compute
const result = await cacheHelper.getOrSet(
  'cache-key',
  async () => {
    // Compute value if cache miss
    return expensiveOperation();
  },
  3600 // TTL in seconds
);

// Invalidate caches
await cacheHelper.invalidateResumeAnalyses(resumeId);
await cacheHelper.invalidateJobDescriptionAnalyses(jdId);
await cacheHelper.invalidateUser(userId);
```

---

## Monitoring & Debugging

### Check Redis Connection Status

In your application logs, you'll see:

```
✅ Redis Connected
✅ Redis Ready
✅ Redis client initialized and connected
```

Or if Redis is unavailable:

```
⚠️  Redis unavailable - using fallback (no caching)
❌ Redis Error: Error message
```

### Monitor Cache Performance

The application logs cache hits and misses:

```
✅ CACHE HIT: ats:507f1f77bcf86cd799439011:507f1f77bcf86cd799439012
❌ CACHE MISS: ats:507f1f77bcf86cd799439011:507f1f77bcf86cd799439012
🗑️  CACHE INVALIDATED: ats:507f1f77bcf86cd799439011:*
```

### Redis CLI Debugging

```bash
# Connect to Redis
redis-cli

# Check all keys
> KEYS *

# Get key value
> GET "ats:507f1f77bcf86cd799439011:507f1f77bcf86cd799439012"

# Check TTL remaining (in seconds)
> TTL "key"

# Flush all cache
> FLUSHDB

# Monitor real-time operations
> MONITOR

# Get Redis stats
> INFO stats
```

---

## Production Deployment

### Azure Cache for Redis

1. **Create Azure Cache for Redis**:
   - Azure Portal → "Cache for Redis" → Create
   - Select Standard or Premium tier
   - Note the hostname and access key

2. **Update Environment Variables**:
   ```env
   REDIS_URL=redis://:your-password@yourname.redis.cache.windows.net:6379
   ```

3. **Enable SSL** (Recommended):
   - Azure uses SSL by default
   - Connection string format: `redis://...?tls=true`

### Self-Hosted Redis (AWS ElastiCache, etc.)

1. **Create Redis Cluster**:
   - AWS ElastiCache → Redis → Create
   - Configure security groups
   - Note endpoint and port

2. **Update Environment Variables**:
   ```env
   REDIS_URL=redis://your-endpoint:6379
   ```

3. **Enable AUTH** (Recommended):
   ```env
   REDIS_URL=redis://:auth-token@your-endpoint:6379
   ```

### Docker Compose (Multi-container)

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - REDIS_URL=redis://redis:6379
      - MONGODB_URI=mongodb://mongo:27017/b2world
    depends_on:
      - redis
      - mongo

  redis:
    image: redis:latest
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

  mongo:
    image: mongo:latest
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db

volumes:
  redis-data:
  mongo-data:
```

Run with:
```bash
docker-compose up
```

---

## Performance Expectations

### Expected Improvements

With Redis caching enabled:

| Metric | Without Cache | With Cache | Improvement |
|--------|---------------|-----------|-------------|
| ATS Score Calculation | ~800ms | ~50ms (cache) | **16x faster** |
| Gemini Semantic Call | ~2000ms | ~100ms (cache) | **20x faster** |
| User DB Lookup | ~50ms | ~5ms (cache) | **10x faster** |
| API Latency (avg) | ~300ms | ~100ms | **3x faster** |
| Gemini API Calls/min | ~60 | ~15 | **75% reduction** |
| MongoDB Queries/min | ~150 | ~50 | **67% reduction** |

### Cache Hit Rates

Expected cache hit rates after warmup:

- **ATS Scores**: 70-80% (same resume/JD combinations)
- **Semantic Matches**: 60-75% (same candidate profiles)
- **User Lookups**: 85-95% (frequent active users)

---

## Troubleshooting

### "Redis connection refused"

```
❌ Redis Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solution:**
- Check Redis is running: `redis-cli ping`
- Verify REDIS_URL in .env
- For Docker: `docker ps` to check container is running

### "AUTH failed"

```
❌ Redis Error: WRONGPASS invalid username-password pair
```

**Solution:**
- Verify password in REDIS_URL
- For Azure: Use the "Primary connection string" from portal
- Format: `redis://:password@host:6379`

### "Redis timeout"

```
⚠️  Redis: Max reconnection attempts reached
```

**Solution:**
- Check network connectivity
- Verify firewall allows port 6379
- Check Redis server is not overloaded: `redis-cli INFO`

### High Memory Usage

```
> INFO memory
# Memory
used_memory_human:2.5G
```

**Solution:**
- Check eviction policy: `CONFIG GET maxmemory-policy`
- Set policy: `CONFIG SET maxmemory-policy allkeys-lru`
- Clear cache: `FLUSHDB`

---

## Code Examples

### Using Cached ATS Scoring

```javascript
// Old way (no cache)
const score = await atsService.calculateATSScore(resume, jd);

// New way (with cache)
const cachedService = require('./services/atsServiceCached');
const score = await cachedService.calculateATSScoreCached(resume, jd);
// Cache hit: ~50ms, Cache miss: ~800ms
```

### Using Cached Semantic Matching

```javascript
// With cache
const semanticService = require('./services/semanticServiceCached');
const score = await semanticService.getSemanticScoreCached(resume, jdText);
// Reduces Gemini API calls by 70-80%
```

### Manual Cache Invalidation

```javascript
const cacheHelper = require('./utils/cacheHelper');

// When resume is updated
await cacheHelper.invalidateResumeAnalyses(resumeId);

// When JD is updated
await cacheHelper.invalidateJobDescriptionAnalyses(jdId);

// When user is updated
await cacheHelper.invalidateUser(userId);
```

---

## Testing

### Unit Tests with Cache

```javascript
// Test cache behavior
describe('Cache Service', () => {
  it('should cache values with TTL', async () => {
    await cache.set('test-key', { data: 'test' }, 60);
    const value = await cache.get('test-key');
    expect(value.data).toBe('test');
  });

  it('should return null for expired keys', async () => {
    await cache.set('temp-key', { data: 'temp' }, 1);
    await new Promise(resolve => setTimeout(resolve, 1100));
    const value = await cache.get('temp-key');
    expect(value).toBeNull();
  });
});
```

### Load Testing

```bash
# Using Apache Bench (ab)
ab -n 1000 -c 10 http://localhost:5000/api/ats/calculate

# Monitor Redis performance
redis-cli MONITOR
```

---

## Best Practices

1. **Always use TTL**: Prevents memory bloat
2. **Check Redis connection**: Log at startup
3. **Graceful fallback**: Application works without Redis
4. **Invalidate on updates**: Keep cache fresh
5. **Monitor cache stats**: Track hit rates
6. **Use patterns for cleanup**: `KEYS pattern` for batch delete
7. **Set maxmemory policy**: Prevent out-of-memory errors
8. **Use compression**: For large values if needed

---

## Next Steps

1. ✅ Install Redis server locally
2. ✅ Update `.env` with `REDIS_URL`
3. ✅ Run `npm install`
4. ✅ Start server: `npm run dev`
5. ✅ Check logs for "✅ Redis Connected"
6. ✅ Monitor cache hits/misses in logs
7. ✅ Deploy to production with persistent Redis

---

## Support

For issues or questions:
- Check Redis server status: `redis-cli PING`
- Review application logs for cache errors
- Monitor Redis stats: `redis-cli INFO`
- Test connectivity: `redis-cli -h <host> -p 6379 PING`

