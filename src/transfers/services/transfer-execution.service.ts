import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { EntityManager } from "typeorm";
import { Repository, DataSource } from "typeorm";
import { IntercampRequest } from "../entities/intercamp-request.entity";
import { RequestResourceDetail } from "../entities/request-resource-detail.entity";
import { RequestPersonDetail } from "../entities/request-person-detail.entity";
import { Person } from "../../users/entities/person.entity";
import { UserAccount } from "../../users/entities/user-account.entity";
import { Inventory } from "../../resources/entities/inventory.entity";
import { Resource } from "../../resources/entities/resource.entity";
import { InventoryMovement } from "../../resources/entities/inventory-movement.entity";
import { AuditLog } from "../../common/entities/audit-log.entity";
import {
  PersonStatus,
  DAILY_CONSUMPTION,
} from "../../users/constants/professions.constants";
import { Inject } from "@nestjs/common";
import { REDIS_CLIENT } from "../../redis/redis.constants";
import { Redis } from "ioredis";

@Injectable()
export class TransferExecutionService {
  constructor(
    @InjectRepository(IntercampRequest)
    private readonly requestRepo: Repository<IntercampRequest>,
    @InjectRepository(Person)
    private readonly personRepo: Repository<Person>,
    @InjectRepository(UserAccount)
    private readonly userRepo: Repository<UserAccount>,
    @InjectRepository(Inventory)
    private readonly inventoryRepo: Repository<Inventory>,
    @InjectRepository(InventoryMovement)
    private readonly movementRepo: Repository<InventoryMovement>,
    @InjectRepository(RequestResourceDetail)
    private readonly resourceDetailRepo: Repository<RequestResourceDetail>,
    @InjectRepository(RequestPersonDetail)
    private readonly personDetailRepo: Repository<RequestPersonDetail>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  private async invalidateCampDashboardCache(campId: number): Promise<void> {
    try {
      const keys = await this.redis.keys(`dashboard:metrics:${campId}:*`);
      if (keys.length > 0) await this.redis.del(...keys);
    } catch {
      // Ignore
    }
  }

  private async invalidateTransfersCache(campId: number): Promise<void> {
    try {
      const keys = await this.redis.keys(`transfers:camp:${campId}:*`);
      if (keys.length > 0) await this.redis.del(...keys);
    } catch {
      // Ignore
    }
  }

  async departTransfer(
    request: IntercampRequest,
    userId: number,
    outerManager?: EntityManager,
  ): Promise<void> {
    if (request.status !== "approved") {
      throw new BadRequestException(
        "La solicitud debe estar aprobada para poder salir",
      );
    }

    // Lógica de negocio extraída para poder reusar con o sin queryRunner externo.
    const doWork = async (manager: EntityManager) => {
      if (request.resourceDetails?.length > 0) {
        for (const rd of request.resourceDetails) {
          const originInv = await manager.findOne(Inventory, {
            where: {
              camp_id: request.camp_origin_id,
              resource_id: Number(rd.resource_id),
            },
            lock: { mode: "pessimistic_write" },
          });

          if (
            !originInv ||
            Number(originInv.current_quantity) < Number(rd.requested_quantity)
          ) {
            throw new BadRequestException(
              `Recurso insuficiente en origen para recurso ID ${rd.resource_id}`,
            );
          }

          originInv.current_quantity =
            Number(originInv.current_quantity) - Number(rd.requested_quantity);
          originInv.alert_active =
            Number(originInv.current_quantity) <
            Number(originInv.minimum_stock_required);
          originInv.last_update = new Date();
          await manager.save(Inventory, originInv);

          await manager.save(InventoryMovement, {
            camp_id: request.camp_origin_id,
            resource_id: Number(rd.resource_id),
            quantity: rd.requested_quantity,
            type: "transfer_out",
            description: `Salida de transferencia a destino (Solicitud #${request.id})`,
            date: new Date(),
            user_id: userId,
          });
        }
      }

      let personsCount = 0;
      if (request.personDetails?.length > 0) {
        personsCount = request.personDetails.length;
        for (const pd of request.personDetails) {
          const person = await manager.findOne(Person, {
            where: { id: pd.person_id },
          });
          if (person) {
            person.status = PersonStatus.TRAVELING;
            await manager.save(Person, person);
          }
          pd.transfer_status = "in_transit";
          await manager.save(RequestPersonDetail, pd);
        }
      }

      if (personsCount > 0 && request.travel_days && request.travel_days > 0) {
        const foodRes = await manager.findOne(Resource, {
          where: { category: "food" },
        });
        const waterRes = await manager.findOne(Resource, {
          where: { category: "water" },
        });

        if (foodRes) {
          const neededFood =
            personsCount *
            request.travel_days *
            DAILY_CONSUMPTION.FOOD_PER_PERSON;
          const invFood = await manager.findOne(Inventory, {
            where: {
              camp_id: request.camp_origin_id,
              resource_id: Number(foodRes.id),
            },
            lock: { mode: "pessimistic_write" },
          });
          if (!invFood || Number(invFood.current_quantity) < neededFood) {
            throw new BadRequestException(
              "No hay suficiente comida para el viaje",
            );
          }
          invFood.current_quantity =
            Number(invFood.current_quantity) - neededFood;
          await manager.save(Inventory, invFood);
          await manager.save(InventoryMovement, {
            camp_id: request.camp_origin_id,
            resource_id: Number(foodRes.id),
            quantity: neededFood,
            type: "transfer_out",
            description: `Raciones de viaje de ida (Solicitud #${request.id})`,
            date: new Date(),
            user_id: userId,
          });
        }

        if (waterRes) {
          const neededWater =
            personsCount *
            request.travel_days *
            DAILY_CONSUMPTION.WATER_PER_PERSON;
          const invWater = await manager.findOne(Inventory, {
            where: {
              camp_id: request.camp_origin_id,
              resource_id: Number(waterRes.id),
            },
            lock: { mode: "pessimistic_write" },
          });
          if (!invWater || Number(invWater.current_quantity) < neededWater) {
            throw new BadRequestException(
              "No hay suficiente agua para el viaje",
            );
          }
          invWater.current_quantity =
            Number(invWater.current_quantity) - neededWater;
          await manager.save(Inventory, invWater);
          await manager.save(InventoryMovement, {
            camp_id: request.camp_origin_id,
            resource_id: Number(waterRes.id),
            quantity: neededWater,
            type: "transfer_out",
            description: `Agua de viaje de ida (Solicitud #${request.id})`,
            date: new Date(),
            user_id: userId,
          });
        }
      }

      request.status = "in_transit";
      request.departure_date = new Date();
      await manager.save(IntercampRequest, request);

      await manager.save(AuditLog, {
        user_id: userId,
        camp_id: request.camp_origin_id,
        action: "intercamp_transfer_departed",
        entity_type: "intercamp_request",
        entity_id: Number(request.id),
        date: new Date(),
      });
    };

    if (outerManager) {
      // El llamador gestiona la transacción; tampoco invalidamos caché aquí
      // (lo hará el llamador después del commit externo).
      await doWork(outerManager);
    } else {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      try {
        await doWork(queryRunner.manager);
        await queryRunner.commitTransaction();
        await this.invalidateCampDashboardCache(request.camp_origin_id);
        await this.invalidateCampDashboardCache(request.camp_destination_id);
        await this.invalidateTransfersCache(request.camp_origin_id);
        await this.invalidateTransfersCache(request.camp_destination_id);
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    }
  }
}
