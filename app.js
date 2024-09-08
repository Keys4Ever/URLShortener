import { createClient } from "@libsql/client";
import cors from 'cors';
import { nanoid } from 'nanoid';
import express from "express";
import dotenv from 'dotenv';
import { PORT } from "./utils.js";
import { auth } from 'express-openid-connect';
dotenv.config();

const config = {
  authRequired: false,
  auth0Logout: true,
  secret: process.env.SECRET,
  baseURL: process.env.BASEURL,
  clientID: process.env.CLIENTID,
  issuerBaseURL: process.env.ISSUER
};

const app = express();
app.use(auth(config));
app.use(cors({
  origin: '*'
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to the Turso database
export const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_DATABASE_TOKEN,
});

// Look for a shortened URL.
async function lookForUrl(id) {
  const response = await turso.execute({
    sql: "SELECT original_url FROM shortened_urls WHERE id = (:_id)",
    args: {_id: id},
  });
  if (response.rows.length === 0) {
    throw new Error("404. URL not found.");
  }
  return response.rows[0][0];
}

// Serve static files from the public folder.
app.use(express.static("public"));

app.get("/", (req, res) => {
//  res.sendFile(__dirname + "/public/index.html");
  console.log("nose: ", res.oidc.isAuthenticated());
});

async function alreadyExists(thing){
  const result = await turso.execute({
    sql: "SELECT original_url FROM shortened_urls WHERE id = (:_id)",
    args: {_id: thing},
  });
  return result.rowsAffected > 0;
}

// Post method to create a new shortened URL.
app.post('/shortUrl', async (req, res) => {
  try {
    let originalUrl = req.body.originalUrl;
    let wantedUrl = req.body.wantedUrl;

    if (!originalUrl) {
      return res.status(400).json({ error: "La URL original es requerida." });
    } else if (!originalUrl.startsWith('https://') && !originalUrl.startsWith('http://')) {
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
        return res.status(409).json({ error: "La URL solicitada ya existe. Por favor, intenta usar otra." });
      } else {
        id = wantedUrl;
      }
    }

    const response = await turso.execute({
      sql: "INSERT INTO shortened_urls (id, original_url) VALUES (:_id, :_original_url)",
      args: { _id: id, _original_url: originalUrl },
    });

    if (response.rowsAffected > 0) {
      res.status(201).json({ id, shortenedUrl: `https://localhost:3000/${id}` });
    } else {
      res.status(500).json({ error: "No se pudo crear la URL acortada." });
    }
  } catch (error) {
    if (error.message.includes("SQLITE_CONSTRAINT: SQLite error: UNIQUE constraint failed: shortened_urls.id")) {
      res.status(409).json({ error: "La URL deseada ya está en uso. Por favor, intenta usar otra." });
    } else {
      console.error(error);
      res.status(500).json({ error: "Error interno del servidor." });
    }
  }
});

// Redirect to the original URL when a shortened URL is accessed.
app.get("/:shortenedUrl", async (req, res) => {
  try {
    const originalUrl = await lookForUrl(req.params.shortenedUrl);
    res.redirect(originalUrl);
  } catch (error) {
    res.status(error.status || 404).send(error.message);
  }
});

// API endpoint to get the original url with a shortened URL.
app.get("/api/original-url/:shortenedUrl", async (req, res) => {
  try {
    const originalUrl = await lookForUrl(req.params.shortenedUrl);
    res.json({ originalUrl });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});


app.listen(PORT, ()=>{
  console.log(`Server running on port ${PORT}`)  // log the server running message on console
 });


// // Export the Express app for Vercel
// export default app;