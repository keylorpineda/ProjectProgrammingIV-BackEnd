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
import { Person } from "../../users/entities/person.entity";
import { Profession } from "../../users/entities/profession.entity";
import { UserAccount } from "../../users/entities/user-account.entity";
import { Camp } from "../../camps/entities/camp.entity";

@Entity("ai_admission")
export class AiAdmission {
  @PrimaryGeneratedColumn("increment", { type: "bigint" })
  id: number;

  @Column({ type: "text", unique: true })
  tracking_code: string;

  @Column({ type: "bigint" })
  camp_id: number;

  @Column({ type: "bigint", nullable: true })
  person_id: number | null;

  @Column({ type: "jsonb" })
  candidate_data: object;

  @Column({ type: "int", nullable: true })
  score: number;

  @Column({ type: "text", default: "PENDING_REVIEW" })
  status: string;

  @Column({ type: "text", nullable: true })
  suggested_decision: string;

  @Column({ type: "bigint", nullable: true })
  suggested_profession_id: number | null;

  @Column({ type: "text", nullable: true })
  justification: string;

  @Column({ type: "jsonb", nullable: true })
  raw_ai_response: object;

  @Column({ type: "bigint", nullable: true })
  reviewed_by_user_id: number | null;

  @Column({ type: "text", nullable: true })
  final_human_decision: string;

  @Column({ type: "text", nullable: true })
  admin_notes: string;

  @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
  submission_date: Date;

  @Column({ type: "timestamptz", nullable: true })
  review_date: Date;

  @Index()
  @ManyToOne(() => Camp)
  @JoinColumn({ name: "camp_id" })
  camp: Camp;

  @Index()
  @ManyToOne(() => Person, (p) => p.aiAdmissions, { nullable: true })
  @JoinColumn({ name: "person_id" })
  person: Person;

  @Index()
  @ManyToOne(() => Profession, { nullable: true })
  @JoinColumn({ name: "suggested_profession_id" })
  suggestedProfession: Profession;

  @Index()
  @ManyToOne(() => UserAccount, { nullable: true })
  @JoinColumn({ name: "reviewed_by_user_id" })
  reviewedBy: UserAccount;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
