import {
  Index,
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Camp } from "../../camps/entities/camp.entity";
import { RequestResourceDetail } from "./request-resource-detail.entity";
import { RequestPersonDetail } from "./request-person-detail.entity";
import { Approval } from "./approval.entity";

@Entity("intercamp_request")
export class IntercampRequest {
  @PrimaryGeneratedColumn("increment", { type: "bigint" })
  id: number;

  @Column({ type: "bigint" })
  camp_origin_id: number;

  @Column({ type: "bigint" })
  camp_destination_id: number;

  @Column({ type: "text" })
  type: string;

  @Column({ type: "text", default: "pending" })
  status: string;

  @Column({ type: "timestamptz" })
  request_date: Date;

  @Column({ type: "text", nullable: true })
  notes: string;

  @Column({ type: "int", nullable: true })
  travel_days: number;

  @Column({ type: "timestamptz", nullable: true })
  departure_date: Date;

  @Column({ type: "timestamptz", nullable: true })
  arrival_date: Date;

  @Index()
  @ManyToOne(() => Camp)
  @JoinColumn({ name: "camp_origin_id" })
  campOrigin: Camp;

  @Index()
  @ManyToOne(() => Camp)
  @JoinColumn({ name: "camp_destination_id" })
  campDestination: Camp;

  @OneToMany(() => RequestResourceDetail, (d) => d.request)
  resourceDetails: RequestResourceDetail[];

  @OneToMany(() => RequestPersonDetail, (d) => d.request)
  personDetails: RequestPersonDetail[];

  @OneToMany(() => Approval, (a) => a.intercampRequest)
  approvals: Approval[];

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
