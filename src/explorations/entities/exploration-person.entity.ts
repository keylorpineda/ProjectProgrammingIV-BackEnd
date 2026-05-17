import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Exploration } from "./exploration.entity";
import { Person } from "../../users/entities/person.entity";

@Entity("exploration_person")
export class ExplorationPerson {
  @PrimaryColumn({ type: "bigint" })
  exploration_id!: number;

  @PrimaryColumn({ type: "bigint" })
  person_id!: number;

  @Column({ type: "boolean", default: false })
  is_leader!: boolean;

  @Column({ type: "boolean", default: false })
  return_confirmed!: boolean;

  @ManyToOne(() => Exploration, (e) => e.explorationPersons)
  @JoinColumn({ name: "exploration_id" })
  exploration!: Exploration;

  @ManyToOne(() => Person)
  @JoinColumn({ name: "person_id" })
  person!: Person;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
