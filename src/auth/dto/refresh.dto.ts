import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class RefreshDto {
  @ApiProperty({
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6Ikp...",
    description: "El token de refresco (refresh token) obtenido en el login",
  })
  @IsString()
  refresh_token: string;
}
