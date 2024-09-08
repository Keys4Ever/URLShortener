import { createClient } from "@libsql/client";
import cors from "cors";
import { nanoid } from "nanoid";
import express from "express";
import dotenv from "dotenv";
import { auth } from "express-openid-connect";

dotenv.config();

const app = express();

// Configuración de autenticación con Auth0
const authConfig = {
  authRequired: false,
  auth0Logout: true,
  secret: process.env.AUTH0_SECRET, // Debe estar almacenado en una variable de entorno
  baseURL: "http://keys.lat",
  clientID: "E5baYMNpD1YDHuKiXh2A6yAYw58bGiiA",
  issuerBaseURL: "https://dev-b08mg8ad2fe7mbdr.us.auth0.com",
};

// Middleware de autenticación
app.use(auth(authConfig));

app.use(
  cors({
    origin: "*",
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Conectar con la base de datos Turso
export const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_DATABASE_TOKEN,
});

// Buscar una URL acortada
async function lookForUrl(id) {
  const response = await turso.execute({
    sql: "SELECT original_url FROM shortened_urls WHERE id = (:_id)",
    args: { _id: id },
  });
  if (response.rows.length === 0) {
    throw new Error("404. URL not found.");
  }
  return response.rows[0][0];
}

// Servir archivos estáticos desde la carpeta public
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

async function alreadyExists(thing) {
  const result = await turso.execute({
    sql: "SELECT original_url FROM shortened_urls WHERE id = (:_id)",
    args: { _id: thing },
  });
  return result.rowsAffected > 0;
}

// Endpoint para crear una nueva URL acortada
app.post("/shortUrl", async (req, res) => {
  try {
    let originalUrl = req.body.originalUrl;
    let wantedUrl = req.body.wantedUrl;

    if (!originalUrl) {
      return res.status(400).json({ error: "La URL original es requerida." });
    } else if (
      !originalUrl.startsWith("https://") &&
      !originalUrl.startsWith("http://")
    ) {
      originalUrl = `https://${originalUrl}`;
    }

    let id;
    if (!wantedUrl) {
      id = nanoid(5);
      while (await alreadyExists(id)) {
        id = nanoid(5);
      }
    } else {
      if (await alreadyExists(wantedUrl)) {
        return res
          .status(409)
          .json({
            error: "La URL solicitada ya existe. Por favor, intenta usar otra.",
          });
      } else {
        id = wantedUrl;
      }
    }

    const response = await turso.execute({
      sql: "INSERT INTO shortened_urls (id, original_url) VALUES (:_id, :_original_url)",
      args: { _id: id, _original_url: originalUrl },
    });

    if (response.rowsAffected > 0) {
      res.status(201).json({ id, shortenedUrl: `https://keys.lat/${id}` });
    } else {
      res.status(500).json({ error: "No se pudo crear la URL acortada." });
    }
  } catch (error) {
    if (
      error.message.includes(
        "SQLITE_CONSTRAINT: SQLite error: UNIQUE constraint failed: shortened_urls.id"
      )
    ) {
      res
        .status(409)
        .json({
          error: "La URL deseada ya está en uso. Por favor, intenta usar otra.",
        });
    } else {
      console.error(error);
      res.status(500).json({ error: "Error interno del servidor." });
    }
  }
});

// Redirigir a la URL original cuando se accede a una URL acortada
app.get("/:shortenedUrl", async (req, res) => {
  try {
    const originalUrl = await lookForUrl(req.params.shortenedUrl);
    res.redirect(originalUrl);
  } catch (error) {
    res.status(error.status || 404).send(error.message);
  }
});

// Endpoint de API para obtener la URL original con una URL acortada
app.get("/api/original-url/:shortenedUrl", async (req, res) => {
  try {
    const originalUrl = await lookForUrl(req.params.shortenedUrl);
    res.json({ originalUrl });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Ruta para verificar si el usuario está autenticado
app.get("/", (req, res) => {
  res.send(req.oidc.isAuthenticated() ? "Logged in" : "Logged out");
});

// Exportar la aplicación Express para Vercel
export default app;
