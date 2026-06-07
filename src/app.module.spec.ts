import type { MiddlewareConsumer } from "@nestjs/common";
import { MODULE_METADATA } from "@nestjs/common/constants";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { ScheduleModule } from "@nestjs/schedule";
import { AppModule } from "./app.module";
import { CsrfMiddleware } from "./common/middleware/csrf.middleware";
import { JwtAuthGuard } from "./auth/guards/jwt-auth.guard";
import { RolesGuard } from "./auth/guards/roles.guard";
import { SessionInactivityGuard } from "./auth/guards/session-inactivity.guard";
import { SessionActivityInterceptor } from "./auth/interceptors/session-activity.interceptor";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { CampsModule } from "./camps/camps.module";
import { ResourcesModule } from "./resources/resources.module";
import { ExplorationsModule } from "./explorations/explorations.module";
import { TransfersModule } from "./transfers/transfers.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { AiModule } from "./ai/ai.module";
import { UploadModule } from "./upload/upload.module";
import { DatabaseModule } from "./database/database.module";

describe("AppModule", () => {
  const getModuleMetadata = (key: string) =>
    Reflect.getMetadata(key, AppModule) as unknown[];

  it("should define module metadata", () => {
    expect(AppModule).toBeDefined();
  });

  it("should configure imports and global providers", () => {
    const imports = getModuleMetadata(MODULE_METADATA.IMPORTS);
    const providers = getModuleMetadata(MODULE_METADATA.PROVIDERS) as Array<{
      provide: unknown;
      useClass: unknown;
    }>;

    expect(imports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ module: ThrottlerModule }),
        expect.objectContaining({ module: TypeOrmModule }),
        expect.objectContaining({ module: ScheduleModule }),
        HealthModule,
        AuthModule,
        UsersModule,
        CampsModule,
        ResourcesModule,
        ExplorationsModule,
        TransfersModule,
        DashboardModule,
        AiModule,
        UploadModule,
        DatabaseModule,
      ]),
    );

    expect(providers).toEqual(
      expect.arrayContaining([
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: SessionInactivityGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_INTERCEPTOR, useClass: SessionActivityInterceptor },
      ]),
    );
  });

  it("should execute Throttler async factory", () => {
    const imports = getModuleMetadata(MODULE_METADATA.IMPORTS);
    const throttlerDynamicModule = imports.find(
      (item) => (item as { module?: unknown })?.module === ThrottlerModule,
    ) as { providers?: Array<Record<string, unknown>> };

    const optionsProvider = throttlerDynamicModule.providers?.find(
      (provider) =>
        Array.isArray(provider.inject) &&
        provider.inject.includes(ConfigService) &&
        typeof provider.useFactory === "function",
    ) as {
      useFactory: (config: ConfigService) => Array<Record<string, unknown>>;
    };

    const config = {
      get: jest.fn((key: string, fallback?: number) => {
        if (key === "THROTTLE_TTL") return 120000;
        if (key === "THROTTLE_LIMIT") return 25;
        return fallback;
      }),
    } as unknown as ConfigService;

    const options = optionsProvider.useFactory(config);

    expect(options).toEqual([{ ttl: 120000, limit: 25 }]);
    expect(config.get).toHaveBeenCalledWith("THROTTLE_TTL", 60000);
    expect(config.get).toHaveBeenCalledWith("THROTTLE_LIMIT", 10);
  });

  it("should execute TypeORM async factory for development and production", () => {
    const imports = getModuleMetadata(MODULE_METADATA.IMPORTS);
    const typeOrmDynamicModule = imports.find(
      (item) => (item as { module?: unknown })?.module === TypeOrmModule,
    ) as { imports?: Array<Record<string, unknown>> };
    const typeOrmCoreModule = typeOrmDynamicModule.imports?.find(
      (moduleImport) =>
        Array.isArray(moduleImport.providers) &&
        moduleImport.providers.some(
          (provider) =>
            provider.provide === "TypeOrmModuleOptions" &&
            Array.isArray(provider.inject) &&
            provider.inject.includes(ConfigService) &&
            typeof provider.useFactory === "function",
        ),
    ) as { providers: Array<Record<string, unknown>> };
    const optionsProvider = typeOrmCoreModule.providers.find(
      (provider) => provider.provide === "TypeOrmModuleOptions",
    ) as { useFactory: (config: ConfigService) => Record<string, unknown> };

    const developmentConfig = {
      get: jest.fn((key: string) => {
        const values: Record<string, unknown> = {
          DB_HOST: "localhost",
          DB_PORT: 5432,
          DB_USER: "postgres",
          DB_PASS: "postgres",
          DB_NAME: "test_db",
          NODE_ENV: "development",
        };
        // eslint-disable-next-line security/detect-object-injection
        return values[key];
      }),
    } as unknown as ConfigService;

    const productionConfig = {
      get: jest.fn((key: string) => {
        const values: Record<string, unknown> = {
          DB_HOST: "db",
          DB_PORT: 5432,
          DB_USER: "user",
          DB_PASS: "pass",
          DB_NAME: "prod_db",
          NODE_ENV: "production",
        };
        // eslint-disable-next-line security/detect-object-injection
        return values[key];
      }),
    } as unknown as ConfigService;

    const devOptions = optionsProvider.useFactory(developmentConfig);
    const prodOptions = optionsProvider.useFactory(productionConfig);

    expect(devOptions).toEqual(
      expect.objectContaining({
        type: "postgres",
        synchronize: true,
        ssl: false,
        logging: true,
      }),
    );
    expect(prodOptions).toEqual(
      expect.objectContaining({
        type: "postgres",
        synchronize: false,
        ssl: { rejectUnauthorized: false },
        logging: false,
      }),
    );
  });

  it("should apply csrf middleware to all routes", () => {
    const forRoutes = jest.fn();
    const apply = jest.fn().mockReturnValue({ forRoutes });
    const consumer = { apply } as unknown as MiddlewareConsumer;
    const module = new AppModule({} as any);

    module.configure(consumer);

    expect(apply).toHaveBeenCalledWith(CsrfMiddleware);
    expect(forRoutes).toHaveBeenCalledWith("*");
  });
});
