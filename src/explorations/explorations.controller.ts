import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { ExplorationsService } from "./explorations.service";
import { CreateExplorationDto } from "./dto/create-exploration.dto";
import { ReturnExplorationDto } from "./dto/return-exploration.dto";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

@ApiTags("explorations")
@Controller("explorations")
export class ExplorationsController {
  constructor(private readonly explorationsService: ExplorationsService) {}

  @Post()
  @Roles("admin", "travel_manager", "camp_manager", "camp_leader")
  @ApiOperation({ summary: "Crear una nueva exploracion" })
  create(@Body() dto: CreateExplorationDto, @CurrentUser() user: any) {
    return this.explorationsService.create(dto, user?.id);
  }

  @Get()
  @Roles(
    "admin",
    "travel_manager",
    "resource_manager",
    "camp_leader",
    "camp_manager",
    "worker"
  )
  @ApiOperation({ summary: "Listar exploraciones con filtros opcionales" })
  findAll(@Query("campId") campId?: string, @Query("status") status?: string) {
    return this.explorationsService.findAll(
      campId ? +campId : undefined,
      status,
    );
  }

  @Get(":id")
  @Roles(
    "admin",
    "travel_manager",
    "resource_manager",
    "camp_leader",
    "camp_manager",
    "worker"
  )
  @ApiOperation({ summary: "Obtener detalle de una exploracion" })
  findById(@Param("id", ParseIntPipe) id: number) {
    return this.explorationsService.findById(id);
  }

  @Patch(":id/depart")
  @Roles("admin", "travel_manager", "camp_manager", "camp_leader")
  @ApiOperation({ summary: "Marcar exploracion como en curso (partida)" })
  depart(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.explorationsService.depart(id, user?.id);
  }

  @Patch(":id/return")
  @Roles("admin", "travel_manager", "camp_manager", "camp_leader")
  @ApiOperation({ summary: "Registrar retorno de exploracion" })
  registerReturn(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ReturnExplorationDto,
    @CurrentUser() user: any,
  ) {
    return this.explorationsService.registerReturn(id, dto, user?.id);
  }

  @Delete(":id")
  @Roles("admin", "travel_manager", "camp_manager", "camp_leader")
  @ApiOperation({ summary: "Cancelar una exploracion programada" })
  cancel(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.explorationsService.cancel(id, user?.id);
  }
}
