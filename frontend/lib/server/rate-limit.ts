import "server-only";

import { redis } from "./redis";

export async function withinLimit(key: string, maximum: number, seconds: number) {
  const client = redis();
  if (client.status === "wait") await client.connect();
  const count = await client.eval(`
    local count = redis.call('INCR', KEYS[1])
    if redis.call('TTL', KEYS[1]) < 0 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
    return count
  `, 1, key, seconds);
  return Number(count) <= maximum;
}
