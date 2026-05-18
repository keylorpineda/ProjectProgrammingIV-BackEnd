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
import { Camp } from "../../camps/entities/camp.entity";
import { Resource } from "./resource.entity";

@Entity("inventory")
export class Inventory {
  @PrimaryColumn({ type: "bigint" })
  camp_id: number;

  @PrimaryColumn({ type: "bigint" })
  resource_id: number;

  @Column({ type: "decimal", precision: 12, scale: 3, default: 0 })
  current_quantity: number;

  @Column({ type: "decimal", precision: 12, scale: 3, default: 0 })
  minimum_stock_required: number;

  @Column({ type: "boolean", default: false })
  alert_active: boolean;

  @Column({ type: "timestamptz", nullable: true })
  last_update: Date;

  @Index()
  @ManyToOne(() => Camp)
  @JoinColumn({ name: "camp_id" })
  camp: Camp;

  @Index()
  @ManyToOne(() => Resource, (r) => r.inventories)
  @JoinColumn({ name: "resource_id" })
  resource: Resource;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
