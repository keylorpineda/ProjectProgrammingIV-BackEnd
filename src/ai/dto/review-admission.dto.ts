import { IsEnum, IsOptional, IsString, IsInt } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export enum AdmissionDecision {
  ACCEPTED = "accepted",
  REJECTED = "rejected",
}

export class ReviewAdmissionDto {
  @ApiProperty({ enum: AdmissionDecision, example: AdmissionDecision.ACCEPTED })
  @IsEnum(AdmissionDecision)
  decision: AdmissionDecision;

  @ApiPropertyOptional({ example: "Approved - Camp needs medics" })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    example: 5,
    description: "Override suggested profession",
  })
  @IsOptional()
  @IsInt()
  override_profession_id?: number;
}
