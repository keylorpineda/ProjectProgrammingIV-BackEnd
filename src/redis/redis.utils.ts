import type Redis from "ioredis";

/**
 * Non-blocking equivalent of `redis.keys(pattern)`.
 *
 * `KEYS` scans the entire keyspace in one shot and blocks the Redis event loop
 * while doing so. `SCAN` iterates incrementally — safe for production even on
 * large keyspaces. Returns the same result set, just without the blocking.
 */
export async function scanKeys(
  redis: Redis,
  pattern: string,
): Promise<string[]> {
  const keys: string[] = [];
  let cursor = "0";
  do {
    const [next, found] = await redis.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      100,
    );
    cursor = next;
    keys.push(...found);
  } while (cursor !== "0");
  return keys;
}
