import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
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
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (err) {
      // Ignore
    }
  }

  async departTransfer(
    request: IntercampRequest,
    userId: number,
  ): Promise<void> {
    if (request.status !== "approved") {
      throw new BadRequestException(
        "La solicitud debe estar aprobada para poder salir",
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (request.resourceDetails?.length > 0) {
        for (const rd of request.resourceDetails) {
          const originInv = await queryRunner.manager.findOne(Inventory, {
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
          await queryRunner.manager.save(Inventory, originInv);

          await queryRunner.manager.save(InventoryMovement, {
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
          const person = await queryRunner.manager.findOne(Person, {
            where: { id: pd.person_id },
          });
          if (person) {
            person.status = PersonStatus.TRAVELING;
            await queryRunner.manager.save(Person, person);
          }
          pd.transfer_status = "in_transit";
          await queryRunner.manager.save(RequestPersonDetail, pd);
        }
      }

      if (personsCount > 0 && request.travel_days && request.travel_days > 0) {
        const foodRes = await queryRunner.manager.findOne(Resource, {
          where: { category: "food" },
        });
        const waterRes = await queryRunner.manager.findOne(Resource, {
          where: { category: "water" },
        });

        if (foodRes) {
          const neededFood =
            personsCount *
            request.travel_days *
            DAILY_CONSUMPTION.FOOD_PER_PERSON;
          const invFood = await queryRunner.manager.findOne(Inventory, {
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
          await queryRunner.manager.save(Inventory, invFood);
          await queryRunner.manager.save(InventoryMovement, {
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
          const invWater = await queryRunner.manager.findOne(Inventory, {
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
          await queryRunner.manager.save(Inventory, invWater);
          await queryRunner.manager.save(InventoryMovement, {
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
      await queryRunner.manager.save(IntercampRequest, request);

      await queryRunner.manager.save(AuditLog, {
        user_id: userId,
        camp_id: request.camp_origin_id,
        action: "intercamp_transfer_departed",
        entity_type: "intercamp_request",
        entity_id: Number(request.id),
        date: new Date(),
      });

      await queryRunner.commitTransaction();

      await this.invalidateCampDashboardCache(request.camp_origin_id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async arriveTransfer(
    request: IntercampRequest,
    userId: number,
  ): Promise<void> {
    if (request.status !== "in_transit") {
      throw new BadRequestException(
        "La solicitud debe estar en transito para poder recibirla",
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (request.resourceDetails?.length > 0) {
        for (const rd of request.resourceDetails) {
          const transferQty = Number(rd.requested_quantity);

          let destInv = await queryRunner.manager.findOne(Inventory, {
            where: {
              camp_id: request.camp_destination_id,
              resource_id: Number(rd.resource_id),
            },
            lock: { mode: "pessimistic_write" },
          });

          if (!destInv) {
            destInv = queryRunner.manager.create(Inventory, {
              camp_id: request.camp_destination_id,
              resource_id: Number(rd.resource_id),
              current_quantity: 0,
              minimum_stock_required: 0,
              alert_active: false,
              last_update: new Date(),
            });
          }

          destInv.current_quantity =
            Number(destInv.current_quantity) + transferQty;
          destInv.alert_active =
            Number(destInv.current_quantity) <
            Number(destInv.minimum_stock_required);
          destInv.last_update = new Date();
          await queryRunner.manager.save(Inventory, destInv);

          await queryRunner.manager.save(InventoryMovement, {
            camp_id: request.camp_destination_id,
            resource_id: Number(rd.resource_id),
            quantity: transferQty,
            type: "transfer_in",
            description: `Recepcion de transferencia desde origen (Solicitud #${request.id})`,
            date: new Date(),
            user_id: userId,
          });

          rd.approved_quantity = transferQty;
          rd.received_quantity = transferQty;
          await queryRunner.manager.save(RequestResourceDetail, rd);
        }
      }

      if (request.personDetails?.length > 0) {
        for (const pd of request.personDetails) {
          const person = await queryRunner.manager.findOne(Person, {
            where: { id: pd.person_id },
            relations: ["userAccount"],
          });

          if (person) {
            person.status = PersonStatus.ACTIVE;
            const xpGained = (request.travel_days || 1) * 10;
            person.experience_level = (person.experience_level || 0) + xpGained;
            await queryRunner.manager.save(Person, person);

            if (person.userAccount) {
              person.userAccount.camp_id = request.camp_destination_id;
              await queryRunner.manager.save(UserAccount, person.userAccount);
            }
          }

          pd.transfer_status = "completed";
          await queryRunner.manager.save(RequestPersonDetail, pd);
        }
      }

      request.status = "completed";
      request.arrival_date = new Date();
      await queryRunner.manager.save(IntercampRequest, request);

      await queryRunner.manager.save(AuditLog, {
        user_id: userId,
        camp_id: request.camp_destination_id,
        action: "intercamp_transfer_arrived",
        entity_type: "intercamp_request",
        entity_id: Number(request.id),
        date: new Date(),
      });

      await queryRunner.commitTransaction();

      await this.invalidateCampDashboardCache(request.camp_origin_id);
      await this.invalidateCampDashboardCache(request.camp_destination_id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
