import { IsString, IsOptional } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateResourceDto {
  @ApiProperty({ example: "Vendas", description: "Nombre del recurso" })
  @IsString()
  name: string;

  @ApiProperty({
    example: "Unidades",
    description: "Unidad de medida (ej: Kilos, Litros, Unidades)",
  })
  @IsString()
  unit: string;

  @ApiProperty({
    example: "Médico",
    description: "Categoría del recurso (ej: Médico, Alimento, Arma)",
  })
  @IsString()
  category: string;

  @ApiPropertyOptional({
    example: "Vendas esterilizadas para primeros auxilios",
    description: "Descripción detallada del recurso",
  })
  @IsOptional()
  @IsString()
  description?: string;
}
