describe("main bootstrap", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const loadMain = async () => {
    const use = jest.fn();
    const set = jest.fn();
    const useGlobalInterceptors = jest.fn();
    const enableCors = jest.fn();
    const setGlobalPrefix = jest.fn();
    const useGlobalPipes = jest.fn();
    const listen = jest.fn().mockResolvedValue(undefined);

    const app = {
      use,
      set,
      useGlobalInterceptors,
      enableCors,
      setGlobalPrefix,
      useGlobalPipes,
      listen,
    };

    const createDocument = jest.fn().mockReturnValue({ openapi: "3.0.0" });
    const setup = jest.fn();
    const setTitle = jest.fn().mockReturnThis();
    const setDescription = jest.fn().mockReturnThis();
    const setVersion = jest.fn().mockReturnThis();
    const addBearerAuth = jest.fn().mockReturnThis();
    const build = jest.fn().mockReturnValue({ built: true });
    const json = jest.fn().mockReturnValue("json-middleware");
    const urlencoded = jest.fn().mockReturnValue("urlencoded-middleware");
    const helmet = jest.fn().mockReturnValue("helmet-middleware");
    const validationPipeInstance = { kind: "validation-pipe" };
    const ValidationPipe = jest
      .fn()
      .mockImplementation(() => validationPipeInstance);
    const sanitizeInterceptorInstance = { kind: "sanitize-interceptor" };
    const SanitizeInterceptor = jest
      .fn()
      .mockImplementation(() => sanitizeInterceptorInstance);
    const create = jest.fn().mockResolvedValue(app);
    const logSpy = jest
      .spyOn(console, "log")
      .mockImplementation(() => undefined);

    jest.doMock("@nestjs/core", () => ({
      NestFactory: { create },
    }));
    jest.doMock("@nestjs/common", () => ({
      ValidationPipe,
      VersioningType: { URI: "URI" },
    }));
    jest.doMock("@nestjs/swagger", () => ({
      SwaggerModule: { createDocument, setup },
      DocumentBuilder: jest.fn().mockImplementation(() => ({
        setTitle,
        setDescription,
        setVersion,
        addBearerAuth,
        build,
      })),
    }));
    jest.doMock("express", () => ({ json, urlencoded }));
    jest.doMock("helmet", () => ({
      __esModule: true,
      default: helmet,
    }));
    jest.doMock("./app.module", () => ({ AppModule: class AppModule {} }));
    jest.doMock("./common/interceptors/sanitize.interceptor", () => ({
      SanitizeInterceptor,
    }));

    await import("./main");
    await new Promise((resolve) => setImmediate(resolve));

    logSpy.mockRestore();

    return {
      app,
      create,
      json,
      urlencoded,
      helmet,
      ValidationPipe,
      SanitizeInterceptor,
      createDocument,
      setup,
      setTitle,
      setDescription,
      setVersion,
      addBearerAuth,
      build,
      logSpy,
    };
  };

  it("should bootstrap the app using default values", async () => {
    delete process.env.MAX_REQUEST_SIZE;
    delete process.env.CORS_ORIGIN;
    delete process.env.PORT;

    const ctx = await loadMain();

    expect(ctx.create).toHaveBeenCalledWith(expect.any(Function), {
      bodyParser: false,
    });
    expect(ctx.json).toHaveBeenCalledWith({ limit: "1mb" });
    expect(ctx.urlencoded).toHaveBeenCalledWith({
      extended: true,
      limit: "1mb",
    });
    expect(ctx.app.use).toHaveBeenCalledWith("json-middleware");
    expect(ctx.app.use).toHaveBeenCalledWith("urlencoded-middleware");
    expect(ctx.helmet).toHaveBeenCalledTimes(1);
    expect(ctx.app.use).toHaveBeenCalledWith("helmet-middleware");
    expect(ctx.SanitizeInterceptor).toHaveBeenCalledTimes(1);
    expect(ctx.app.useGlobalInterceptors).toHaveBeenCalledWith({
      kind: "sanitize-interceptor",
    });
    expect(ctx.app.set).toHaveBeenCalledWith("trust proxy", 1);
    expect(ctx.app.enableCors).toHaveBeenCalledWith({
      origin: ["http://localhost:3000"],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: false,
    });
    expect(ctx.app.setGlobalPrefix).toHaveBeenCalledWith("api/v1");
    expect(ctx.ValidationPipe).toHaveBeenCalledWith({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    });
    expect(ctx.app.useGlobalPipes).toHaveBeenCalledWith({
      kind: "validation-pipe",
    });
    expect(ctx.setTitle).toHaveBeenCalledWith("Gestión del Fin API");
    expect(ctx.setDescription).toHaveBeenCalledWith(
      "API del sistema de gestión de campamentos - Apocalipsis Zombie",
    );
    expect(ctx.setVersion).toHaveBeenCalledWith("1.0");
    expect(ctx.addBearerAuth).toHaveBeenCalledTimes(1);
    expect(ctx.build).toHaveBeenCalledTimes(1);
    expect(ctx.createDocument).toHaveBeenCalledWith(ctx.app, { built: true });
    expect(ctx.setup).toHaveBeenCalledWith("api/v1/docs", ctx.app, {
      openapi: "3.0.0",
    });
    expect(ctx.app.listen).toHaveBeenCalledWith(3000, "0.0.0.0");
  });

  it("should bootstrap the app using custom environment values", async () => {
    process.env.MAX_REQUEST_SIZE = "8mb";
    process.env.CORS_ORIGIN =
      "https://one.example, https://two.example ,https://three.example";
    process.env.PORT = "4010";

    const ctx = await loadMain();

    expect(ctx.json).toHaveBeenCalledWith({ limit: "8mb" });
    expect(ctx.urlencoded).toHaveBeenCalledWith({
      extended: true,
      limit: "8mb",
    });
    expect(ctx.app.enableCors).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: [
          "https://one.example",
          "https://two.example",
          "https://three.example",
        ],
      }),
    );
    expect(ctx.app.listen).toHaveBeenCalledWith("4010", "0.0.0.0");
  });
});
