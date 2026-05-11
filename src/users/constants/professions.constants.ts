export enum PersonStatus {
  ACTIVE = "active",
  SICK = "sick",
  INJURED = "injured",
  DECEASED = "deceased",
  EXPLORING = "exploring",
  TRAVELING = "traveling",
  RESTING = "resting",
  IDLE = "idle",
  OUT_OF_CAMP = "out_of_camp",
}

export const PROFESSIONS_CONFIG = {
  RECOLECTOR: {
    name: "Recolector",
    can_explore: true,
    minimum_required: 2,
    daily_food_production: 10,
    daily_water_production: 0,
    description: "Recolecta alimentos en zonas cercanas al campamento",
  },
  AGUATERO: {
    name: "Aguatero",
    can_explore: false,
    minimum_required: 2,
    daily_food_production: 0,
    daily_water_production: 15,
    description: "Obtiene y purifica agua para el campamento",
  },
  EXPLORADOR: {
    name: "Explorador",
    can_explore: true,
    minimum_required: 1,
    daily_food_production: 5,
    daily_water_production: 0,
    description: "Especialista en expediciones y reconocimiento",
  },
  GUARDIA: {
    name: "Guardia",
    can_explore: false,
    minimum_required: 2,
    daily_food_production: 0,
    daily_water_production: 0,
    description: "Protege el campamento de amenazas zombie y humanas",
  },
  MEDICO: {
    name: "Medico",
    can_explore: false,
    minimum_required: 1,
    daily_food_production: 0,
    daily_water_production: 0,
    description: "Cura heridos y enfermos, mantiene la salud del grupo",
  },
  INGENIERO: {
    name: "Ingeniero",
    can_explore: false,
    minimum_required: 1,
    daily_food_production: 0,
    daily_water_production: 5,
    description: "Mantiene y mejora la infraestructura del campamento",
  },
  COCINERO: {
    name: "Cocinero",
    can_explore: false,
    minimum_required: 1,
    daily_food_production: 3,
    daily_water_production: 0,
    description: "Prepara alimentos y gestiona raciones eficientemente",
  },
  ALMACENISTA: {
    name: "Almacenista",
    can_explore: false,
    minimum_required: 1,
    daily_food_production: 0,
    daily_water_production: 0,
    description: "Gestiona el inventario y previene desperdicios",
  },
  AGRICULTOR: {
    name: "Agricultor",
    can_explore: false,
    minimum_required: 1,
    daily_food_production: 8,
    daily_water_production: 0,
    description: "Cultiva alimentos a largo plazo en el campamento",
  },
  CONSTRUCTOR: {
    name: "Constructor",
    can_explore: false,
    minimum_required: 1,
    daily_food_production: 0,
    daily_water_production: 0,
    description: "Construye y refuerza estructuras del campamento",
  },
};

export const DAILY_CONSUMPTION = {
  FOOD_PER_PERSON: 2,
  WATER_PER_PERSON: 3,
};

export const TEMPORARY_ASSIGNMENT_CONFIG = {
  DEFAULT_DURATION_DAYS: 7,
  MAX_DURATION_DAYS: 30,
  MIN_DURATION_DAYS: 1,
};

export const WORKING_STATUSES = [PersonStatus.ACTIVE];

export const NON_WORKING_STATUSES = [
  PersonStatus.SICK,
  PersonStatus.INJURED,
  PersonStatus.DECEASED,
  PersonStatus.EXPLORING,
  PersonStatus.TRAVELING,
  PersonStatus.RESTING,
  PersonStatus.IDLE,
  PersonStatus.OUT_OF_CAMP,
];
