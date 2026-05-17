import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Resource } from "./resource.entity";
import { UserAccount } from "../../users/entities/user-account.entity";
import { Camp } from "../../camps/entities/camp.entity";

@Entity("inventory_movement")
export class InventoryMovement {
  @PrimaryGeneratedColumn("increment", { type: "bigint" })
  id: number;

  @Column({ type: "bigint" })
  resource_id: number;

  @Column({ type: "bigint" })
  camp_id: number;

  @Column({ type: "decimal", precision: 12, scale: 3 })
  quantity: number;

  @Column({ type: "text" })
  type: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "timestamptz" })
  date: Date;

  @Column({ type: "bigint", nullable: true })
  user_id: number;

  @ManyToOne(() => Resource, (r) => r.movements)
  @JoinColumn({ name: "resource_id" })
  resource: Resource;

  @ManyToOne(() => UserAccount)
  @JoinColumn({ name: "user_id" })
  user: UserAccount;

  @ManyToOne(() => Camp)
  @JoinColumn({ name: "camp_id" })
  camp: Camp;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
