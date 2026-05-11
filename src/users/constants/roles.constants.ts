/**
 * Roles del sistema segun el enunciado del proyecto
 *
 * ROLES OBLIGATORIOS (enunciado):
 * 5.1 - Administrador sistema: Tiene acceso a ver todo el sistema, pero solo gestiona los ingresos de personas
 * 5.2 - Trabajador: Solo puede hacer cambios de inventario, autorizados por el gestionador de los recursos
 * 5.3 - Gestion recursos: Encargado general de realizar traslados y envios de recursos
 * 5.4 - Encargado de viajes y comunicacion: Realiza las expediciones y negociaciones con los otros campamentos
 *
 * ROLES ADICIONALES (justificados):
 * 6 - Lider de Campamento: Administra un campamento especifico (sistema multi-campamento)
 * 7 - Supervisor: Audita operaciones del sistema (requerimiento de auditoria del enunciado)
 */

export enum UserRole {
  ADMIN = "admin",
  TRABAJADOR = "trabajador",
  GESTOR_RECURSOS = "gestor_recursos",
  ENCARGADO_VIAJES = "encargado_viajes",
  LIDER_CAMPAMENTO = "lider_campamento",
  SUPERVISOR = "supervisor",
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
  [UserRole.TRABAJADOR]: {
    name: "Trabajador",
    description:
      "Realiza cambios de inventario autorizados por gestion de recursos",
    permissions: [
      "view_inventory",
      "adjust_daily_production",
      "view_own_resources",
      "view_camp_info",
    ],
  },
  [UserRole.GESTOR_RECURSOS]: {
    name: "Gestion de Recursos",
    description:
      "Encargado de traslados y envios de recursos entre campamentos",
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
  [UserRole.ENCARGADO_VIAJES]: {
    name: "Encargado de Viajes y Comunicacion",
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
  [UserRole.LIDER_CAMPAMENTO]: {
    name: "Lider de Campamento",
    description: "Administra su campamento especifico (scope local, no global)",
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
  [UserRole.SUPERVISOR]: {
    name: "Supervisor/Auditor",
    description:
      "Supervisa y audita todas las operaciones del sistema (solo lectura)",
    permissions: [
      "view_all_audit_logs",
      "view_all_transfers",
      "view_all_explorations",
      "view_all_inventory_movements",
      "view_all_camps_readonly",
      "generate_audit_reports",
      "view_all_admissions",
    ],
  },
};

/**
 * Verifica si un rol tiene un permiso especifico
 */
export function roleHasPermission(role: UserRole, permission: string): boolean {
  return ROLES_CONFIG[role]?.permissions.includes(permission) ?? false;
}

/**
 * Obtiene todos los permisos de un rol
 */
export function getRolePermissions(role: UserRole): string[] {
  return ROLES_CONFIG[role]?.permissions ?? [];
}
