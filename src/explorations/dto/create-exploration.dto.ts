import {
  IsString,
  IsInt,
  IsOptional,
  IsDateString,
  IsArray,
  IsBoolean,
  ValidateNested,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ExplorationPersonDto {
  @ApiProperty({
    example: 1,
    description: "ID de la persona que irá a la exploración",
  })
  @IsInt()
  person_id: number;

  @ApiPropertyOptional({
    example: true,
    description: "¿Es el líder de la exploración?",
  })
  @IsOptional()
  @IsBoolean()
  is_leader?: boolean;
}

export class ExplorationResourceDto {
  @ApiProperty({ example: 2, description: "ID del recurso (ej: 2 para Agua)" })
  @IsInt()
  resource_id: number;

  @ApiProperty({
    example: "out",
    description: "Flujo del recurso ('out' para salida)",
  })
  @IsString()
  flow: string;

  @ApiProperty({ example: 50, description: "Cantidad del recurso a llevar" })
  @IsInt()
  @Min(0)
  quantity: number;
}

export class CreateExplorationDto {
  @ApiProperty({ example: 1, description: "ID del campamento de origen" })
  @IsInt()
  camp_id: number;

  @ApiProperty({
    example: "Búsqueda de provisiones en el hospital",
    description: "Nombre de la misión",
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    example: "Hospital Central en la zona norte",
    description: "Descripción del destino",
  })
  @IsOptional()
  @IsString()
  destination_description?: string;

  @ApiProperty({
    example: "2025-06-15T08:00:00Z",
    description: "Fecha de salida",
  })
  @IsDateString()
  departure_date: string;

  @ApiProperty({ example: 3, description: "Días estimados de duración" })
  @IsInt()
  @Min(1)
  estimated_days: number;

  @ApiPropertyOptional({
    example: 1,
    description: "Días de gracia permitidos antes de declarar emergencia",
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  grace_days?: number;

  @ApiProperty({
    type: [ExplorationPersonDto],
    description: "Lista de personas asignadas",
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExplorationPersonDto)
  persons: ExplorationPersonDto[];

  @ApiPropertyOptional({
    type: [ExplorationResourceDto],
    description: "Recursos asignados para el viaje",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExplorationResourceDto)
  resources?: ExplorationResourceDto[];
}
