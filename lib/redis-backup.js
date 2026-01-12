import { Redis } from '@upstash/redis';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const redis = Redis.fromEnv();

async function scanAllKeys() {
  const allKeys = [];
  let cursor = "0";
  do {
    const [nextCursor, keys] = await redis.scan(cursor, { withType: true, count: 100 });
    cursor = nextCursor;
    allKeys.push(...keys);
    console.log(`Scanned ${allKeys.length} keys so far... cursor: ${cursor}`);
  } while (cursor !== "0");
  return allKeys;
}

async function getValueByType(key, type) {
  switch (type) {
    case 'string':
      return redis.get(key);
    case 'hash':
      return redis.hgetall(key);
    case 'list':
      return redis.lrange(key, 0, -1);
    case 'set':
      return redis.smembers(key);
    case 'zset':
      return redis.zrange(key, 0, -1, { withScores: true });
    case 'none':
      return null;
    default:
      console.warn(`Unknown type "${type}" for key "${key}"`);
      return null;
  }
}

async function ensureBackupDirectory(baseDir, date) {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const targetDir = join(baseDir, year, month);
  await mkdir(targetDir, { recursive: true });
  return targetDir;
}

async function createBackup(options = {}) {
  const { backupDir = './backup' } = options;
  const now = new Date();

  console.log('Scanning all keys...');
  const keysWithTypes = await scanAllKeys();
  console.log(`Found ${keysWithTypes.length} keys`);

  const backupData = {
    metadata: {
      timestamp: now.toISOString(),
      keyCount: keysWithTypes.length,
      version: '1.0'
    },
    data: {
      string_keys: {},
      hash_keys: {},
      list_keys: {},
      set_keys: {},
      zset_keys: {}
    }
  };

  console.log('Fetching data for each key...');
  for (const { key, type } of keysWithTypes) {
    const value = await getValueByType(key, type);
    if (value !== null) {
      const targetKey = `${type}_keys`;
      if (backupData.data[targetKey]) {
        backupData.data[targetKey][key] = value;
      }
    }
  }

  const targetDir = await ensureBackupDirectory(backupDir, now);
  const filename = now.toISOString().replace(/:/g, '-') + '.json';
  const filePath = join(targetDir, filename);

  await writeFile(filePath, JSON.stringify(backupData, null, 2), 'utf-8');
  console.log(`Backup created: ${filePath}`);
  return filePath;
}

async function restoreBackup(backupFilePath) {
  const absolutePath = resolve(backupFilePath);
  console.log(`Reading backup from: ${absolutePath}`);

  const backupContent = await readFile(absolutePath, 'utf-8');
  const backup = JSON.parse(backupContent);

  console.log(`Restoring ${backup.metadata.keyCount} keys from backup dated ${backup.metadata.timestamp}`);

  // Restore strings
  for (const [key, value] of Object.entries(backup.data.string_keys)) {
    await redis.set(key, value);
  }
  console.log(`Restored ${Object.keys(backup.data.string_keys).length} string keys`);

  // Restore hashes
  for (const [key, hash] of Object.entries(backup.data.hash_keys)) {
    await redis.hset(key, hash);
  }
  console.log(`Restored ${Object.keys(backup.data.hash_keys).length} hash keys`);

  // Restore lists (clear first, then push all)
  for (const [key, list] of Object.entries(backup.data.list_keys)) {
    await redis.del(key);
    if (list.length > 0) {
      await redis.rpush(key, ...list);
    }
  }
  console.log(`Restored ${Object.keys(backup.data.list_keys).length} list keys`);

  // Restore sets
  for (const [key, members] of Object.entries(backup.data.set_keys)) {
    await redis.del(key);
    if (members.length > 0) {
      await redis.sadd(key, ...members);
    }
  }
  console.log(`Restored ${Object.keys(backup.data.set_keys).length} set keys`);

  // Restore sorted sets
  for (const [key, items] of Object.entries(backup.data.zset_keys)) {
    await redis.del(key);
    if (items.length > 0) {
      const args = items.flatMap(item => [item.score, item.member]);
      await redis.zadd(key, ...args);
    }
  }
  console.log(`Restored ${Object.keys(backup.data.zset_keys).length} sorted set keys`);

  console.log('Restore completed successfully');
}

const main = async () => {
  const [,, command, ...args] = process.argv;

  switch (command) {
    case 'backup':
      await createBackup();
      break;
    case 'restore':
      if (!args[0]) {
        console.error('Usage: node lib/redis-backup.js restore <path-to-backup.json>');
        process.exit(1);
      }
      await restoreBackup(args[0]);
      break;
    default:
      console.log('Usage:');
      console.log('  node lib/redis-backup.js backup                    - Create a backup');
      console.log('  node lib/redis-backup.js restore <backup.json>     - Restore from backup');
      process.exit(1);
  }
};

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
