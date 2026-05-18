import {
  Index,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Camp } from "../../camps/entities/camp.entity";
import { Person } from "../../users/entities/person.entity";
import { Resource } from "./resource.entity";

@Entity("daily_consumption")
@Unique(["camp_id", "person_id", "resource_id"])
export class DailyConsumption {
  @PrimaryGeneratedColumn("increment", { type: "bigint" })
  id!: number;

  @Column({ type: "bigint" })
  camp_id!: number;

  @Column({ type: "bigint", nullable: true })
  person_id!: number | null;

  @Column({ type: "bigint" })
  resource_id!: number;

  @Column({ type: "decimal", precision: 12, scale: 3, default: 0 })
  daily_ration!: number;

  @Index()
  @ManyToOne(() => Camp)
  @JoinColumn({ name: "camp_id" })
  camp!: Camp;

  @Index()
  @ManyToOne(() => Person)
  @JoinColumn({ name: "person_id" })
  person!: Person;

  @Index()
  @ManyToOne(() => Resource)
  @JoinColumn({ name: "resource_id" })
  resource!: Resource;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
