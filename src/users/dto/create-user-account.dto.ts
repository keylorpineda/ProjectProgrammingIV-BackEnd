import {
  IsString,
  IsInt,
  IsOptional,
  IsEmail,
  MinLength,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateUserAccountDto {
  @ApiProperty({ example: 1, description: "ID del campamento asociado" })
  @IsInt()
  camp_id: number;

  @ApiProperty({ example: 5, description: "ID de la persona física" })
  @IsInt()
  person_id: number;

  @ApiProperty({
    example: "medico_juan",
    description: "Nombre de usuario para el login",
  })
  @IsString()
  username: string;

  @ApiProperty({
    example: "juan@campamento.local",
    description: "Correo electrónico del usuario",
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: "SuperSeguro123!",
    description: "Contraseña segura (mín. 8 caracteres)",
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({
    example: 2,
    description: "ID del rol (Ej: 2 = Doctor)",
  })
  @IsOptional()
  @IsInt()
  role_id?: number;
}
