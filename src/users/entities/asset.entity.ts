import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("asset")
export class Asset {
  @PrimaryGeneratedColumn("increment", { type: "bigint" })
  id: number;

  @Column({ type: "text" })
  name: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "text" })
  asset_type: string;

  @Column({ type: "text", nullable: true })
  category: string;

  @Column({ type: "text" })
  url: string;

  @Column({ type: "text" })
  public_id: string;

  @Column({ type: "text", nullable: true })
  thumbnail_url: string;

  @Column({ type: "int", nullable: true })
  rarity: number;

  @Column({ type: "jsonb", nullable: true })
  metadata: object;

  @Column({ type: "boolean", default: true })
  active: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
