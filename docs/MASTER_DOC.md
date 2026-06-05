# Documentación Maestra de Defensa — "Gestión del Fin"

> Fuente de verdad del comportamiento esperado del sistema. El contrato técnico
> (nombres de campos, roles, rutas, plan de alineación) vive en `ALIGNMENT_SPEC.md`.

---

## 1. Justificación del Stack Tecnológico

Se seleccionaron herramientas para una arquitectura moderna orientada a servicios,
con escalabilidad, seguridad y desarrollo asistido por IA.

- **NestJS** — Framework principal. Arquitectura modular con inyección de
  dependencias; separa la lógica en módulos independientes (IA, Inventario,
  Usuarios) para mantenibilidad y escalabilidad.
- **TypeScript** — Lenguaje tipado; detecta errores en desarrollo antes de
  producción, clave para estructuras de datos complejas.
- **PostgreSQL + TypeORM** — Motor relacional con integridad ACID. TypeORM mapea
  tablas a objetos y maneja transacciones críticas.
- **Redis + ioredis** — Sesiones y bloqueo por inactividad de 20 minutos
  (consulta en memoria, mucho más rápida que la BD tradicional por petición).
- **BullMQ + Redis** — Colas en segundo plano para el proceso diario de recursos;
  garantiza ejecución exactamente una vez al día aunque el servidor reinicie o
  haya múltiples instancias.
- **Socket.IO** — Comunicación en tiempo real; notificaciones instantáneas entre
  campamentos (p. ej. cuando una solicitud de traslado llega a su destino).
- **JWT + Passport** — Autenticación stateless; Passport gestiona estrategias y
  los Guards que protegen cada ruta según el rol.
- **bcrypt** — Hash de contraseñas; las vuelve ilegibles ante posibles fugas.
- **Cloudinary** — Almacenamiento de imágenes en la nube (fotos de
  supervivientes, logos de campamentos).
- **Helmet + xss** — Cabeceras de seguridad HTTP automáticas y sanitización de
  entradas contra inyección de código.
- **Swagger (OpenAPI)** — Documentación interactiva de la API en `/api/v1/docs`.
- **Jest + Playwright** — Jest para pruebas unitarias; Playwright para E2E
  validando flujos críticos como un usuario real.

---

## 2. Diccionario de la Base de Datos (24 tablas)

Modelo multi-campamento donde la trazabilidad y la integridad son pilares.

- **camp** — Tabla raíz. Cada campamento base con capacidad máxima y ubicación.
  Todo (inventario, personas, viajes) se filtra por su ID para no mezclar datos.
- **person** — Cada superviviente. Estado de salud (activo, enfermo, herido,
  fallecido), nivel de experiencia, logros y resultado de la evaluación de la IA.
- **user_account** — Acceso al software. Vincula a una persona física con un
  usuario, sus credenciales encriptadas y su rol dentro del campamento.
- **role** — Permisos de acceso: administrador, trabajador, gestión de recursos,
  encargado de viajes. Control por niveles de autorización.
- **profession** — Catálogo de oficios. Define cuánto produce cada trabajador al
  día (comida/agua) y cuántos trabajadores mínimos requiere el área.
- **inventory** — Stock actual por campamento. Llave compuesta para evitar
  duplicados; umbrales mínimos para alertas automáticas de escasez.
- **inventory_movement** — Historial inmutable de entradas y salidas. Cada ración
  consumida o producida con su motivo exacto; auditoría completa.
- **resource** — Tipos de suministros (Comida, Agua, Medicina, Munición, etc.);
  flexible para agregar nuevos.
- **exploration** — Viajes fuera de la base: destino, días estimados y días de
  gracia antes de declarar al grupo perdido.
- **exploration_person** — Unión: qué supervivientes participan en una expedición;
  se marcan como "fuera del campamento" para no consumir recursos internos.
- **exploration_resource** — Suministros llevados y recursos nuevos traídos de
  vuelta al finalizar la misión.
- **intercamp_request** — Solicitudes de ayuda entre campamentos. Estado
  (pendiente, aprobada, rechazada, completada).
- **approval** — Firmas de los encargados de origen y destino. Doble aprobación
  obligatoria para que un traslado sea legal.
- **request_resource_detail** — Manifiesto de carga: qué recursos y en qué
  cantidad se envían de una base a otra.
- **request_person_detail** — Qué supervivientes se trasladan; sus datos
  (historial y XP) viajan con ellos.
- **ai_admission** — Historial de solicitudes de ingreso. Datos del candidato y
  reporte técnico de la IA que justifica aceptación o rechazo.
- **temporary_assignment** — Cuando una persona asume temporalmente otra profesión
  (p. ej. un recolector cubriendo a un médico herido) para no detener la base.
- **audit_log** — Corazón de la transparencia. Cada cambio con valor anterior y
  nuevo: quién movió recursos o personas.
- **session** — Historial de accesos; salida voluntaria o por bloqueo de
  inactividad de 20 minutos.
- **login_attempt** — Registra fallos de contraseña y bloquea temporalmente IPs
  ante ataques de diccionario.
- **daily_production / daily_consumption** — Excepciones de producción o consumo
  (p. ej. ajustar agua manualmente en sequía).
