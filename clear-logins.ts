import { DataSource } from "typeorm";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, ".env") });

const ds = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432"),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },
});

ds.initialize()
  .then(async () => {
    console.log("Conectado a la base de datos...");
    await ds.query('DELETE FROM "login_attempt"');
    console.log(
      "Tabla login_attempt limpiada con éxito. Ya no deberías estar bloqueado.",
    );
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error al conectar:", err);
    process.exit(1);
  });
