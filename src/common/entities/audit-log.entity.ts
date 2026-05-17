import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { UserAccount } from "../../users/entities/user-account.entity";
import { Camp } from "../../camps/entities/camp.entity";

@Entity("audit_log")
export class AuditLog {
  @PrimaryGeneratedColumn("increment", { type: "bigint" })
  id: number;

  @Column({ type: "bigint", nullable: true })
  user_id: number;

  @Column({ type: "bigint", nullable: true })
  camp_id: number;

  @Column({ type: "text" })
  action: string;

  @Column({ type: "text" })
  entity_type: string;

  @Column({ type: "bigint", nullable: true })
  entity_id: number;

  @Column({ type: "json", nullable: true })
  old_value: object;

  @Column({ type: "json", nullable: true })
  new_value: object;

  @Column({ type: "timestamptz" })
  date: Date;

  @ManyToOne(() => UserAccount)
  @JoinColumn({ name: "user_id" })
  user: UserAccount;

  @ManyToOne(() => Camp)
  @JoinColumn({ name: "camp_id" })
  camp: Camp;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
