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
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { ResourcesService } from "./resources.service";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { CreateResourceDto } from "./dto/create-resource.dto";
import { UpdateResourceDto } from "./dto/update-resource.dto";
import { CreateInventoryMovementDto } from "./dto/create-inventory-movement.dto";
import { AdjustDailyProductionDto } from "./dto/adjust-daily-production.dto";
import { UpdateInventoryDto } from "./dto/update-inventory.dto";

@ApiTags("Resources")
@ApiBearerAuth()
@Controller("resources")
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Get("inventory/:campId")
  @Roles(
    "admin",
    "resource_manager",
    "worker",
    "travel_manager",
    "camp_manager",
  )
  @ApiOperation({ summary: "Consultar inventario completo del campamento" })
  async getInventory(@Param("campId", ParseIntPipe) campId: number) {
    return this.resourcesService.getInventoryByCamp(campId);
  }

  @Get("inventory/:campId/alerts")
  @Roles(
    "admin",
    "resource_manager",
    "camp_leader",
    "travel_manager",
    "camp_manager",
  )
  @ApiOperation({ summary: "Alertas de recursos por debajo del m�nimo" })
  async getAlerts(@Param("campId", ParseIntPipe) campId: number) {
    return this.resourcesService.getInventoryAlerts(campId);
  }

  @Patch("inventory/:campId/:resourceId")
  @Roles("admin", "resource_manager", "travel_manager", "camp_manager")
  @ApiOperation({
    summary:
      "Actualizar configuracion de inventario (minimo requerido, cantidad)",
  })
  async updateInventory(
    @Param("campId", ParseIntPipe) campId: number,
    @Param("resourceId", ParseIntPipe) resourceId: number,
    @Body() dto: UpdateInventoryDto,
  ) {
    return this.resourcesService.updateInventory(campId, resourceId, dto);
  }

  @Post("inventory/initialize/:campId")
  @Roles("admin", "travel_manager", "camp_manager")
  @ApiOperation({
    summary: "Inicializar inventario para un campamento con todos los recursos",
  })
  async initializeInventory(@Param("campId", ParseIntPipe) campId: number) {
    return this.resourcesService.initializeInventoryForCamp(campId);
  }

  @Get("movements/:campId")
  @Roles(
    "admin",
    "resource_manager",
    "worker",
    "travel_manager",
    "camp_manager",
  )
  @ApiOperation({
    summary: "Historial de movimientos de inventario del campamento",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Maximo de registros (default 50)",
  })
  async getMovements(
    @Param("campId", ParseIntPipe) campId: number,
    @Query("limit") limit?: string,
  ) {
    return this.resourcesService.getMovementsByCamp(
      campId,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Post("movements")
  @Roles(
    "admin",
    "resource_manager",
    "worker",
    "travel_manager",
    "camp_manager",
  )
  @ApiOperation({
    summary: "Registrar movimiento de inventario (ingreso/egreso)",
  })
  async createMovement(
    @Body() dto: CreateInventoryMovementDto,
    @CurrentUser() user: any,
  ) {
    return this.resourcesService.createMovement(dto, user?.userId);
  }

  @Post("daily-process/:campId")
  @Roles(
    "admin",
    "resource_manager",
    "camp_leader",
    "travel_manager",
    "camp_manager",
  )
  @ApiOperation({
    summary: "Ejecutar proceso diario manualmente (produccion + consumo)",
  })
  async triggerDailyProcess(@Param("campId", ParseIntPipe) campId: number) {
    return this.resourcesService.executeDailyProcess(campId);
  }

  @Post("daily-production/:personId")
  @Roles(
    "admin",
    "resource_manager",
    "worker",
    "travel_manager",
    "camp_manager",
  )
  @ApiOperation({
    summary: "Ajustar produccion diaria de una persona manualmente",
  })
  async adjustDailyProduction(
    @Param("personId", ParseIntPipe) personId: number,
    @Body() dto: AdjustDailyProductionDto,
    @CurrentUser() user: any,
  ) {
    return this.resourcesService.adjustProductionForPerson(
      personId,
      dto,
      user?.userId,
    );
  }

  @Get()
  @Roles(
    "admin",
    "resource_manager",
    "worker",
    "travel_manager",
    "camp_manager",
  )
  @ApiOperation({ summary: "Listar todos los recursos disponibles" })
  @ApiQuery({
    name: "page",
    required: false,
    description: "Pagina (default 1)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Elementos por pagina (default 20)",
  })
  @ApiQuery({
    name: "category",
    required: false,
    description: "Filtrar por categoria (opcional)",
  })
  async findAll(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("category") category?: string,
  ) {
    return this.resourcesService.findAll(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      category,
    );
  }

  @Get(":id")
  @Roles(
    "admin",
    "resource_manager",
    "worker",
    "travel_manager",
    "camp_manager",
  )
  @ApiOperation({ summary: "Obtener un recurso por ID" })
  async findById(@Param("id", ParseIntPipe) id: number) {
    return this.resourcesService.findResourceById(id);
  }

  @Post()
  @Roles("admin", "resource_manager", "travel_manager", "camp_manager")
  @ApiOperation({ summary: "Crear un nuevo recurso" })
  async create(@Body() dto: CreateResourceDto) {
    return this.resourcesService.create(dto);
  }

  @Patch(":id")
  @Roles("admin", "resource_manager", "travel_manager", "camp_manager")
  @ApiOperation({ summary: "Actualizar un recurso" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateResourceDto,
  ) {
    return this.resourcesService.update(id, dto);
  }

  @Delete(":id")
  @Roles("admin", "travel_manager", "camp_manager")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Eliminar un recurso" })
  async remove(@Param("id", ParseIntPipe) id: number) {
    await this.resourcesService.remove(id);
  }
}
