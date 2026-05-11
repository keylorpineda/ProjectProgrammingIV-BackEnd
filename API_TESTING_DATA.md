# Guía de Pruebas y Datos Semilla para la API (Postman y Swagger)

Este documento contiene toda la información ("bloques de datos") requerida para poblar el sistema y probar los endpoints principales de la API, tanto en local (`http://localhost:3000/api`) como en el servidor de Render (`https://tu-api.onrender.com/api`).

## Formas de evaluar la API

### 1. Usando Swagger (Interfaz Gráfica)
Si el proyecto NestJS tiene `@nestjs/swagger` configurado (como se ve en el código), puedes acceder a la documentación automática iterativa.
1. Ejecuta el servidor de manera local (`npm run start:dev`).
2. Abre tu navegador en [http://localhost:3000/api](http://localhost:3000/api) (o la ruta que hayas configurado en `main.ts` como `v1/docs` o `api`).
3. Para cada endpoint:
   - Haz clic en el endpoint.
   - Haz clic en **"Try it out"**.
   - Ingresa o pega el JSON (bloque de información) en el cuerpo de la petición.
   - Haz clic en **"Execute"**.

### 2. Usando Postman
1. Crea una variable de entorno en Postman llamada `{{base_url}}`.
   - Para local, su valor será `http://localhost:3000/api` (o `http://localhost:3000/api/v1`).
   - Para producción, su valor será el de Render, por ejemplo: `https://doomsday-system-api.onrender.com/api/v1`.
2. Para cada endpoint bajo prueba, selecciona el método adecuado (`POST`, `GET`, `PATCH`, etc.), ingresa `{{base_url}}/el_endpoint`, ve a la pestaña **Body**, selecciona **raw** y **JSON**, y pega los datos.
3. Si el endpoint requiere autenticación, no olvides pegar el Token en la pestaña **Authorization** como `Bearer Token`.

---

## 🟩 BLOQUES DE INFORMACIÓN (DATOS PARA METER AL API)

Estos datos están pensados para insertarse en el siguiente orden lógico de dependencias.

### 1. Crear Campamentos (`POST /camps`)
Necesitamos lugares antes de asignar personas o inventarios.

**JSON (Postman - Body - Raw - JSON) / Swagger:**
```json
{
  "name": "Campamento Alpha",
  "location_description": "Ubicado en las ruinas geográficas del antiguo centro.",
  "max_capacity": 500,
  "latitude": 40.7128,
  "longitude": -74.0060,
  "active": true
}
```

```json
{
  "name": "Refugio Beta",
  "location_description": "Asentamiento subterráneo cerca a las montañas secas.",
  "max_capacity": 1500,
  "latitude": 39.7392,
  "longitude": -104.9903,
  "active": true
}
```

### 2. Crear Profesiones (`POST /users/professions`)
El personal de los refugios tendrá roles/oficios clave.

**Rescatista:**
```json
{
  "name": "Rescatista",
  "can_explore": true,
  "minimum_active_required": 5
}
```

**Médico:**
```json
{
  "name": "Médico General",
  "can_explore": false,
  "minimum_active_required": 2
}
```

**Ingeniero Agrónomo:**
```json
{
  "name": "Ingeniero Agrónomo",
  "can_explore": false,
  "minimum_active_required": 1
}
```

### 3. Crear Personas (`POST /users/persons`)
Añadir sobrevivientes. (Asegúrate de cambiar los IDs de `profession_id` por los que devolvió el paso anterior).

```json
{
  "first_name": "Joel",
  "last_name": "Miller",
  "profession_id": 1,
  "status": "active",
  "can_work": true,
  "experience_level": 5,
  "previous_skills": "Puntería avanzada, rastreo táctico, sigilo",
  "achievements": ["Sobreviviente Primer Invierno", "Maestro Cazador"]
}
```

```json
{
  "first_name": "Ellie",
  "last_name": "Williams",
  "profession_id": 2,
  "status": "active",
  "can_work": true,
  "experience_level": 3,
  "previous_skills": "Medicina básica, Inmunidad"
}
```

### 4. Crear Recursos Base (`POST /resources`)

**Agua Potable:**
```json
{
  "name": "Agua Tratada",
  "unit": "Litros",
  "category": "consumible",
  "description": "Agua filtrada mediante sistemas de ósmosis inversa, lista para consumo humano."
}
```

**Raciones de Comida (Latas):**
```json
{
  "name": "Ración MRE (Comida enlatada)",
  "unit": "Unidad",
  "category": "consumible",
  "description": "Raciones tipo militar C/D, alto contenido calórico."
}
```

**Municiones:**
```json
{
  "name": "Lata de munición 9mm",
  "unit": "Caja",
  "category": "armamento",
  "description": "Caja de cartuchos estándar 9x19mm Parabellum, caja de 50 unds."
}
```

**Antiobióticos:**
```json
{
  "name": "Amoxicilina",
  "unit": "Caja",
  "category": "medicina",
  "description": "Caja por 30 cápsulas de 500mg. Crucial en caso de infección."
}
```

### 5. Registrar Movimientos de Inventario Iniciales (`POST /resources/movements`) o Inicializar (`POST /resources/inventory/initialize/:campId`)

**Si el endpoint es `POST /resources/movements`:**

```json
{
  "camp_id": 1,
  "resource_id": 1,
  "movement_type": "in",
  "quantity": 500,
  "reason": "Inventario de reserva inicial del servidor"
}
```

```json
{
  "camp_id": 1,
  "resource_id": 2,
  "movement_type": "in",
  "quantity": 300,
  "reason": "Inventario de reserva inicial"
}
```

### 6. Sistema de Autorización (Testing Flujo Completo) (`POST /auth/login`)
Si tienes usuarios con contraseñas en tu semilla de DB (generalmente creados en un flujo o seeder oculto):

```json
{
  "username": "admin_alpha",
  "password": "Password123!"
}
```
**Nota en Postman/Swagger:** El servidor te retornará un `access_token` (JWT). Debes añadir este token en Postman en la pestaña **Authorization -> Bearer Token**, y en Swagger dándole clic al botón **Authorize** en la esquina superior derecha de la interfaz.

---

## 🌍 Ejemplos de uso para probar el resto de la App (Endpoints Específicos)

### 7. Enviar Solicitud de Admisión de AI (`POST /ai/admissions/submit`)
Para simular un formulario de la nueva IA:

```json
{
  "applicant_data": {
    "name": "Sarah Connor",
    "age": 33,
    "skills": "Habilidades de combate, armamento táctico",
    "health_status": "Ligeramente herida, sin infección aparente"
  },
  "answers": [
    { "question_id": 1, "answer": "Fui entrenada desde joven." },
    { "question_id": 2, "answer": "Puedo aguantar dolor prolongado." }
  ]
}
```

### 8. Crear Solicitud de Traslado / Expedición (`POST /transfers/requests`)
Simular expedición de recursos hacia el campamento 2:

```json
{
  "origin_camp_id": 1,
  "destination_camp_id": 2,
  "transfer_type": "resources",
  "priority": "high",
  "resources": [
    {
      "resource_id": 4, 
      "quantity": 10
    }
  ],
  "reason": "Brote menor en Refugio Beta, requieren antibióticos."
}
```

### 9. Cambiar Estado de una Persona (ej: Infección o Fallecimiento) (`PUT /users/persons/:id/status`)

```json
{
  "status": "infected",
  "notes": "Mordida sospechosa detectada después de su última ronda en el exterior. Confinamiento mandatorio ejecutado."
}
```

### 10. Actualizar Campamento (`PATCH /camps/:id`)

```json
{
  "active": false,
  "location_description": "CAMPAMENTO CAÍDO - LA ZONA ESTÁ INFESTADA"
}
```

---

## 📌 Guía Rápida: Postman vs Swagger

| Acción | 🔴 Postman | 🟢 Swagger |
| --- | --- | --- |
| **Configurar Base URL** | Usas las variables de entorno `{{base_url}}`. | La URL base ya es la actual (no tienes que configurarla manual). |
| **Autenticación (JWT)** | Solapa "Authorization", eliges "Bearer Token" y pegas el JWT. | Botón candado "Authorize" (arriba). Pegas y cierras. Se envía automático en la sesión. |
| **JSON a Enviar** | Solapa "Body" -> Selector "raw" -> Selector "(JSON)" -> Pegas el bloque de texto. | Dentro del endpoint, click en "Try it out". Sustituyes el Request Body con el JSON. |
| **Guardar Peticiones** | Debes crear colecciones manuales para guardar tu trabajo local. | Todo es estático documentado, te genera esquemas basados en los DTOs de NestJS. |

Estos JSON te permitirán crear desde la base la lógica completa de tu Backend de *Apolacalipsis Zombie / Gestión del fin*, probando desde la creación hasta las expediciones y consumo de inventarios.
