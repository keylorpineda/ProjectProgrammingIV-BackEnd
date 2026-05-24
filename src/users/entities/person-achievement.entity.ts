import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";
import { Person } from "./person.entity";

@Entity("person_achievement")
export class PersonAchievement {
  @PrimaryGeneratedColumn("increment", { type: "bigint" })
  id: number;

  @Column({ type: "bigint" })
  person_id: number;

  @Column({ type: "text" })
  achievement_name: string;

  @Column({ type: "timestamptz", nullable: true })
  obtained_at: Date;

  @Index()
  @ManyToOne(() => Person, (person) => person.achievements, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "person_id" })
  person: Person;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
