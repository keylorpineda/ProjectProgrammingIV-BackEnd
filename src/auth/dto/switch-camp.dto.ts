import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Min } from "class-validator";

export class SwitchCampDto {
  @ApiProperty({
    example: 2,
    description:
      "El ID del campamento al que el usuario desea cambiarse (debe tener acceso)",
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  camp_id: number;
}
