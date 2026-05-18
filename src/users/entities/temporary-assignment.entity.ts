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
import { UserAccount } from "./user-account.entity";
import { Profession } from "./profession.entity";

@Entity("temporary_assignment")
export class TemporaryAssignment {
  @PrimaryGeneratedColumn("increment", { type: "bigint" })
  id: number;

  @Column({ type: "bigint" })
  user_account_id: number;

  @Column({ type: "bigint" })
  profession_origin_id: number;

  @Column({ type: "bigint" })
  profession_temporary_id: number;

  @Column({ type: "timestamptz" })
  start_date: Date;

  @Column({ type: "timestamptz", nullable: true })
  end_date: Date;

  @Column({ type: "text", nullable: true })
  reason: string;

  @Column({ type: "bigint", nullable: true })
  user_approve_id: number;

  @Index()
  @ManyToOne(() => UserAccount, (ua) => ua.approvedAssignments)
  @JoinColumn({ name: "user_account_id" })
  userAccount: UserAccount;

  @Index()
  @ManyToOne(() => Profession, (p) => p.originAssignments)
  @JoinColumn({ name: "profession_origin_id" })
  professionOrigin: Profession;

  @Index()
  @ManyToOne(() => Profession, (p) => p.temporaryAssignments)
  @JoinColumn({ name: "profession_temporary_id" })
  professionTemporary: Profession;

  @Index()
  @ManyToOne(() => UserAccount)
  @JoinColumn({ name: "user_approve_id" })
  userApprove: UserAccount;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
