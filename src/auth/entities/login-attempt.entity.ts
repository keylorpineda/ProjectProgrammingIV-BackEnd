import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { UserAccount } from "../../users/entities/user-account.entity";

@Entity("login_attempt")
export class LoginAttempt {
  @PrimaryGeneratedColumn("increment", { type: "bigint" })
  id: number;

  @Column({ type: "text" })
  username: string;

  @Index()
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

  @Index()
  @ManyToOne(() => UserAccount, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "user_id" })
  user: UserAccount;

  @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
  attempted_at: Date;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
