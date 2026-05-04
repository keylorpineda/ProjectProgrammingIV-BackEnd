import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { IntercampRequest } from "../entities/intercamp-request.entity";
import { RequestResourceDetail } from "../entities/request-resource-detail.entity";
import { RequestPersonDetail } from "../entities/request-person-detail.entity";
import { Camp } from "../../camps/entities/camp.entity";
import { Person } from "../../users/entities/person.entity";
import { Inventory } from "../../resources/entities/inventory.entity";
import { Resource } from "../../resources/entities/resource.entity";
import { AuditLog } from "../../common/entities/audit-log.entity";
import { CreateIntercampRequestDto } from "../dto/create-intercamp-request.dto";

@Injectable()
export class RequestsService {
  constructor(
    @InjectRepository(IntercampRequest)
    private readonly requestRepo: Repository<IntercampRequest>,
    @InjectRepository(RequestResourceDetail)
    private readonly resourceDetailRepo: Repository<RequestResourceDetail>,
    @InjectRepository(RequestPersonDetail)
    private readonly personDetailRepo: Repository<RequestPersonDetail>,
    @InjectRepository(Camp)
    private readonly campRepo: Repository<Camp>,
    @InjectRepository(Person)
    private readonly personRepo: Repository<Person>,
    @InjectRepository(Inventory)
    private readonly inventoryRepo: Repository<Inventory>,
    @InjectRepository(Resource)
    private readonly resourceRepo: Repository<Resource>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly dataSource: DataSource,
  ) {}

