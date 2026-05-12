import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class LoginDto {
  @ApiProperty({
    example: "admin",
    description: "El nombre de usuario registrado en el sistema",
  })
  @IsString()
  username: string;

  @ApiProperty({
    example: "Admin@1234!",
    description: "La contraseña del usuario",
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string;
}
