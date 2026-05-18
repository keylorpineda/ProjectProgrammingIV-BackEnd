import {
  Index,
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Profession } from "./profession.entity";
import { UserAccount } from "./user-account.entity";
import { AiAdmission } from "../../ai/entities/ai-admission.entity";
import { PersonAchievement } from "./person-achievement.entity";

@Entity("person")
export class Person {
  @PrimaryGeneratedColumn("increment", { type: "bigint" })
  id: number;

  @Column({ type: "bigint", nullable: true })
  profession_id: number;

  @Column({ type: "text" })
  first_name: string;

  @Column({ type: "text" })
  last_name: string;

  @Column({ type: "text", nullable: true })
  last_name2: string;

  @Column({ type: "date", nullable: true })
  birth_date: Date;

  @Column({ type: "timestamptz", nullable: true })
  join_date: Date;

  @Column({ type: "text", nullable: true })
  identification_code: string;

  @Column({ type: "text", nullable: true })
  status: string;

  @Column({ type: "boolean", default: true })
  can_work: boolean;

  @Column({ type: "int", default: 1 })
  experience_level: number;

  @Column({ type: "int", default: 0 })
  experience_points: number;

  @Column({ name: "expeditions_survived", type: "int", default: 0 })
  expeditionsSurvived: number;

  @OneToMany(() => PersonAchievement, (pa) => pa.person, { cascade: true })
  achievements: PersonAchievement[];

  @Column({ type: "text", nullable: true })
  photo_url: string;

  @Column({ type: "text", nullable: true })
  id_card_url: string;

  @Column({ type: "text", nullable: true })
  previous_skills: string;

  @Column({ type: "jsonb", nullable: true })
  ai_admission_result: object;

  @Column({ type: "text", nullable: true })
  notes: string;

  @Index()
  @ManyToOne(() => Profession, (p) => p.persons)
  @JoinColumn({ name: "profession_id" })
  profession: Profession;

  @OneToOne(() => UserAccount, (ua) => ua.person)
  userAccount: UserAccount;

  @OneToMany(() => AiAdmission, (ai) => ai.person)
  aiAdmissions: AiAdmission[];

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
