import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Person } from "./person.entity";
import { TemporaryAssignment } from "./temporary-assignment.entity";

@Entity("profession")
export class Profession {
  @PrimaryGeneratedColumn("increment", { type: "bigint" })
  id: number;

  @Column({ type: "text" })
  name: string;

  @Column({ type: "boolean", default: false })
  can_explore: boolean;

  @Column({ type: "int", default: 1 })
  minimum_active_required: number;

  @OneToMany(() => Person, (p) => p.profession)
  persons: Person[];

  @OneToMany(() => TemporaryAssignment, (ta) => ta.professionOrigin)
  originAssignments: TemporaryAssignment[];

  @OneToMany(() => TemporaryAssignment, (ta) => ta.professionTemporary)
  temporaryAssignments: TemporaryAssignment[];

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
