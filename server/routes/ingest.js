import express from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import csv from "csv-parser";
import { getClickHouseClient } from "../utils/clickhouse.js";
import { fileURLToPath } from "url";
import { pipeline } from "stream";
import { promisify } from "util";

const streamPipeline = promisify(pipeline);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();


// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../uploads"));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "text/csv" || file.mimetype === "text/plain") {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"), false);
    }
  },
});

// Test ClickHouse connection


router.post("/connect", async (req, res) => {
  const { host, port, username, password, database } = req.body;

  console.log("Received connection request with:", {
    host,
    port,
    username,
    password,
    database,
  });

  if (!host || !port || !password) {
    return res.status(400).json({
      success: false,
      message: "Host, port, and token are required",
    });
  }

  try {
    const client = getClickHouseClient({
      host,
      port,
      username: username || "default",
      password,
    });

    
    const resultSet = await client.query({
      query: "SELECT 1",
      format: "JSONEachRow",
    });
    const result = await resultSet.json();

    console.log("ClickHouse test query result:", result);

    res.json({ success: true });
  } catch (err) {
    console.error("Connection error:", err); // full error trace
    res.status(500).json({
      success: false,
      message: "Failed to connect to ClickHouse: " + err.message,
    });
  }
});

// Get tables from ClickHouse
router.post("/tables", async (req, res) => {
  const { host, port, username, password, database } = req.body;

  try {
    const client = getClickHouseClient({
      host,
      port,
      username: username || "default",
      password,
    });

    

    const resultSet = await client.query({
      query: `SHOW TABLES FROM ${database || "default"}`,
      format: "JSONEachRow",
    });
    const result = await resultSet.json();
    const tables = result.map((row) => Object.values(row)[0]);

    res.json({ success: true, tables });
  } catch (err) {
    console.error("Tables fetch error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch tables: " + err.message,
    });
  }
});

// Get columns from ClickHouse table
router.post("/columns", async (req, res) => {
  const { host, port, username, password, database, table } = req.body;

  try {
    const client = getClickHouseClient({
      host,
      port,
      username: username || "default",
      password,
    });

    
    const resultSet = await client.query({
      query: `DESCRIBE TABLE ${database || "default"}.${table}`,
      format: "JSONEachRow",
    });
    const result = await resultSet.json();
    const columns = result.map((row) => row.name);

    res.json({ success: true, columns });
  } catch (err) {
    console.error("Columns fetch error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch columns: " + err.message,
    });
  }
});

// Preview data from ClickHouse
router.post("/preview", async (req, res) => {
  const {
    host,
    port,
    username,
    password,
    database,
    table,
    columns,
    joinTables,
    joinCondition,
  } = req.body;

  try {
    const client = getClickHouseClient({
      host,
      port,
      username: username || "default",
      password,
    });

    let query;
    if (joinTables?.length === 2 && joinCondition) {
      query = `SELECT ${columns.map((col) => `t1.${col}`).join(", ")} 
               FROM ${database || "default"}.${joinTables[0]} AS t1
               JOIN ${database || "default"}.${joinTables[1]} AS t2
               ON ${joinCondition}
               LIMIT 5`;
    } else {
      query = `SELECT ${columns.join(", ")} 
               FROM ${database || "default"}.${table} 
               LIMIT 5`;
    }

    
    const resultSet = await client.query({
      query,
      format: "JSONEachRow",
    });
    const result = await resultSet.json();
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("Preview error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to preview data: " + err.message,
    });
  }
});




// Upload file to server
router.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "No file uploaded",
    });
  }

  res.json({
    success: true,
    filename: req.file.filename,
    originalname: req.file.originalname,
  });
});



router.post("/download", async (req, res) => {
  const {
    host,
    port,
    username,
    password,
    database,
    table,
    columns,
    joinTables,
    joinCondition,
  } = req.body;

  if (!host || !port || !password || !table || !columns?.length) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields",
    });
  }

  try {
    const client = getClickHouseClient({
      host,
      port,
      username: username || "default",
      password,
    });

    const timestamp = Date.now();
    const filename = `export_${table}_${timestamp}.csv`;
    const filePath = path.join(__dirname, `../uploads/${filename}`);

    // Get row count
    const countQuery =
      joinTables?.length === 2 && joinCondition
        ? `SELECT count() AS count
           FROM ${database || "default"}.${joinTables[0]} AS t1
           JOIN ${database || "default"}.${joinTables[1]} AS t2
           ON ${joinCondition}`
        : `SELECT count() AS count FROM ${database || "default"}.${table}`;

    const countResultSet = await client.query({
      query: countQuery,
      format: "JSONEachRow",
    });
    const countResult = await countResultSet.json();
    const count = countResult[0]?.count || 0;

    // Build data export query
    const dataQuery =
      joinTables?.length === 2 && joinCondition
        ? `SELECT ${columns.map((col) => `t1.${col}`).join(", ")}
           FROM ${database || "default"}.${joinTables[0]} AS t1
           JOIN ${database || "default"}.${joinTables[1]} AS t2
           ON ${joinCondition}`
        : `SELECT ${columns.join(", ")} FROM ${database || "default"}.${table}`;

    const resultSet = await client.query({
      query: dataQuery,
      format: "CSVWithNames", // Get actual CSV output
    });

    const csvContent = await resultSet.text();
    console.log(csvContent);
    await fs.promises.writeFile(filePath, csvContent);

    return res.json({
      success: true,
      message: "Export complete",
      filename,
      count,
    });
  } catch (err) {
    console.error("Export error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to export data: " + err.message,
    });
  }
});

// Import data from CSV to ClickHouse
router.post("/insert", async (req, res) => {
  const {
    host,
    port,
    username,
    password,
    database,
    table,
    filename,
    columns,
    delimiter,
  } = req.body;

  if (!host || !port || !password || !filename || !columns?.length) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields",
    });
  }

  const client = getClickHouseClient({
    host,
    port,
    username: username || "default",
    password,
  });

  const filePath = path.join(__dirname, `../uploads/${filename}`);
  console.log("Looking for uploaded file at:", filePath);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      message: "Uploaded file not found",
    });
  }

  try {
    const rows = [];
    let count = 0;

    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(
          csv({
            separator: delimiter || ",",
            mapHeaders: ({ header }) => header.trim(),
          })
        )
        .on("data", (data) => {
          const filtered = {};
          columns.forEach((col) => {
            if (data[col] !== undefined) {
              filtered[col] = data[col];
            }
          });
          rows.push(filtered);
          count++;

          // Batch insert every 1000 rows to avoid memory issues
          if (rows.length >= 1000) {
            client
              .insert({
                table: table || "default_table",
                values: rows,
                format: "JSONEachRow",
              })
              .catch(reject);
            rows.length = 0; // Clear the array
          }
        })
        .on("end", async () => {
          // Insert remaining rows
          if (rows.length > 0) {
            await client.insert({
              table: table || "default_table",
              values: rows,
              format: "JSONEachRow",
            });
          }
          resolve();
        })
        .on("error", reject);
    });

    res.json({
      success: true,
      message: "Data imported successfully",
      count,
      table: table || "default_table",
    });
  } catch (err) {
    console.error("Import error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to import data: " + err.message,
    });
  }
});

export default router;





