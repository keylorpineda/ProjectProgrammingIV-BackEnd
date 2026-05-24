/**
 * Canonical role vocabulary. These five strings are the ONLY allowed role
 * values. They must match the `role.name` seed data, every `@Roles(...)`
 * decorator, the frontend route guards, and login routing.
 *
 * 5.1 - admin: Administrador del sistema. Acceso global, gestiona admisiones.
 * 5.2 - worker: Trabajador. Cambios de inventario autorizados por resource_manager.
 * 5.3 - resource_manager: Gestión de recursos. Traslados y envíos de recursos.
 * 5.4 - travel_manager: Encargado de viajes y comunicación. Expediciones y
 *       negociaciones con otros campamentos.
 * 5.5 - camp_leader: Líder de un campamento específico (alcance local), con
 *       vistas dedicadas en `/campleader/*` en el frontend.
 */

export enum UserRole {
  ADMIN = "admin",
  WORKER = "worker",
  RESOURCE_MANAGER = "resource_manager",
  TRAVEL_MANAGER = "travel_manager",
  CAMP_LEADER = "camp_leader",
}

export const ROLES_CONFIG = {
  [UserRole.ADMIN]: {
    name: "Administrador del Sistema",
    description:
      "Acceso completo al sistema, gestiona ingresos de personas y admisiones",
    permissions: [
      "view_all_camps",
      "manage_admissions",
      "view_all_users",
      "manage_professions",
      "view_dashboard",
      "create_camps",
    ],
  },
  [UserRole.WORKER]: {
    name: "Trabajador",
    description:
      "Realiza cambios de inventario autorizados por resource_manager",
    permissions: [
      "view_inventory",
      "adjust_daily_production",
      "view_own_resources",
      "view_camp_info",
    ],
  },
  [UserRole.RESOURCE_MANAGER]: {
    name: "Gestión de Recursos",
    description:
      "Encargado de traslados y envíos de recursos entre campamentos",
    permissions: [
      "manage_inventory",
      "create_transfers",
      "approve_transfers",
      "view_alerts",
      "manage_resources",
      "view_dashboard",
      "authorize_worker_changes",
    ],
  },
  [UserRole.TRAVEL_MANAGER]: {
    name: "Encargado de Viajes",
    description: "Realiza expediciones y negociaciones con otros campamentos",
    permissions: [
      "create_explorations",
      "manage_explorations",
      "create_intercamp_requests",
      "negotiate_transfers",
      "view_other_camps",
      "manage_travel_groups",
    ],
  },
  [UserRole.CAMP_LEADER]: {
    name: "Líder de Campamento",
    description: "Administra un campamento específico (scope local, no global)",
    permissions: [
      "manage_own_camp_people",
      "approve_own_camp_admissions",
      "manage_own_camp_resources",
      "view_own_camp_dashboard",
      "approve_own_camp_transfers",
      "manage_own_camp_assignments",
      "view_own_camp_reports",
    ],
  },
};

export function roleHasPermission(role: UserRole, permission: string): boolean {
  return ROLES_CONFIG[role]?.permissions.includes(permission) ?? false;
}

export function getRolePermissions(role: UserRole): string[] {
  return ROLES_CONFIG[role]?.permissions ?? [];
}
