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
import { IntercampRequest } from "./intercamp-request.entity";

@Entity("approval")
export class Approval {
  @PrimaryGeneratedColumn("increment", { type: "bigint" })
  id: number;

  @Column({ type: "bigint" })
  user_id: number;

  @Column({ type: "text" })
  entity_type: string;

  @Column({ type: "bigint" })
  entity_id: number;

  @Column({ type: "timestamptz" })
  approval_date: Date;

  @Column({ type: "text" })
  status: string;

  @Index()
  @ManyToOne(() => UserAccount)
  @JoinColumn({ name: "user_id" })
  user: UserAccount;

  @Index()
  @ManyToOne(() => IntercampRequest, (r) => r.approvals, { nullable: true })
  @JoinColumn({ name: "entity_id" })
  intercampRequest: IntercampRequest;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
