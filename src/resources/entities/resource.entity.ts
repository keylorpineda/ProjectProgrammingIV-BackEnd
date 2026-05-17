import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Inventory } from "./inventory.entity";
import { InventoryMovement } from "./inventory-movement.entity";

@Entity("resource")
export class Resource {
  @PrimaryGeneratedColumn("increment", { type: "bigint" })
  id: number;

  @Column({ type: "text" })
  name: string;

  @Column({ type: "text" })
  unit: string;

  @Column({ type: "text" })
  category: string;

  @Column({ type: "text", nullable: true })
  image_url: string;

  @Column({ type: "text", nullable: true })
  image_public_id: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @OneToMany(() => Inventory, (inv) => inv.resource)
  inventories: Inventory[];

  @OneToMany(() => InventoryMovement, (m) => m.resource)
  movements: InventoryMovement[];

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
