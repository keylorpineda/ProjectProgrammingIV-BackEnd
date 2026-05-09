import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToOne,
  OneToMany,
} from "typeorm";
import { Profession } from "./profession.entity";
import { UserAccount } from "./user-account.entity";
import { AiAdmission } from "../../ai/entities/ai-admission.entity";

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
  expeditionsSurvived: number;

  @Column({ type: "text", array: true, default: () => "'{}'" })
  achievements: string[];

  @Column({ type: "text", nullable: true })
  photo_url: string;

  @Column({ type: "text", nullable: true })
  id_card_url: string;

  @Column({ type: "text", nullable: true })
  previous_skills: string;

  @Column({ type: "json", nullable: true })
  ai_admission_result: object;

  @Column({ type: "text", nullable: true })
  notes: string;

  @ManyToOne(() => Profession, (p) => p.persons)
  @JoinColumn({ name: "profession_id" })
  profession: Profession;

  @OneToOne(() => UserAccount, (ua) => ua.person)
  userAccount: UserAccount;

  @OneToMany(() => AiAdmission, (ai) => ai.person)
  aiAdmissions: AiAdmission[];
}
