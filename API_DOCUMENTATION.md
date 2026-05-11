# 📚 Guia de URLs y Enlaces - Gestion del Fin API

**Proyecto:** Gestion del Fin - Sistema de Gestion de Campamentos Post-Apocalipticos
**Ultima actualizacion:** 04 de Mayo, 2026

---

## 🌐 URLs Principales

### **Backend API (Produccion en Render)**
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

### **Cloudinary (Imagenes y Assets)**
- **Cloud Name:** `dq3sagbgi`
- **Media Library:** `https://console.cloudinary.com/console/c-dq3sagbgi/media_library`

### **Repositorio GitHub**
- **Backend:** `https://github.com/keylorpineda/ProjectProgrammingIV-BackEnd`

---

## 📡 Endpoints del API

### **🔐 Autenticacion** (`/auth`)

| Metodo | Endpoint | Descripcion | Auth |
|--------|----------|-------------|------|
| POST | `/auth/login` | Iniciar sesion | ❌ |
| POST | `/auth/logout` | Cerrar sesion | ✅ |
| POST | `/auth/refresh` | Refrescar token | ❌ |
| GET | `/auth/session-status` | Estado de sesion | ✅ |

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

| Metodo | Endpoint | Descripcion | Auth |
|--------|----------|-------------|------|
| POST | `/ai/admissions/submit` | Enviar solicitud de admision | ✅ |
| GET | `/ai/admissions/track/:code` | Rastrear admision por codigo | ✅ |
| GET | `/ai/admissions/pending` | Listar admisiones pendientes | ✅ |
| GET | `/ai/admissions/:id` | Detalle de admision | ✅ |
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

| Metodo | Endpoint | Descripcion | Auth |
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

| Metodo | Endpoint | Descripcion | Auth |
|--------|----------|-------------|------|
| GET | `/users/persons` | Listar personas | ✅ |
| GET | `/users/persons/:id` | Detalle de persona | ✅ |
| PUT | `/users/persons/:id/status` | Cambiar estado (enfermo, herido, activo) | ✅ |
| GET | `/users/professions` | Listar profesiones | ✅ |
| GET | `/users/professions/alerts/needing-workers` | Profesiones sin trabajadores | ✅ |
| POST | `/users/temporary-assignments` | Crear asignacion temporal | ✅ |
| GET | `/users/me/assigned-resources` | Recursos asignados al usuario | ✅ |

---

### **📦 Recursos e Inventario** (`/resources`)

| Metodo | Endpoint | Descripcion | Auth |
|--------|----------|-------------|------|
| GET | `/resources` | Listar tipos de recursos | ✅ |
| GET | `/resources/inventory/:campId` | Inventario actual del campamento | ✅ |
| GET | `/resources/inventory/:campId/alerts` | Alertas de recursos criticos | ✅ |
| POST | `/resources/movements` | Registrar movimiento (entrada/salida) | ✅ |
| POST | `/resources/daily-process/:campId` | Ejecutar proceso diario manual | ✅ |

---

### **🔄 Transferencias Inter-campamento** (`/transfers`)

| Metodo | Endpoint | Descripcion | Auth |
|--------|----------|-------------|------|
| POST | `/transfers/requests` | Crear solicitud (Recursos/Personas) | ✅ |
| GET | `/transfers/requests/:id` | Detalle de solicitud | ✅ |
| GET | `/transfers/requests/camp/:campId` | Solicitudes del campamento | ✅ |
| PATCH | `/transfers/requests/:id/approval` | Aprobar/rechazar (Doble Aprobacion) | ✅ |
| GET | `/transfers/statistics/:campId` | Estadisticas de transferencias | ✅ |

---

### **🗺️ Exploraciones** (`/explorations`)

| Metodo | Endpoint | Descripcion | Auth |
|--------|----------|-------------|------|
| POST | `/explorations` | Crear exploracion | ✅ |
| GET | `/explorations` | Listar exploraciones | ✅ |
| PATCH | `/explorations/:id/depart` | Marcar salida (En Progreso) | ✅ |
| PATCH | `/explorations/:id/return` | Registrar retorno con suministros | ✅ |

---

### **📊 Dashboard** (`/dashboard`)

| Metodo | Endpoint | Descripcion | Auth |
|--------|----------|-------------|------|
| GET | `/dashboard/:campId` | Metricas del campamento (segun rol) | ✅ |

---

### **📤 Upload y Assets** (`/upload`)

| Metodo | Endpoint | Descripcion | Auth |
|--------|----------|-------------|------|
| POST | `/upload/person` | Subir foto de persona/identificacion | ✅ |
| POST | `/upload/camp` | Subir mapa/logo de campamento | ✅ |

---

### **❤️ Health y Tiempo** (`/health`)

| Metodo | Endpoint | Descripcion | Auth |
|--------|----------|-------------|------|
| GET | `/health` | Health check general | ❌ |
| GET | `/health/server-time` | Hora oficial del servidor (UTC) | ❌ |

---

## 📋 Roles del Sistema

| Rol | Slug | Descripcion |
|-----|------|-------------|
| Administrador | `admin` | Gestion de ingresos y vision global |
| Trabajador | `worker` | Operaciones basicas de inventario |
| Gestor Recursos | `resource_manager` | Traslados y bodega |
| Viajes y Comms | `travel_comms` | Exploraciones y pactos |

---

## 🧪 Postman y Pruebas

1. **Importar:** Usa el archivo `Postman_Collection.json` de la raiz.
2. **Variable Base:** Cambia `{{baseUrl}}` a `https://doomsday-system-api.onrender.com/api/v1`.
3. **Login First:** Ejecuta `/auth/login` y guarda el token en el environment.
