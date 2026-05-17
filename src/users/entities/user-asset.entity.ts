import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { UserAccount } from "./user-account.entity";
import { Asset } from "./asset.entity";

@Entity("user_asset")
export class UserAsset {
  @PrimaryGeneratedColumn("increment", { type: "bigint" })
  id: number;

  @Column({ type: "bigint" })
  user_account_id: number;

  @Column({ type: "bigint" })
  asset_id: number;

  @Column({ type: "text", nullable: true })
  relation_type: string;

  @CreateDateColumn({ type: "timestamptz" })
  acquired_at: Date;

  @Column({ type: "boolean", default: false })
  is_displayed: boolean;

  @Column({ type: "json", nullable: true })
  context_data: object;

  @ManyToOne(() => UserAccount, (ua) => ua.userAssets)
  @JoinColumn({ name: "user_account_id" })
  userAccount: UserAccount;

  @ManyToOne(() => Asset)
  @JoinColumn({ name: "asset_id" })
  asset: Asset;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
