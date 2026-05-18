import {
  Index,
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Exploration } from "./exploration.entity";
import { Resource } from "../../resources/entities/resource.entity";

@Entity("exploration_resource")
export class ExplorationResource {
  @PrimaryColumn({ type: "bigint" })
  exploration_id!: number;

  @PrimaryColumn({ type: "text" })
  flow!: string;

  @PrimaryColumn({ type: "bigint" })
  resource_id!: number;

  @Column({ type: "decimal", precision: 12, scale: 3 })
  quantity!: number;

  @Index()
  @ManyToOne(() => Exploration, (e) => e.explorationResources)
  @JoinColumn({ name: "exploration_id" })
  exploration!: Exploration;

  @Index()
  @ManyToOne(() => Resource)
  @JoinColumn({ name: "resource_id" })
  resource!: Resource;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
