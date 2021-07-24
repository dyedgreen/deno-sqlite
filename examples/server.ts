import { serve } from "https://deno.land/std@0.102.0/http/mod.ts";
import { DB } from "../mod.ts";

const db = new DB();

db.query(`
  CREATE TABLE visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    visited_at TEXT NOT NULL
  )
`);

const addVisit = db.prepareQuery<[]>(
  "INSERT INTO visits (url, visited_at) VALUES (:url, :time)",
);
const countVisits = db.prepareQuery<[number]>(
  "SELECT COUNT(*) FROM visits WHERE url = :url",
);

console.log("Running server on localhost:8080");
const server = serve({ port: 8080 });
for await (const req of server) {
  addVisit.execute({
    url: req.url,
    time: new Date(),
  });

  const [count] = countVisits.queryOne({ url: req.url });
  req.respond({ body: `You are the ${count} visitor on this page!` });
}
