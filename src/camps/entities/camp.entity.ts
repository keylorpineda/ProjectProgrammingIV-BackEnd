import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";
import { UserAccount } from "../../users/entities/user-account.entity";

@Entity("camp")
export class Camp {
  @PrimaryGeneratedColumn("increment", { type: "bigint" })
  id: number;

  @Column({ type: "text" })
  name: string;

  @Column({ type: "text", nullable: true })
  location_description: string;

  @Column({ type: "decimal", precision: 10, scale: 7, nullable: true })
  latitude: number;

  @Column({ type: "decimal", precision: 10, scale: 7, nullable: true })
  longitude: number;

  @Column({ type: "int", nullable: true })
  max_capacity: number;

  @Index()
  @Column({ type: "boolean", default: true })
  active: boolean;

  @Column({ type: "date", nullable: true })
  foundation_date: Date;

  @Column({ type: "text", nullable: true })
  logo_url: string;

  @Column({ type: "text", nullable: true })
  logo_public_id: string;

  @Column({ type: "text", nullable: true })
  map_url: string;

  @Column({ type: "text", nullable: true })
  map_public_id: string;

  @OneToMany(() => UserAccount, (ua) => ua.camp)
  userAccounts: UserAccount[];

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
