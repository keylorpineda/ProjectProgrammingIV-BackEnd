import {
  Index,
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Camp } from "../../camps/entities/camp.entity";
import { Person } from "./person.entity";
import { Role } from "./role.entity";
import { Session } from "../../auth/entities/session.entity";
import { TemporaryAssignment } from "./temporary-assignment.entity";
import { UserAsset } from "./user-asset.entity";

@Entity("user_account")
export class UserAccount {
  @PrimaryGeneratedColumn("increment", { type: "bigint" })
  id: number;

  @Column({ type: "bigint", nullable: true })
  camp_id: number;

  @Column({ type: "bigint", nullable: true })
  person_id: number;

  @Column({ type: "bigint", nullable: true })
  role_id: number;

  @Column({ type: "text", unique: true })
  username: string;

  @Column({ type: "text", unique: true })
  email: string;

  // `select: false` keeps this column out of every default response (see
  // docs/ALIGNMENT_SPEC.md P2-1). Auth flows that need the hash for bcrypt
  // comparison must opt-in via QueryBuilder + addSelect("u.password_hash").
  @Column({ type: "text", select: false })
  password_hash: string;

  @Column({ type: "timestamptz", nullable: true })
  last_access: Date;

  @Column({ type: "text", nullable: true })
  avatar_url: string;

  @Column({ type: "text", nullable: true })
  avatar_public_id: string;

  @Index()
  @ManyToOne(() => Camp, (c) => c.userAccounts)
  @JoinColumn({ name: "camp_id" })
  camp: Camp;

  @OneToOne(() => Person, (p) => p.userAccount)
  @JoinColumn({ name: "person_id" })
  person: Person;

  @Index()
  @ManyToOne(() => Role)
  @JoinColumn({ name: "role_id" })
  role: Role;

  @OneToMany(() => Session, (s) => s.user)
  sessions: Session[];

  @OneToMany(() => TemporaryAssignment, (ta) => ta.userApprove)
  approvedAssignments: TemporaryAssignment[];

  @OneToMany(() => UserAsset, (ua) => ua.userAccount)
  userAssets: UserAsset[];

  @Column({ type: "text", default: "ACTIVE" })
  status: string;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
