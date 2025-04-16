import { createClient } from "@clickhouse/client";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

(async () => {
  try {
    // Configuration - prefer environment variables for sensitive data
    const config = {
      url: process.env.CLICKHOUSE_URL,
      username: process.env.CLICKHOUSE_USER,
      password: process.env.CLICKHOUSE_PASSWORD,
      database: process.env.CLICKHOUSE_DB,
      tls: {
        // For production, you should specify CA certificate
        // ca_cert: process.env.CLICKHOUSE_CA_CERT,
        reject_unauthorized: process.env.NODE_ENV === "production", // Only false for development
      },
    };

    console.log("Attempting to connect to ClickHouse...");
    console.log(`Host: ${config.url}`);
    console.log(`User: ${config.username}`);

    // Create client with secure configuration
    const client = createClient({
      url: config.url,
      username: config.username,
      password: config.password,
      database: config.database,
      clickhouse_settings: {
        // Example settings
        async_insert: 1,
        wait_for_async_insert: 1,
      },
      tls: config.tls,
    });

    // Test connection with a simple query
    console.log("Executing test query...");
    const result = await client.query({
      query:
        "SELECT 1 AS test_value, currentDatabase() AS db, version() AS version",
      format: "JSONEachRow",
    });

    const data = await result.json();
    console.log("\nConnection successful! ClickHouse response:");
    console.log("-------------------------------------------");
    console.log(data);
    console.log("-------------------------------------------");
    console.log(`Database: ${data[0].db}`);
    console.log(`Version: ${data[0].version}`);

    // Additional verification - list tables
    const tables = await client.query({
      query: `SHOW TABLES FROM ${config.database}`,
      format: "JSONEachRow",
    });

    const tablesData = await tables.json();
    console.log("\nAvailable tables:");
    console.log("-----------------");
    tablesData.forEach((row, i) => {
      console.log(`${i + 1}. ${Object.values(row)[0]}`);
    });
  } catch (error) {
    console.error("\nConnection failed! Error details:");
    console.error("----------------------------------");
    console.error(error.message);

    if (error.code) {
      console.error(`Error code: ${error.code}`);
    }

    if (error.stack) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }

    process.exit(1); // Exit with error code
  } finally {
    process.exit(0); // Exit successfully
  }
})();
