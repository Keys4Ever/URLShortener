import { createClient } from "@libsql/client";
import cors from 'cors';
import { nanoid } from 'nanoid'
import express from "express";
const app = express();
import dotenv from 'dotenv';
dotenv.config();
app.use(cors());
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
  res.sendFile("/public/index");
});

// Post method to create a new shortened URL.
// #TODO make a html page for "shortUrl"
app.post('/shortUrl', async (req, res) => {
  try {
    let originalUrl = req.body.originalUrl;
    let wantedUrl = req.body.wantedUrl;
    if (!originalUrl) {
      return res.status(400).json({ error: "La URL original es requerida." });
    } else if (!originalUrl.startsWith('https://') || !originalUrl.startsWith('http://')) {
      originalUrl = `https://${originalUrl}`;
    }
    let id;
    if (!wantedUrl) {
      id = nanoid(5);
    } else {
      const newResponse = await turso.execute({
        sql: "SELECT id FROM shortened_urls WHERE id = :id",
        args: { id: wantedUrl },
      });
    
      if (newResponse.rows.length > 0) {
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
    res.status(500).json({ error: error.message });
  }
});

// Redirect to the original URL when a shortened URL is accessed.
app.get("/:shortenedUrl", async (req, res) => {
  try {
    const originalUrl = await lookForUrl(req.params.shortenedUrl);
    res.redirect(originalUrl);
  } catch (error) {
    res.status(error.status || 500).send(error.message);
  }
});


// API endpoint to get the original url with a shortened URL. Made for test, but maybe it can be a feature.
app.get("/api/original-url/:shortenedUrl", async (req, res) => {
  try {
    const originalUrl = await lookForUrl(req.params.shortenedUrl);
    res.json({ originalUrl });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});