  async createRequest(
    dto: CreateIntercampRequestDto,
    userId: number,
  ): Promise<IntercampRequest> {
    if (dto.camp_origin_id === dto.camp_destination_id) {
      throw new BadRequestException(
        "El campamento origen y destino no pueden ser el mismo",
      );
    }

    const originCamp = await this.campRepo.findOne({
      where: { id: dto.camp_origin_id },
    });
    const destCamp = await this.campRepo.findOne({
      where: { id: dto.camp_destination_id },
    });

    if (!originCamp || !destCamp) {
      throw new NotFoundException("Uno o ambos campamentos no existen");
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const request = queryRunner.manager.create(IntercampRequest, {
        camp_origin_id: dto.camp_origin_id,
        camp_destination_id: dto.camp_destination_id,
        type: dto.type,
        status: "pending",
        request_date: new Date(),
        notes: dto.notes,
        travel_days: dto.travel_days ?? 1,
      });

      const savedRequest = await queryRunner.manager.save(
        IntercampRequest,
        request,
      );

      if (dto.resource_details && dto.resource_details.length > 0) {
        await this.validateAndCreateResourceDetails(
          queryRunner,
          savedRequest,
          dto,
        );
      }

      if (dto.person_details && dto.person_details.length > 0) {
        await this.validateAndCreatePersonDetails(
          queryRunner,
          savedRequest,
          dto,
        );
      }

      await queryRunner.manager.save(AuditLog, {
        user_id: userId,
        camp_id: dto.camp_origin_id,
        action: "intercamp_request_created",
        entity_type: "intercamp_request",
        entity_id: Number(savedRequest.id),
        new_value: {
          type: dto.type,
          camp_destination_id: dto.camp_destination_id,
        },
        date: new Date(),
      });

      await queryRunner.commitTransaction();

      return this.findRequestById(Number(savedRequest.id));
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async validateAndCreateResourceDetails(
    queryRunner: any,
    request: IntercampRequest,
    dto: CreateIntercampRequestDto,
  ): Promise<void> {
    for (const rd of dto.resource_details!) {
      const resource = await queryRunner.manager.findOne(Resource, {
        where: { id: rd.resource_id },
      });
      if (!resource) {
        throw new NotFoundException(
          `Recurso con ID ${rd.resource_id} no encontrado`,
        );
      }

      const inventory = await queryRunner.manager.findOne(Inventory, {
        where: {
          camp_id: dto.camp_origin_id,
          resource_id: rd.resource_id,
        },
      });

      if (
        !inventory ||
        Number(inventory.current_quantity) < Number(rd.requested_quantity)
      ) {
        throw new BadRequestException(
          `Recurso "${resource.name}" insuficiente en campamento origen. Disponible: ${inventory?.current_quantity ?? 0}, Solicitado: ${rd.requested_quantity}`,
        );
      }

      await queryRunner.manager.save(RequestResourceDetail, {
        request_id: Number(request.id),
        resource_id: rd.resource_id,
        requested_quantity: rd.requested_quantity,
        approved_quantity: null,
        received_quantity: null,
      });
    }
  }

  private async validateAndCreatePersonDetails(
    queryRunner: any,
    request: IntercampRequest,
    dto: CreateIntercampRequestDto,
  ): Promise<void> {
    for (const pd of dto.person_details!) {
      const person = await queryRunner.manager.findOne(Person, {
        where: { id: pd.person_id },
        relations: ["userAccount"],
      });

      if (!person) {
        throw new NotFoundException(
          `Persona con ID ${pd.person_id} no encontrada`,
        );
      }

      if (person.userAccount?.camp_id !== dto.camp_origin_id) {
        throw new BadRequestException(
          `La persona ${person.first_name} ${person.last_name} no pertenece al campamento origen`,
        );
      }

      await queryRunner.manager.save(RequestPersonDetail, {
        request_id: Number(request.id),
        person_id: pd.person_id,
        is_leader: pd.is_leader ?? false,
        transfer_status: "pending",
      });
    }
  }

  async findRequestById(id: number): Promise<IntercampRequest> {
    const request = await this.requestRepo.findOne({
      where: { id },
      relations: [
        "campOrigin",
        "campDestination",
        "resourceDetails",
        "resourceDetails.resource",
        "personDetails",
        "personDetails.person",
        "approvals",
        "approvals.user",
      ],
    });

    if (!request) {
      throw new NotFoundException(
        `Solicitud de transferencia con ID ${id} no encontrada`,
      );
    }

    return request;
  }

  async findRequestsByCamp(
    campId: number,
    role?: "origin" | "destination",
    status?: string,
  ): Promise<IntercampRequest[]> {
    const queryBuilder = this.requestRepo
      .createQueryBuilder("req")
      .leftJoinAndSelect("req.campOrigin", "campOrigin")
      .leftJoinAndSelect("req.campDestination", "campDest")
      .leftJoinAndSelect("req.resourceDetails", "rd")
      .leftJoinAndSelect("rd.resource", "resource")
      .leftJoinAndSelect("req.personDetails", "pd")
      .leftJoinAndSelect("pd.person", "person")
      .leftJoinAndSelect("req.approvals", "approvals")
      .leftJoinAndSelect("approvals.user", "appUser");

    if (role === "origin") {
      queryBuilder.where("req.camp_origin_id = :campId", { campId });
    } else if (role === "destination") {
      queryBuilder.where("req.camp_destination_id = :campId", { campId });
    } else {
      queryBuilder.where(
        "(req.camp_origin_id = :campId OR req.camp_destination_id = :campId)",
        { campId },
      );
    }

    if (status) {
      const allowed = [
        "pending",
        "approved",
        "in_transit",
        "completed",
        "rejected",
        "cancelled",
      ];
      if (!allowed.includes(status)) {
        throw new BadRequestException("Estado de solicitud inválido");
      }
      queryBuilder.andWhere("req.status = :status", { status });
    }

    return queryBuilder.orderBy("req.request_date", "DESC").getMany();
  }

  async findPendingRequestsByCamp(campId: number): Promise<IntercampRequest[]> {
    return this.requestRepo.find({
      where: [
        { camp_origin_id: campId, status: "pending" },
        { camp_destination_id: campId, status: "pending" },
      ],
      relations: [
        "campOrigin",
        "campDestination",
        "resourceDetails",
        "resourceDetails.resource",
        "personDetails",
        "personDetails.person",
        "approvals",
        "approvals.user",
      ],
      order: { request_date: "DESC" },
    });
  }

  async cancelRequest(
    requestId: number,
    userId: number,
    userCampId: number,
  ): Promise<IntercampRequest> {
    const request = await this.findRequestById(requestId);

    if (request.status !== "pending") {
      throw new BadRequestException(
        "Solo se pueden cancelar solicitudes pendientes",
      );
    }

    if (userCampId !== request.camp_origin_id) {
      throw new BadRequestException(
        "Solo el campamento origen puede cancelar la solicitud",
      );
    }

    request.status = "cancelled";
    await this.requestRepo.save(request);

    await this.auditRepo.save(
      this.auditRepo.create({
        user_id: userId,
        camp_id: request.camp_origin_id,
        action: "intercamp_request_cancelled",
        entity_type: "intercamp_request",
        entity_id: requestId,
        date: new Date(),
      }),
    );

    return this.findRequestById(requestId);
  }

  async getTransferStatistics(campId: number): Promise<{
    totalRequests: number;
    pending: number;
    approved: number;
    completed: number;
    rejected: number;
    cancelled: number;
    asOrigin: number;
    asDestination: number;
  }> {
    const allRequests = await this.requestRepo.find({
      where: [{ camp_origin_id: campId }, { camp_destination_id: campId }],
    });

    return {
      totalRequests: allRequests.length,
      pending: allRequests.filter((r) => r.status === "pending").length,
      approved: allRequests.filter((r) => r.status === "approved").length,
      completed: allRequests.filter((r) => r.status === "completed").length,
      rejected: allRequests.filter((r) => r.status === "rejected").length,
      cancelled: allRequests.filter((r) => r.status === "cancelled").length,
      asOrigin: allRequests.filter((r) => r.camp_origin_id === campId).length,
      asDestination: allRequests.filter((r) => r.camp_destination_id === campId)
        .length,
    };
  }
}
