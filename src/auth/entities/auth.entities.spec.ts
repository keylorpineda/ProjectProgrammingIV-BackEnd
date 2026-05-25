import { getMetadataArgsStorage } from "typeorm";
import { Session } from "./session.entity";
import { LoginAttempt } from "./login-attempt.entity";
import { UserAccount } from "../../users/entities/user-account.entity";

describe("Auth entities", () => {
  it("should define Session properties and metadata", () => {
    const entity = new Session();
    const user = new UserAccount();
    const now = new Date("2026-03-23T00:00:00.000Z");

    entity.id = 1;
    entity.user_id = 10;
    entity.token_hash = "hash";
    entity.last_activity = now;
    entity.expires_at = now;
    entity.auto_logout = false;
    entity.is_active = true;
    entity.user = user;

    expect(entity).toEqual({
      id: 1,
      user_id: 10,
      token_hash: "hash",
      last_activity: now,
      expires_at: now,
      auto_logout: false,
      is_active: true,
      user,
    });

    const columns = getMetadataArgsStorage().columns.filter(
      (column) => column.target === Session,
    );
    const relations = getMetadataArgsStorage().relations.filter(
      (relation) => relation.target === Session,
    );

    const columnNames = columns.map((column) => column.propertyName);
    expect(columnNames).toEqual(
      expect.arrayContaining([
        "id",
        "user_id",
        "token_hash",
        "last_activity",
        "expires_at",
        "auto_logout",
        "is_active",
      ]),
    );

    expect(
      columns.find((column) => column.propertyName === "auto_logout")?.options
        .default,
    ).toBe(false);
    expect(
      columns.find((column) => column.propertyName === "is_active")?.options
        .default,
    ).toBe(true);
    expect(relations.map((relation) => relation.propertyName)).toContain(
      "user",
    );

    const userRelation = relations.find(
      (relation) => relation.propertyName === "user",
    );
    const relationType =
      typeof userRelation?.type === "function"
        ? (userRelation.type as () => unknown)()
        : userRelation?.type;
    const inverseProperty =
      typeof userRelation?.inverseSideProperty === "function"
        ? userRelation.inverseSideProperty({ sessions: "sessions" })
        : userRelation?.inverseSideProperty;

    expect(relationType).toBe(UserAccount);
    expect(inverseProperty).toBe("sessions");
  });

  it("should define LoginAttempt properties and metadata", () => {
    const entity = new LoginAttempt();
    const now = new Date("2026-03-23T00:00:00.000Z");

    entity.id = 3;
    entity.username = "user";
    entity.ip_address = "127.0.0.1";
    entity.user_agent = "Jest";
    entity.success = false;
    entity.failure_reason = "invalid credentials";
    entity.user_id = 7;
    entity.attempted_at = now;

    expect(entity).toEqual({
      id: 3,
      username: "user",
      ip_address: "127.0.0.1",
      user_agent: "Jest",
      success: false,
      failure_reason: "invalid credentials",
      user_id: 7,
      attempted_at: now,
    });

    const columns = getMetadataArgsStorage().columns.filter(
      (column) => column.target === LoginAttempt,
    );

    const nullableColumns = columns
      .filter((column) => column.options.nullable)
      .map((column) => column.propertyName);

    expect(nullableColumns).toEqual(
      expect.arrayContaining([
        "user_agent",
        "failure_reason",
        "user_id",
      ]),
    );

    const attemptedAtDefault = columns.find(
      (column) => column.propertyName === "attempted_at",
    )?.options.default;
    expect(typeof attemptedAtDefault).toBe("function");
    expect((attemptedAtDefault as () => string)()).toContain(
      "CURRENT_TIMESTAMP",
    );
  });
});
