import {
  Index,
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { UserAccount } from "../../users/entities/user-account.entity";

@Entity("session")
export class Session {
  @PrimaryGeneratedColumn("increment", { type: "bigint" })
  id: number;

  @Column({ type: "bigint" })
  user_id: number;

  @Column({ type: "text" })
  token_hash: string;

  @Column({ type: "timestamptz" })
  last_activity: Date;

  @Column({ type: "timestamptz" })
  expires_at: Date;

  @Column({ type: "boolean", default: false })
  auto_logout: boolean;

  @Column({ type: "boolean", default: true })
  is_active: boolean;

  @Index()
  @ManyToOne(() => UserAccount, (ua) => ua.sessions)
  @JoinColumn({ name: "user_id" })
  user: UserAccount;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
