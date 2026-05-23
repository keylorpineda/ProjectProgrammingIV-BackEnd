import {
  Index,
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
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

  @Column({ type: "timestamptz", nullable: true })
  acquired_at: Date;

  @BeforeInsert()
  setAcquiredAt() {
    if (!this.acquired_at) {
      this.acquired_at = new Date();
    }
  }

  @Column({ type: "boolean", default: false })
  is_displayed: boolean;

  @Column({ type: "jsonb", nullable: true })
  context_data: object;

  @Index()
  @ManyToOne(() => UserAccount, (ua) => ua.userAssets)
  @JoinColumn({ name: "user_account_id" })
  userAccount: UserAccount;

  @Index()
  @ManyToOne(() => Asset)
  @JoinColumn({ name: "asset_id" })
  asset: Asset;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
