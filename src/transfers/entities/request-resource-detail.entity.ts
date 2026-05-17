import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { IntercampRequest } from "./intercamp-request.entity";
import { Resource } from "../../resources/entities/resource.entity";

@Entity("request_resource_detail")
export class RequestResourceDetail {
  @PrimaryColumn({ type: "bigint" })
  request_id: number;

  @PrimaryColumn({ type: "bigint" })
  resource_id: number;

  @Column({ type: "decimal", precision: 12, scale: 3 })
  requested_quantity: number;

  @Column({ type: "decimal", precision: 12, scale: 3, nullable: true })
  approved_quantity: number;

  @Column({ type: "decimal", precision: 12, scale: 3, nullable: true })
  received_quantity: number;

  @ManyToOne(() => IntercampRequest, (r) => r.resourceDetails)
  @JoinColumn({ name: "request_id" })
  request: IntercampRequest;

  @ManyToOne(() => Resource)
  @JoinColumn({ name: "resource_id" })
  resource: Resource;

  @CreateDateColumn({ type: "timestamptz" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;
}
