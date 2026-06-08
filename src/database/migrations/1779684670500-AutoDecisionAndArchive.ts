import type { MigrationInterface, QueryRunner } from "typeorm";

export class AutoDecisionAndArchive1779684670500 implements MigrationInterface {
  name = "AutoDecisionAndArchive1779684670500";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_admission" ADD "is_auto_decision" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_admission" ADD "auto_decision_reason" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_admission" ADD "archived" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_admission" ADD "archived_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_admission" ADD "archived_by_user_id" bigint`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_admission" DROP COLUMN "archived_by_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_admission" DROP COLUMN "archived_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_admission" DROP COLUMN "archived"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_admission" DROP COLUMN "auto_decision_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_admission" DROP COLUMN "is_auto_decision"`,
    );
  }
}
