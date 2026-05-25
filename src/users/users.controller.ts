import {
  Controller,
  Get,
  Post,
  Put,
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
import { UsersService } from "./users.service";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { CreatePersonDto } from "./dto/create-person.dto";
import { UpdatePersonDto } from "./dto/update-person.dto";
import { UpdatePersonStatusDto } from "./dto/update-person-status.dto";
import { CreateTemporaryAssignmentDto } from "./dto/create-temporary-assignment.dto";
import { CreateProfessionDto } from "./dto/create-profession.dto";

@ApiTags("Users & Persons")
@ApiBearerAuth()
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("persons")
  @Roles("admin", "resource_manager", "travel_manager", "camp_leader")
  @ApiOperation({ summary: "Obtener todas las personas del campamento" })
  @ApiQuery({
    name: "campId",
    required: false,
    description: "Filtrar por campamento",
  })
  @ApiQuery({
    name: "page",
    required: false,
    description: "Pagina (default 1)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Resultados por pagina (default 20)",
  })
  @ApiQuery({
    name: "search",
    required: false,
    description: "Buscar por nombre o codigo",
  })
  async getAllPersons(
    @Query("campId") campId?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("search") search?: string,
  ) {
    return this.usersService.findAllPersons(
      campId ? parseInt(campId) : undefined,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      search,
    );
  }

  @Get("persons/:id")
  @Roles("admin", "resource_manager", "travel_manager", "worker", "camp_leader")
  @ApiOperation({ summary: "Obtener una persona por ID" })
  async getPersonById(@Param("id", ParseIntPipe) id: number) {
    return this.usersService.findPersonById(id);
  }

  @Post("persons")
  @Roles("admin", "camp_leader")
  @ApiOperation({ summary: "Crear una nueva persona (despues de admision)" })
  async createPerson(@Body() dto: CreatePersonDto) {
    return this.usersService.createPerson(dto);
  }

  @Put("persons/:id")
  @Roles("admin", "resource_manager", "camp_leader")
  @ApiOperation({ summary: "Actualizar informacion de una persona" })
  async updatePerson(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdatePersonDto,
  ) {
    return this.usersService.updatePerson(id, dto);
  }

  @Put("persons/:id/status")
  @Roles("admin", "resource_manager", "camp_leader")
  @ApiOperation({
    summary: "Cambiar estado de una persona (enfermo, herido, etc.)",
  })
  async updatePersonStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdatePersonStatusDto,
  ) {
    return this.usersService.updatePersonStatus(id, dto);
  }

  @Delete("persons/:id")
  @Roles("admin")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Eliminar una persona" })
  async deletePerson(@Param("id", ParseIntPipe) id: number) {
    await this.usersService.deletePerson(id);
  }

  @Get("persons/stats/by-status")
  @Roles("admin", "resource_manager", "camp_leader")
  @ApiOperation({ summary: "Estadisticas de personas por estado" })
  @ApiQuery({
    name: "campId",
    required: false,
    description: "Filtrar por campamento",
  })
  async getPersonStatsByStatus(@Query("campId") campId?: string) {
    return this.usersService.getPersonStatsByStatus(
      campId ? parseInt(campId) : undefined,
    );
  }

  @Get("persons/stats/by-profession")
  @Roles("admin", "resource_manager", "camp_leader")
  @ApiOperation({ summary: "Estadisticas de personas por profesi�n" })
  @ApiQuery({
    name: "campId",
    required: false,
    description: "Filtrar por campamento",
  })
  async getPersonStatsByProfession(@Query("campId") campId?: string) {
    return this.usersService.getPersonStatsByProfession(
      campId ? parseInt(campId) : undefined,
    );
  }

  @Get("professions")
  @ApiOperation({ summary: "Obtener todas las profesiones" })
  async getAllProfessions() {
    return this.usersService.findAllProfessions();
  }

  @Get("professions/:id")
  @ApiOperation({ summary: "Obtener una profesion por ID" })
  async getProfessionById(@Param("id", ParseIntPipe) id: number) {
    return this.usersService.findProfessionById(id);
  }

  @Post("professions")
  @Roles("admin")
  @ApiOperation({ summary: "Crear una nueva profesion" })
  async createProfession(@Body() dto: CreateProfessionDto) {
    return this.usersService.createProfession(dto);
  }

  @Get("professions/alerts/needing-workers")
  @Roles("admin", "resource_manager", "camp_leader")
  @ApiOperation({
    summary: "Obtener profesiones que necesitan trabajadores urgentemente",
  })
  async getProfessionsNeedingWorkers() {
    return this.usersService.getProfessionsNeedingWorkers();
  }

  @Get("professions/alerts/with-excess")
  @Roles("admin", "resource_manager", "camp_leader")
  @ApiOperation({ summary: "Obtener profesiones con exceso de trabajadores" })
  async getProfessionsWithExcess() {
    return this.usersService.getProfessionsWithExcess();
  }

  @Post("temporary-assignments")
  @Roles("admin", "resource_manager", "camp_leader")
  @ApiOperation({
    summary: "Crear asignacion temporal (debe ser aprobada despu�s)",
  })
  async createTemporaryAssignment(
    @Body() dto: CreateTemporaryAssignmentDto,
    @CurrentUser() user: any,
  ) {
    return this.usersService.createTemporaryAssignment(dto, user.id);
  }

  @Get("temporary-assignments")
  @Roles("admin", "resource_manager", "camp_leader")
  @ApiOperation({ summary: "Obtener asignaciones temporales activas" })
  @ApiQuery({
    name: "campId",
    required: false,
    description: "Filtrar por campamento",
  })
  async getActiveTemporaryAssignments(@Query("campId") campId?: string) {
    return this.usersService.getActiveTemporaryAssignments(
      campId ? parseInt(campId) : undefined,
    );
  }

  @Put("temporary-assignments/:id/end")
  @Roles("admin", "resource_manager")
  @ApiOperation({
    summary: "Finalizar asignacion temporal (devolver a profesion original)",
  })
  async endTemporaryAssignment(@Param("id", ParseIntPipe) id: number) {
    return this.usersService.endTemporaryAssignment(id);
  }

  @Get("camp/:campId/production")
  @Roles("admin", "resource_manager", "camp_leader")
  @ApiOperation({ summary: "Calcular produccion diaria del campamento" })
  async getDailyProduction(@Param("campId", ParseIntPipe) campId: number) {
    return this.usersService.calculateDailyProduction(campId);
  }

  @Get("camp/:campId/consumption")
  @Roles("admin", "resource_manager", "camp_leader")
  @ApiOperation({ summary: "Calcular consumo diario del campamento" })
  async getDailyConsumption(@Param("campId", ParseIntPipe) campId: number) {
    return this.usersService.calculateDailyConsumption(campId);
  }

  @Get("camp/:campId/balance")
  @Roles("admin", "resource_manager", "worker", "camp_leader")
  @ApiOperation({ summary: "Calcular balance diario (produccion - consumo)" })
  async getDailyBalance(@Param("campId", ParseIntPipe) campId: number) {
    return this.usersService.calculateDailyBalance(campId);
  }

  @Get("me/assigned-resources")
  @Roles("worker", "travel_manager")
  @ApiOperation({
    summary: "Obtener recursos asignados al usuario autenticado",
  })
  async getMyAssignedResources(@CurrentUser() user: any) {
    const userId = user?.userId ?? user?.id;
    return this.usersService.getAssignedResourcesByUser(userId);
  }

  @Get("assets")
  @Roles("admin", "resource_manager", "worker", "travel_manager")
  @ApiOperation({ summary: "Listar todos los assets/insignias del sistema" })
  @ApiQuery({
    name: "type",
    required: false,
    description: "Filtrar por tipo (ej. 'badge')",
  })
  async getAllAssets(@Query("type") type?: string) {
    return this.usersService.getAllAssets(type);
  }

  @Get("me/badges")
  @Roles("admin", "resource_manager", "worker", "travel_manager")
  @ApiOperation({ summary: "Obtener insignias ganadas por el usuario actual" })
  async getMyBadges(@CurrentUser() user: any) {
    const userId = user?.userId ?? user?.id;
    return this.usersService.getMyBadges(userId);
  }

  @Post("me/badges/:id/display")
  @Roles("admin", "resource_manager", "worker", "travel_manager")
  @ApiOperation({ summary: "Mostrar u ocultar una insignia en el perfil" })
  async toggleBadgeDisplay(
    @Param("id", ParseIntPipe) badgeId: number,
    @Body("is_displayed") isDisplayed: boolean,
    @CurrentUser() user: any,
  ) {
    const userId = user?.userId ?? user?.id;
    return this.usersService.toggleBadgeDisplay(userId, badgeId, isDisplayed);
  }
}
