import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { getMetadataArgsStorage } from "typeorm";
import { Camp } from "../camps/entities/camp.entity";
import { Resource } from "../resources/entities/resource.entity";
import { Person } from "../users/entities/person.entity";
import { UserAccount } from "../users/entities/user-account.entity";
import {
  CreateExplorationDto,
  ExplorationPersonDto,
  ExplorationResourceDto,
} from "./dto/create-exploration.dto";
import { ReturnExplorationDto } from "./dto/return-exploration.dto";
import { Exploration } from "./entities/exploration.entity";
import { ExplorationPerson } from "./entities/exploration-person.entity";
import { ExplorationResource } from "./entities/exploration-resource.entity";

type EntityConstructor = new (...args: unknown[]) => unknown;

const getRelations = (target: EntityConstructor) =>
  getMetadataArgsStorage().relations.filter(
    (relation) => relation.target === target,
  );

const getRelationTypes = (target: EntityConstructor) =>
  getRelations(target).map((relation) => {
    const relationType = relation.type;
    return typeof relationType === "function"
      ? (relationType as () => unknown)()
      : relationType;
  });

const getInverseProperties = (
  target: EntityConstructor,
  sample: Record<string, unknown>,
) =>
  getRelations(target)
    .map((relation) => relation.inverseSideProperty)
    .filter(
      (inverse): inverse is (value: Record<string, unknown>) => unknown =>
        typeof inverse === "function",
    )
    .map((inverse) => inverse(sample));

describe("Explorations support files", () => {
  describe("dto validation", () => {
    it("should validate a complete create exploration dto", async () => {
      const dto = plainToInstance(CreateExplorationDto, {
        camp_id: 1,
        name: "Expedicion",
        destination_description: "Zona este",
        departure_date: "2026-03-25T00:00:00.000Z",
        estimated_days: 2,
        grace_days: 1,
        persons: [{ person_id: 10, is_leader: true }],
        resources: [{ resource_id: 3, flow: "out", quantity: 5 }],
      });

      await expect(validate(dto)).resolves.toHaveLength(0);
      expect(dto.persons[0]).toBeInstanceOf(ExplorationPersonDto);
      expect(dto.resources?.[0]).toBeInstanceOf(ExplorationResourceDto);
    });

    it("should invalidate create exploration dto with non-positive values", async () => {
      const dto = plainToInstance(CreateExplorationDto, {
        camp_id: "a",
        name: 123,
        departure_date: "bad-date",
        estimated_days: 0,
        grace_days: -1,
        persons: [{ person_id: "bad" }],
        resources: [{ resource_id: 3, flow: 5, quantity: -2 }],
      });

      const errors = await validate(dto);
      expect(errors).not.toHaveLength(0);
    });

    it("should validate a return exploration dto", async () => {
      const dto = plainToInstance(ReturnExplorationDto, {
        real_return_date: "2026-03-28T00:00:00.000Z",
        notes: "Regreso exitoso",
        found_resources: [{ resource_id: 3, flow: "in", quantity: 2 }],
      });

      await expect(validate(dto)).resolves.toHaveLength(0);
      expect(dto.found_resources?.[0]).toBeInstanceOf(ExplorationResourceDto);
    });

    it("should invalidate a return exploration dto with bad resource payload", async () => {
      const dto = plainToInstance(ReturnExplorationDto, {
        real_return_date: "not-a-date",
        notes: 123,
        found_resources: [{ resource_id: "bad", flow: 4, quantity: -1 }],
      });

      const errors = await validate(dto);
      expect(errors).not.toHaveLength(0);
    });
  });

  describe("entities", () => {
    it("should define Exploration properties and relations", () => {
      const entity = new Exploration();
      const camp = new Camp();
      const userCreate = new UserAccount();
      const explorationPersons = [new ExplorationPerson()];
      const explorationResources = [new ExplorationResource()];
      const departure = new Date("2026-03-25T00:00:00.000Z");
      const returned = new Date("2026-03-28T00:00:00.000Z");

      entity.id = 1;
      entity.camp_id = 2;
      entity.name = "Salida norte";
      entity.destination_description = "Ruinas";
      entity.departure_date = departure;
      entity.estimated_days = 3;
      entity.grace_days = 1;
      entity.real_return_date = returned;
      entity.status = "completed";
      entity.notes = "Todo bien";
      entity.user_create_id = 9;
      entity.camp = camp;
      entity.userCreate = userCreate;
      entity.explorationPersons = explorationPersons;
      entity.explorationResources = explorationResources;

      expect(entity).toEqual({
        id: 1,
        camp_id: 2,
        name: "Salida norte",
        destination_description: "Ruinas",
        departure_date: departure,
        estimated_days: 3,
        grace_days: 1,
        real_return_date: returned,
        status: "completed",
        notes: "Todo bien",
        user_create_id: 9,
        camp,
        userCreate,
        explorationPersons,
        explorationResources,
      });

      const relations = getRelations(Exploration).map(
        (relation) => relation.propertyName,
      );
      expect(relations).toEqual(
        expect.arrayContaining([
          "camp",
          "userCreate",
          "explorationPersons",
          "explorationResources",
        ]),
      );
      expect(getRelationTypes(Exploration)).toEqual(
        expect.arrayContaining([
          Camp,
          UserAccount,
          ExplorationPerson,
          ExplorationResource,
        ]),
      );
      expect(
        getInverseProperties(Exploration, {
          exploration: "exploration",
          explorationPersons: "explorationPersons",
          explorationResources: "explorationResources",
        }),
      ).toEqual(expect.arrayContaining(["exploration", "exploration"]));
    });

    it("should define ExplorationPerson properties and relations", () => {
      const entity = new ExplorationPerson();
      const exploration = new Exploration();
      const person = new Person();

      entity.exploration_id = 1;
      entity.person_id = 2;
      entity.is_leader = true;
      entity.return_confirmed = false;
      entity.exploration = exploration;
      entity.person = person;

      expect(entity).toEqual({
        exploration_id: 1,
        person_id: 2,
        is_leader: true,
        return_confirmed: false,
        exploration,
        person,
      });

      const relations = getRelations(ExplorationPerson).map(
        (relation) => relation.propertyName,
      );
      expect(relations).toEqual(
        expect.arrayContaining(["exploration", "person"]),
      );
      expect(getRelationTypes(ExplorationPerson)).toEqual(
        expect.arrayContaining([Exploration, Person]),
      );
      expect(
        getInverseProperties(ExplorationPerson, {
          explorationPersons: "explorationPersons",
        }),
      ).toEqual(expect.arrayContaining(["explorationPersons"]));
    });

    it("should define ExplorationResource properties and relations", () => {
      const entity = new ExplorationResource();
      const exploration = new Exploration();
      const resource = new Resource();

      entity.exploration_id = 1;
      entity.flow = "out";
      entity.resource_id = 2;
      entity.quantity = 8;
      entity.exploration = exploration;
      entity.resource = resource;

      expect(entity).toEqual({
        exploration_id: 1,
        flow: "out",
        resource_id: 2,
        quantity: 8,
        exploration,
        resource,
      });

      const relations = getRelations(ExplorationResource).map(
        (relation) => relation.propertyName,
      );
      expect(relations).toEqual(
        expect.arrayContaining(["exploration", "resource"]),
      );
      expect(getRelationTypes(ExplorationResource)).toEqual(
        expect.arrayContaining([Exploration, Resource]),
      );
      expect(
        getInverseProperties(ExplorationResource, {
          explorationResources: "explorationResources",
        }),
      ).toEqual(expect.arrayContaining(["explorationResources"]));
    });
  });
});
