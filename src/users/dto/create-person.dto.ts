import { IsString, IsOptional, IsDateString, IsInt } from "class-validator";

export class CreatePersonDto {
  @IsOptional()
  @IsInt()
  profession_id?: number;

  @IsOptional()
  @IsInt()
  camp_id?: number;

  @IsString()
  first_name: string;

  @IsString()
  last_name: string;

  @IsOptional()
  @IsString()
  last_name2?: string;

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
  photo_url?: string;

  @IsOptional()
  @IsString()
  id_card_url?: string;
}
