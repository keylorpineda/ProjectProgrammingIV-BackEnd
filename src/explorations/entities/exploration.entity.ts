import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Camp } from "../../camps/entities/camp.entity";
import { UserAccount } from "../../users/entities/user-account.entity";
import { ExplorationPerson } from "./exploration-person.entity";
import { ExplorationResource } from "./exploration-resource.entity";

@Entity("exploration")
export class Exploration {
  @PrimaryGeneratedColumn("increment", { type: "bigint" })
  id!: number;

  @Column({ type: "bigint" })
  camp_id!: number;

  @Column({ type: "text" })
  name!: string;

  @Column({ type: "text", nullable: true })
  destination_description!: string;

  @Column({ type: "timestamptz" })
  departure_date!: Date;

  @Column({ type: "int" })
  estimated_days!: number;

  @Column({ type: "int", default: 0 })
  grace_days!: number;

  @Column({ type: "timestamptz", nullable: true })
  real_return_date!: Date;

  @Column({ type: "text", default: "scheduled" })
  status!: string;

  @Column({ type: "text", nullable: true })
  notes!: string;

  @Column({ type: "bigint", nullable: true })
  user_create_id!: number;

  @ManyToOne(() => Camp)
  @JoinColumn({ name: "camp_id" })
  camp!: Camp;

  @ManyToOne(() => UserAccount)
  @JoinColumn({ name: "user_create_id" })
  userCreate!: UserAccount;

  @OneToMany(() => ExplorationPerson, (ep) => ep.exploration)
  explorationPersons!: ExplorationPerson[];

  @OneToMany(() => ExplorationResource, (er) => er.exploration)
  explorationResources!: ExplorationResource[];

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
