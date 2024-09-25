import express from "express";
import path from 'path';
import cors from 'cors';
import { nanoid } from 'nanoid';
import dotenv from 'dotenv';
import { createClient } from "@libsql/client";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config();
const app = express();
const allowedOrigins = ['https://keys.lat'];
app.use(cors({
  origin: function (origin, callback) {
    if (allowedOrigins.includes(origin) || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Connect to the Turso database
export const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_DATABASE_TOKEN,
});

// Look for a shortened URL.
async function lookForUrl(id) {
  const response = await getOriginalUrl(id);
  if (response.rows.length === 0) {
    throw new Error("404. URL not found.");
  }
 updateClicks(id);

  return response.rows[0][0];
}

async function getOriginalUrl(id){
  return await turso.execute({
    sql: "SELECT original_url FROM shortened_urls WHERE id = (:_id)",
    args: { _id: id },
  });
}

async function updateClicks(id){
  await turso.execute({
    sql: "UPDATE shortened_urls SET clicks = clicks + 1 WHERE id = (:_id)",
    args: { _id: id },
  })
}

async function alreadyExists(thing){

  const reservedWords = ["login", "register", "profile", "mangalibrary", "successful", "404", "index"];
  if (reservedWords.includes(thing)) {
    return 1;
  }
  const result = await getOriginalUrl(thing);
  return result.rowsAffected > 0;
}

async function insertUrl(id, originalUrl){
      return await turso.execute({
      sql: "INSERT INTO shortened_urls (id, original_url, clicks) VALUES (:_id, :_original_url, 0);",
      args: { _id: id, _original_url: originalUrl },
    });
}

async function generateUrl(){
  let id = nanoid(5);
  while (await alreadyExists(id)) {
    id = nanoid(5);
  }
  return id;
}


app.get("/MangaLibrary", ( req, res)=>{
  res.sendFile(__dirname + "/public/mangaLibrary-privpolicy.html");
})
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// Post method to create a new shortened URL.
app.post('/shortUrl', async (req, res) => {
  try {
      let originalUrl = req.body.originalUrl;
      let wantedUrl = req.body.wantedUrl;

      if (!originalUrl) {
        return res.status(400).send("La URL original es requerida.");
      } else if (!originalUrl.startsWith('https://') && !originalUrl.startsWith('http://')) {
        originalUrl = `https://${originalUrl}`;
      }

      
      let id;
      if (wantedUrl) {
        if (await alreadyExists(wantedUrl)) {
          return res.status(409).json("La URL solicitada ya existe o es una palabra reservada. Por favor, intenta usar otra.");
        }
        id = wantedUrl;
      } else {
        id = await generateUrl();
      }



      if (await alreadyExists(wantedUrl)) {
        return res.status(409).json("La URL solicitada ya existe o es una palabra reservada. Por favor, intenta usar otra.");
      } 
      const response = await insertUrl(id, originalUrl);

      if (response.rowsAffected > 0) {
        res.status(201).json({ id, shortenedUrl: `https://keys.lat/${id}` });
      } else {
        res.status(500).json({ message: "No se pudo crear la URL acortada." });
      }
    } catch (error) {
      if (error.message.includes("SQLITE_CONSTRAINT: SQLite error: UNIQUE constraint failed: shortened_urls.id")) {
        res.status(409).json({ message: "La URL deseada ya está en uso o es una palabra reservada. Por favor, intenta usar otra." });
      } else {
        console.error(error);
        res.status(500).json({ message: "Error interno del servidor." });
      }
    }    
});

app.get("/:shortenedUrl", async (req, res) => {
  try {
    const originalUrl = await lookForUrl(req.params.shortenedUrl);
    res.redirect(originalUrl);
  } catch (error) {
    console.error(error);
    res.status(404);
    res.sendFile(__dirname + "/public/404.html");
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

// Export the Express app for Vercel
export default app;