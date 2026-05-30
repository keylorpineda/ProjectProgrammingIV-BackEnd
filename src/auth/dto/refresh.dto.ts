import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class RefreshDto {
  @ApiPropertyOptional({
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6Ikp...",
    description: "Refresh token (legacy — now read from HttpOnly cookie)",
  })
  @IsOptional()
  @IsString()
  refresh_token?: string;
}
