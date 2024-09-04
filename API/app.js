// Connect to the Turso database using the libsql client library for Node.js.
import { createClient } from "@libsql/client";

// Express setup
import express from "express";
const app = express();

//dotenv config to read environment variables from.env file
import dotenv from 'dotenv';
dotenv.config();

// Connect to the Turso database
export const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_DATABASE_TOKEN,
});

// Look for a shortened URL.
const asd = await turso.execute({
  sql: "SELECT original_url FROM shortened_urls WHERE id = (:id)",
  args: {id: "coso"},
});

//Log the original URL #TODO add a check.
const originalUrl = asd.rows[0].original_url;
console.log(originalUrl);