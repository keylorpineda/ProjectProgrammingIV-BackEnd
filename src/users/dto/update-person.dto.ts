import {
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  IsBoolean,
  IsArray,
} from "class-validator";

export class UpdatePersonDto {
  @IsOptional()
  @IsInt()
  profession_id?: number;

  @IsOptional()
  @IsString()
  first_name?: string;

  @IsOptional()
  @IsString()
  last_name?: string;

  @IsOptional()
  @IsDateString()
  birth_date?: string;

  @IsOptional()
  @IsString()
  previous_skills?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsBoolean()
  can_work?: boolean;

  @IsOptional()
  @IsInt()
  experience_level?: number;

  @IsOptional()
  @IsInt()
  expeditionsSurvived?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  achievements?: string[];

  @IsOptional()
  @IsString()
  photo_url?: string;

  @IsOptional()
  @IsString()
  id_card_url?: string;
}
