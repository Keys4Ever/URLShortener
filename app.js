import { createClient } from "@libsql/client";
import cors from 'cors';
import { nanoid } from 'nanoid';
import express from "express";
import dotenv from 'dotenv';

const app = express();
dotenv.config();

// Use CORS middleware to allow requests from any origin
app.use(cors({
  origin: '*'
}));

// Middleware to parse JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to the Turso database
export const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_DATABASE_TOKEN,
});

// Function to look up a shortened URL
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

// Serve static files from the public folder
app.use(express.static("public"));

// Route to serve the main HTML page
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// Function to check if a shortened URL already exists
async function alreadyExists(thing) {
  const result = await turso.execute({
    sql: "SELECT original_url FROM shortened_urls WHERE id = (:_id)",
    args: { _id: thing },
  });
  return result.rowsAffected > 0;
}

// POST endpoint to create a new shortened URL
app.post('/shortUrl', async (req, res) => {
  try {
    let originalUrl = req.body.originalUrl;
    let wantedUrl = req.body.wantedUrl;

    if (!originalUrl) {
      return res.status(400).json({ error: "The original URL is required." });
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
        return res.status(409).json({ error: "The desired URL already exists. Please try another." });
      } else {
        id = wantedUrl;
      }
    }

    const response = await turso.execute({
      sql: "INSERT INTO shortened_urls (id, original_url) VALUES (:_id, :_original_url)",
      args: { _id: id, _original_url: originalUrl },
    });

    if (response.rowsAffected > 0) {
      res.status(201).json({ id, shortenedUrl: `https://cositoshort.vercel.app/${id}` });
    } else {
      res.status(500).json({ error: "Unable to create the shortened URL." });
    }
  } catch (error) {
    if (error.message.includes("SQLITE_CONSTRAINT: SQLite error: UNIQUE constraint failed: shortened_urls.id")) {
      res.status(409).json({ error: "The desired URL is already in use. Please try another." });
    } else {
      res.status(500).json({ error: error.message });
      console.log(error);
    }
  }
});

// Redirect to the original URL when a shortened URL is accessed
app.get("/:shortenedUrl", async (req, res) => {
  try {
    const originalUrl = await lookForUrl(req.params.shortenedUrl);
    res.redirect(originalUrl);
  } catch (error) {
    res.status(error.status || 404).send(error.message);
  }
});

// API endpoint to get the original URL with a shortened URL
app.get("/api/original-url/:shortenedUrl", async (req, res) => {
  try {
    const originalUrl = await lookForUrl(req.params.shortenedUrl);
    res.json({ originalUrl });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
