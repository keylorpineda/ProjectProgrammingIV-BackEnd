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
import { Profession } from "../../users/entities/profession.entity";
import { Resource } from "./resource.entity";

@Entity("daily_production")
@Unique(["camp_id", "profession_id", "resource_id"])
export class DailyProduction {
  @PrimaryGeneratedColumn("increment", { type: "bigint" })
  id!: number;

  @Column({ type: "bigint" })
  camp_id!: number;

  @Column({ type: "bigint" })
  profession_id!: number;

  @Column({ type: "bigint" })
  resource_id!: number;

  @Column({ type: "decimal", precision: 12, scale: 3, default: 0 })
  base_production!: number;

  @Index()
  @ManyToOne(() => Camp)
  @JoinColumn({ name: "camp_id" })
  camp!: Camp;

  @Index()
  @ManyToOne(() => Profession)
  @JoinColumn({ name: "profession_id" })
  profession!: Profession;

  @Index()
  @ManyToOne(() => Resource)
  @JoinColumn({ name: "resource_id" })
  resource!: Resource;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
