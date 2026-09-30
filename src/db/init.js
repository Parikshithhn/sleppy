const fs = require("fs");
const path = require("path");
const db = require("./index");

(async () => {
  try {
    const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
    await db.query(sql);
    console.log("Database initialized.");
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
})();
