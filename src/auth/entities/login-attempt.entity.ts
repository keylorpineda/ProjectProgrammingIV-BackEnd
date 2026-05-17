import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("login_attempt")
export class LoginAttempt {
  @PrimaryGeneratedColumn("increment", { type: "bigint" })
  id: number;

  @Column({ type: "text" })
  username: string;

  @Column({ type: "text" })
  ip_address: string;

  @Column({ type: "text", nullable: true })
  user_agent: string;

  @Column({ type: "boolean" })
  success: boolean;

  @Column({ type: "text", nullable: true })
  failure_reason: string;

  @Column({ type: "bigint", nullable: true })
  user_id: number;

  @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
  attempted_at: Date;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
