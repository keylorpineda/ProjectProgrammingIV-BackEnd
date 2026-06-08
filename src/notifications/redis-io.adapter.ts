import { IoAdapter } from "@nestjs/platform-socket.io";
import type { ServerOptions } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";
import type { INestApplicationContext } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  constructor(app: INestApplicationContext) {
    super(app);
    const configService = app.get(ConfigService);

    const redisUrl = configService.get<string>("REDIS_URL");
    const redisOptions = {
      host: configService.get<string>("REDIS_HOST", "localhost"),
      port: configService.get<number>("REDIS_PORT", 6379),
      password: configService.get<string>("REDIS_PASSWORD"),
      maxRetriesPerRequest: null,
    };

    const pubClient = redisUrl
      ? new Redis(redisUrl, { maxRetriesPerRequest: null })
      : new Redis(redisOptions);

    const subClient = pubClient.duplicate();

    pubClient.on("error", (err) => {
      console.error("Redis pubClient error:", err.message);
    });
    subClient.on("error", (err) => {
      console.error("Redis subClient error:", err.message);
    });
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
