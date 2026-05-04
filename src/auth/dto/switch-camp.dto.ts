import { IsInt, Min } from "class-validator";

export class SwitchCampDto {
  @IsInt()
  @Min(1)
  camp_id: number;
}