- **asset** — Catálogo de medallas/insignias (p. ej. "Sobrevivir 5 expediciones").
- **user_asset** — Vincula logros con personas; cada usuario elige qué medallas
  mostrar en su perfil (gamificación).

---

## 3. Cumplimiento de Requerimientos

### 3.1 Bloqueo de sesión por inactividad de 20 minutos
Control de estado en tiempo real con **Redis**, no solo expiración de JWT. Al
iniciar sesión se crea una llave `session:userId` con TTL de 1200 s. Un
`SessionActivityInterceptor` reinicia el contador en cada petición válida; un
`SessionInactivityGuard` verifica la llave antes de cada controlador. Si pasaron
20 minutos, Redis borra la llave y el Guard responde 401, forzando re-login a
nivel backend.

### 3.2 Ingreso asistido por IA (explicabilidad / "Caja de Cristal")
Motor híbrido y auditable, no caja negra:
- **NestJS (60%)** evalúa datos matemáticos: capacidad >95%, déficit de comida,
  si la profesión del candidato ayuda al déficit.
- **Microservicio Python (40%)** usa NLP (spaCy) sobre la historia del
  superviviente para detectar riesgo (enfermedades, mentiras, trauma).
- El resultado es un JSON extenso en `ai_admission` con el puntaje de cada rubro y
  una justificación. El administrador humano lee el reporte y emite una
  `final_human_decision` que puede contradecir a la IA; todo se guarda para
  auditoría.

### 3.3 Asignación automática de ID y profesión
Al aprobar el ingreso, `AdmissionReviewService` genera el código único
`SURVIVOR-XXX` y, contando trabajadores activos por profesión vs. el mínimo
requerido en `profession`, inserta a la persona en la profesión con mayor déficit
de personal.

### 3.4 Arquitectura orientada a servicios y API versionada
Backend 100% aislado en NestJS, sin renderizado de vistas. Prefijo global
`/api/v1`. Swagger en `/api/v1/docs` con decoradores en DTOs y controladores.

### 3.5 Gestión de múltiples campamentos (aislamiento)
Arquitectura multi-tenant. Todas las tablas operativas tienen FK obligatoria
`camp_id`. El `camp_id` del usuario viaja en el JWT y se inyecta forzosamente en
cada consulta, imposibilitando ver recursos de otra base. El cambio de campamento
usa `PATCH /auth/switch-camp`, que destruye el token actual y emite uno nuevo,
obligando al frontend a recargar el contexto y volver al inicio.

### 3.6 Hora única centralizada
La API en la nube corre en UTC. El módulo `HealthModule` expone
`/health/server-time`. El frontend consulta ese endpoint y todas las validaciones
(duración de expediciones, hora de aprobación de traslados) se sellan con el
timestamp inmutable del servidor (NestJS + PostgreSQL), evitando fraudes por
cambio de hora local.

### 3.7 Inventario: proceso diario automático y alertas
Cola de trabajos con **BullMQ + Redis**; Cron Job a medianoche que barre todos los
campamentos:
- Filtra personas `active` con `can_work = true`.
- Suma lo que produce su profesión.
- Suma todos los habitantes (activos, heridos, enfermos) y descuenta 2 raciones de
  comida y 3 de agua. Resultados en `inventory_movement`.
La vista SQL `vw_inventory_alert` compara `current_quantity` con
`minimum_stock_required` y expone alertas al Dashboard al instante.

### 3.8 Exploraciones y consumo extra de raciones
Transacciones atómicas (TypeORM QueryRunner). Al crear la exploración se calcula
`días × personas × consumo diario` y se descuenta del inventario (rollback si
falla). Los supervivientes pasan a estado `exploring` para que el Cron los ignore.
Al registrar el retorno, otra transacción suma lo encontrado (`exploration_in`) y
devuelve a las personas a `active`.

### 3.9 Traslados intercampamento (doble aprobación y auditoría)
`TransfersModule`. El traslado nace `pending`; requiere dos firmas en `approval`
(origen y destino). Con la segunda firma se descuentan recursos del origen, se
calculan raciones de viaje y las personas pasan a `traveling`. Todo se registra en
`audit_log` (JSON con qué se movió, quién autorizó y a qué hora).

### 3.10 Roles de usuario y restricción (RBAC)
Decorador `@Roles()` + `RolesGuard`. Cuatro roles: administrador, trabajador,
gestión de recursos, encargado de viajes. Si un rol no autorizado accede a una
ruta restringida, el Guard responde 403.

### 3.11 Gamificación (niveles y logros)
El backend maneja los Puntos de Experiencia (XP): +50 / +25 XP al completar
misiones de exploración o traslado. Al acumular XP la persona sube de nivel.
Medallas en `asset` (p. ej. "Veterano del Páramo") se otorgan automáticamente al
superar 5 expediciones.

### 3.12 Pruebas automáticas E2E
Suite en `e2e-playwright` con pruebas críticas que se comunican directamente con
la API levantada: registro de usuarios, transferencias completas de recursos y
rechazo de tokens vencidos.

---

## 4. Despliegue
- API: nube (Render) + base de datos (Supabase), accesible públicamente para la
  defensa, documentada con Swagger en `/api/v1/docs`.
- Frontend: desplegado en Vercel (requisito del enunciado), repositorio público.
