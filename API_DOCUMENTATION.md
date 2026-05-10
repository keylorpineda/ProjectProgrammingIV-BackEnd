# 📚 Guía de URLs y Enlaces - Gestión del Fin API

**Proyecto:** Gestión del Fin - Sistema de Gestión de Campamentos Post-Apocalípticos
**Última actualización:** 04 de Mayo, 2026

---

## 🌐 URLs Principales

### **Backend API (Producción en Render)**
- **URL Base:** `https://doomsday-system-api.onrender.com/api/v1`
- **Swagger Docs:** `https://doomsday-system-api.onrender.com/api/v1/docs`
- **Health Check:** `https://doomsday-system-api.onrender.com/api/v1/health`

### **Backend API (Entorno Local)**
- **URL Base:** `http://localhost:3000/api/v1`
- **Swagger Docs:** `http://localhost:3000/api/v1/docs`
- **Health Check:** `http://localhost:3000/api/v1/health`

### **Base de Datos (Supabase)**
- **Dashboard:** `https://supabase.com/dashboard/project/txfmjrhmqiuuxmhptemx`
- **Database Host:** `aws-0-us-west-2.pooler.supabase.com`
- **Database Name:** `postgres`

### **Cloudinary (Imágenes y Assets)**
- **Cloud Name:** `dq3sagbgi`
- **Media Library:** `https://console.cloudinary.com/console/c-dq3sagbgi/media_library`

### **Repositorio GitHub**
- **Backend:** `https://github.com/keylorpineda/ProjectProgrammingIV-BackEnd`

---

## 📡 Endpoints del API

### **🔐 Autenticación** (`/auth`)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/auth/login` | Iniciar sesión | ❌ |
| POST | `/auth/logout` | Cerrar sesión | ✅ |
| POST | `/auth/refresh` | Refrescar token | ❌ |
| GET | `/auth/session-status` | Estado de sesión | ✅ |

**Ejemplo Login:**
```bash
POST https://doomsday-system-api.onrender.com/api/v1/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "Admin@1234!"
}
```

---

### **🤖 IA - Admisiones** (`/ai`)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/ai/admissions/submit` | Enviar solicitud de admisión | ✅ |
| GET | `/ai/admissions/track/:code` | Rastrear admisión por código | ✅ |
| GET | `/ai/admissions/pending` | Listar admisiones pendientes | ✅ |
| GET | `/ai/admissions/:id` | Detalle de admisión | ✅ |
| POST | `/ai/admissions/:id/review` | Revisar y aprobar/rechazar | ✅ |

**Ejemplo Submit Admission:**
```bash
POST https://doomsday-system-api.onrender.com/api/v1/ai/admissions/submit
Authorization: Bearer {token}
Content-Type: application/json

{
  "camp_id": 1,
  "first_name": "John",
  "last_name": "Doe",
  "age": 30,
  "skills": ["Medical", "First Aid"],
  "health_status": 85,
  "reason_to_join": "I'm a doctor with experience in trauma."
}
```

---

### **🏕️ Campamentos** (`/camps`)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/camps` | Listar campamentos activos | ✅ |
| GET | `/camps/:id` | Detalle de campamento e inventario | ✅ |
| POST | `/camps` | Crear nuevo campamento | ✅ (Admin) |
| PATCH | `/camps/:id` | Actualizar campamento | ✅ (Admin) |
| DELETE| `/camps/:id` | Desactivar campamento | ✅ (Admin) |

**Ejemplo Crear Campamento:**
```bash
POST https://doomsday-system-api.onrender.com/api/v1/camps
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Campamento Esperanza",
  "location_lat": 9.93224,
  "location_lng": -84.07952,
  "max_capacity": 150
}
```

---

### **👥 Usuarios y Personas** (`/users`)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/users/persons` | Listar personas | ✅ |
| GET | `/users/persons/:id` | Detalle de persona | ✅ |
| PUT | `/users/persons/:id/status` | Cambiar estado (enfermo, herido, activo) | ✅ |
| GET | `/users/professions` | Listar profesiones | ✅ |
| GET | `/users/professions/alerts/needing-workers` | Profesiones sin trabajadores | ✅ |
| POST | `/users/temporary-assignments` | Crear asignación temporal | ✅ |
| GET | `/users/me/assigned-resources` | Recursos asignados al usuario | ✅ |

---

### **📦 Recursos e Inventario** (`/resources`)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/resources` | Listar tipos de recursos | ✅ |
| GET | `/resources/inventory/:campId` | Inventario actual del campamento | ✅ |
| GET | `/resources/inventory/:campId/alerts` | Alertas de recursos críticos | ✅ |
| POST | `/resources/movements` | Registrar movimiento (entrada/salida) | ✅ |
| POST | `/resources/daily-process/:campId` | Ejecutar proceso diario manual | ✅ |

---

### **🔄 Transferencias Inter-campamento** (`/transfers`)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/transfers/requests` | Crear solicitud (Recursos/Personas) | ✅ |
| GET | `/transfers/requests/:id` | Detalle de solicitud | ✅ |
| GET | `/transfers/requests/camp/:campId` | Solicitudes del campamento | ✅ |
| PATCH | `/transfers/requests/:id/approval` | Aprobar/rechazar (Doble Aprobación) | ✅ |
| GET | `/transfers/statistics/:campId` | Estadísticas de transferencias | ✅ |

---

### **🗺️ Exploraciones** (`/explorations`)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/explorations` | Crear exploración | ✅ |
| GET | `/explorations` | Listar exploraciones | ✅ |
| PATCH | `/explorations/:id/depart` | Marcar salida (En Progreso) | ✅ |
| PATCH | `/explorations/:id/return` | Registrar retorno con suministros | ✅ |

---

### **📊 Dashboard** (`/dashboard`)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/dashboard/:campId` | Métricas del campamento (según rol) | ✅ |

---

### **📤 Upload y Assets** (`/upload`)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/upload/person` | Subir foto de persona/identificación | ✅ |
| POST | `/upload/camp` | Subir mapa/logo de campamento | ✅ |

---

### **❤️ Health y Tiempo** (`/health`)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/health` | Health check general | ❌ |
| GET | `/health/server-time` | Hora oficial del servidor (UTC) | ❌ |

---

## 📋 Roles del Sistema

| Rol | Slug | Descripción |
|-----|------|-------------|
| Administrador | `admin` | Gestión de ingresos y visión global |
| Trabajador | `worker` | Operaciones básicas de inventario |
| Gestor Recursos | `resource_manager` | Traslados y bodega |
| Viajes y Comms | `travel_comms` | Exploraciones y pactos |

---

## 🧪 Postman y Pruebas

1. **Importar:** Usa el archivo `Postman_Collection.json` de la raíz.
2. **Variable Base:** Cambia `{{baseUrl}}` a `https://doomsday-system-api.onrender.com/api/v1`.
3. **Login First:** Ejecuta `/auth/login` y guarda el token en el environment.
