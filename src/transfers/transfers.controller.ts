import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { TransfersService } from "./transfers.service";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { CreateIntercampRequestDto } from "./dto/create-intercamp-request.dto";
import { ApprovalDto } from "./dto/approval.dto";

@ApiTags("Transfers")
@ApiBearerAuth()
@Controller("transfers")
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Post("requests")
  @Roles("admin", "resource_manager", "travel_manager")
  @ApiOperation({
    summary: "Crear solicitud de transferencia inter-campamento",
  })
  async createRequest(
    @Body() dto: CreateIntercampRequestDto,
    @CurrentUser() user: any,
  ) {
    return this.transfersService.createRequest(dto, user.userId);
  }

  @Get("requests/:id")
  @Roles("admin", "resource_manager", "travel_manager", "worker")
  @ApiOperation({ summary: "Obtener detalle de solicitud de transferencia" })
  async getRequest(@Param("id", ParseIntPipe) id: number) {
    return this.transfersService.findRequestById(id);
  }

  @Get("requests/camp/:campId")
  @Roles("admin", "resource_manager", "travel_manager")
  @ApiOperation({ summary: "Listar solicitudes de un campamento" })
  @ApiQuery({
    name: "role",
    required: false,
    enum: ["origin", "destination"],
    description: "Filtrar por rol del campamento",
  })
  @ApiQuery({
    name: "status",
    required: false,
    enum: [
      "pending",
      "approved",
      "in_transit",
      "completed",
      "rejected",
      "cancelled",
    ],
    description: "Filtrar por estado de la solicitud",
  })
  async getRequestsByCamp(
    @Param("campId", ParseIntPipe) campId: number,
    @Query("role") role?: "origin" | "destination",
    @Query("status") status?: string,
  ) {
    return this.transfersService.findRequestsByCamp(campId, role, status);
  }

  @Get("requests/camp/:campId/pending")
  @Roles("admin", "resource_manager", "travel_manager")
  @ApiOperation({ summary: "Solicitudes pendientes de aprobacion" })
  async getPendingRequests(@Param("campId", ParseIntPipe) campId: number) {
    return this.transfersService.findPendingRequestsByCamp(campId);
  }

  @Patch("requests/:id/approval")
  @Roles("admin", "resource_manager", "travel_manager")
  @ApiOperation({ summary: "Aprobar o rechazar solicitud de transferencia" })
  async approveOrReject(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ApprovalDto,
    @CurrentUser() user: any,
  ) {
    return this.transfersService.approveOrRejectRequest(id, user.userId, dto);
  }

  @Patch("requests/:id/cancel")
  @Roles("admin", "resource_manager", "travel_manager")
  @ApiOperation({
    summary: "Cancelar solicitud pendiente (solo campamento origen)",
  })
  async cancelRequest(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.transfersService.cancelRequest(id, user.userId);
  }

  @Patch("requests/:id/arrive")
  @Roles("admin", "resource_manager", "travel_manager", "worker")
  @ApiOperation({
    summary: "Registrar llegada de transferencia (solo campamento destino)",
  })
  async arriveRequest(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.transfersService.arriveRequest(id, user.userId);
  }

  @Get("statistics/:campId")
  @Roles("admin", "resource_manager")
  @ApiOperation({ summary: "Estadisticas de transferencias del campamento" })
  async getStatistics(@Param("campId", ParseIntPipe) campId: number) {
    return this.transfersService.getTransferStatistics(campId);
  }
}
