import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { CampsService } from "./camps.service";
import { CreateCampDto } from "./dto/create-camp.dto";
import { UpdateCampDto } from "./dto/update-camp.dto";
import { Roles } from "../auth/decorators/roles.decorator";

@ApiBearerAuth()
@ApiTags("Campamentos")
@Controller("camps")
export class CampsController {
  constructor(private readonly campsService: CampsService) {}

  @Post()
  @Roles("admin", "travel_manager", "resource_manager")
  @ApiOperation({
    summary: "Crear campamento",
    description:
      "Crea un nuevo campamento e inicializa su inventario vacï¿½o con todos los recursos existentes.",
  })
  @ApiResponse({ status: 201, description: "Campamento creado exitosamente." })
  @ApiResponse({ status: 400, description: "Datos invï¿½lidos." })
  @ApiResponse({ status: 401, description: "No autenticado." })
  @ApiResponse({ status: 403, description: "Sin permiso." })
  create(@Body() dto: CreateCampDto) {
    return this.campsService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: "Listar campamentos activos",
    description: "Retorna todos los campamentos con estado activo.",
  })
  @ApiResponse({ status: 200, description: "Lista de campamentos." })
  findAll() {
    return this.campsService.findAll();
  }

  @Get(":id")
  @ApiOperation({
    summary: "Detalle de campamento",
    description: "Retorna el campamento con sus mï¿½tricas de inventario.",
  })
  @ApiParam({ name: "id", description: "ID del campamento", type: Number })
  @ApiResponse({ status: 200, description: "Detalle del campamento." })
  @ApiResponse({ status: 404, description: "Campamento no encontrado." })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.campsService.findOne(id);
  }

  @Patch(":id")
  @Roles("admin", "travel_manager", "resource_manager")
  @ApiOperation({
    summary: "Actualizar campamento",
    description: "Actualiza los datos de un campamento existente.",
  })
  @ApiParam({ name: "id", description: "ID del campamento", type: Number })
  @ApiResponse({ status: 200, description: "Campamento actualizado." })
  @ApiResponse({ status: 404, description: "Campamento no encontrado." })
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateCampDto) {
    return this.campsService.update(id, dto);
  }

  @Delete(":id")
  @Roles("admin", "travel_manager", "resource_manager")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Desactivar campamento",
    description: "Desactiva el campamento (soft delete). No elimina los datos.",
  })
  @ApiParam({ name: "id", description: "ID del campamento", type: Number })
  @ApiResponse({ status: 200, description: "Campamento desactivado." })
  @ApiResponse({ status: 404, description: "Campamento no encontrado." })
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.campsService.remove(id);
  }
}
