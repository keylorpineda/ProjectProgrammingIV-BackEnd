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
import { IntercampRequest } from "./intercamp-request.entity";
import { Person } from "../../users/entities/person.entity";

@Entity("request_person_detail")
export class RequestPersonDetail {
  @PrimaryColumn({ type: "bigint" })
  request_id: number;

  @PrimaryColumn({ type: "bigint" })
  person_id: number;

  @Column({ type: "boolean", default: false })
  is_leader: boolean;

  @Column({ type: "text", default: "pending" })
  transfer_status: string;

  @Index()
  @ManyToOne(() => IntercampRequest, (r) => r.personDetails)
  @JoinColumn({ name: "request_id" })
  request: IntercampRequest;

  @Index()
  @ManyToOne(() => Person)
  @JoinColumn({ name: "person_id" })
  person: Person;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
