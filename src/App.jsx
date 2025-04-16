import { useState, useEffect } from "react";
import {
  ArrowLeftRight,
  Database,
  FileText,
  Check,
  X,
  Upload,
  Download,
  Table,
} from "lucide-react";
import { motion } from "framer-motion";
import axios from "axios";

function App() {
  const [source, setSource] = useState("clickhouse");
  const [target, setTarget] = useState("file");
  const [connectionStatus, setConnectionStatus] = useState("idle");
  const [clickhouseConfig, setClickhouseConfig] = useState({
    host: "",
    port: "8443",
    token: "",
    database: "default",
  });
  const [fileConfig, setFileConfig] = useState({
    delimiter: ",",
    filename: "",
  });
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [availableColumns, setAvailableColumns] = useState([]);
  const [availableTables, setAvailableTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState("");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [joinTables, setJoinTables] = useState([]);
  const [joinCondition, setJoinCondition] = useState("");
  const [previewData, setPreviewData] = useState([]);
  const [showPreview, setShowPreview] = useState(false);

  const handleSwapDirection = () => {
    setSource(target);
    setTarget(source);
    setConnectionStatus("idle");
    setSelectedColumns([]);
    setAvailableColumns([]);
    setAvailableTables([]);
    setSelectedTable("");
    setResult(null);
    setProgress(0);
    setJoinTables([]);
    setJoinCondition("");
    setPreviewData([]);
    setShowPreview(false);
  };

  const validateConfig = () => {
    const newErrors = {};

    // Require ClickHouse config if either source or target is ClickHouse
    if (source === "clickhouse" || target === "clickhouse") {
      if (!clickhouseConfig.host) newErrors.host = "Host is required";
      if (!clickhouseConfig.port) newErrors.port = "Port is required";
      if (!clickhouseConfig.token) newErrors.token = "Token is required";
    }

    if (source === "file") {
      if (!uploadedFile) newErrors.file = "File is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleConnect = async () => {
    if (!validateConfig()) return;

    try {
      setConnectionStatus("connecting");

      if (source === "clickhouse" || target === "clickhouse") {
        const response = await axios.post("/api/ingest/connect", {
          host: clickhouseConfig.host,
          port: clickhouseConfig.port,
          username: "default",
          password: clickhouseConfig.token,
          database: clickhouseConfig.database,
        });

        if (response.data.success) {
          const tablesResponse = await axios.post("/api/ingest/tables", {
            host: clickhouseConfig.host,
            port: clickhouseConfig.port,
            username: "default",
            password: clickhouseConfig.token,
            database: clickhouseConfig.database,
          });

          setAvailableTables(tablesResponse.data.tables);
          setConnectionStatus("connected");
        }
      } else {
        // For file source with file target, we don't need to connect to anything
        setConnectionStatus("connected");
      }
    } catch (err) {
      console.error("Connection error:", err);
      setConnectionStatus("failed");
      setResult({
        success: false,
        message: err.response?.data?.message || "Connection failed",
      });
    }
  };

  const handleLoadColumns = async () => {
    try {
      let columns = [];

      if (source === "clickhouse" && selectedTable) {
        const response = await axios.post("/api/ingest/columns", {
          host: clickhouseConfig.host,
          port: clickhouseConfig.port,
          username: "default",
          password: clickhouseConfig.token,
          database: clickhouseConfig.database,
          table: selectedTable,
        });
        columns = response.data.columns;
      } else if (source === "file" && uploadedFile) {
        const content = await readFileAsText(uploadedFile);
        const lines = content.split("\n");
        const headers = lines[0].split(fileConfig.delimiter || ",");
        columns = headers;
      }

      setAvailableColumns(columns);
      setSelectedColumns(columns);
    } catch (err) {
      console.error("Column load error:", err);
      setResult({
        success: false,
        message: err.response?.data?.message || "Failed to load columns",
      });
    }
  };

  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setFileConfig({ ...fileConfig, filename: file.name });
    }
  };

  const handlePreviewData = async () => {
    try {
      setShowPreview(true);

      if (
        source === "clickhouse" &&
        selectedTable &&
        selectedColumns.length > 0
      ) {
        const response = await axios.post("/api/ingest/preview", {
          host: clickhouseConfig.host,
          port: clickhouseConfig.port,
          username: "default",
          password: clickhouseConfig.token,
          database: clickhouseConfig.database,
          table: selectedTable,
          columns: selectedColumns,
          joinTables,
          joinCondition,
        });
        setPreviewData(response.data.data);
      } else if (source === "file" && uploadedFile) {
        const content = await readFileAsText(uploadedFile);
        const lines = content.split("\n");
        const headers = lines[0].split(fileConfig.delimiter || ",");
        const data = lines.slice(1, 6).map((line) => {
          const values = line.split(fileConfig.delimiter || ",");
          return headers.reduce((obj, header, index) => {
            obj[header] = values[index];
            return obj;
          }, {});
        });
        setPreviewData(data);
      }
    } catch (err) {
      console.error("Preview error:", err);
      setResult({
        success: false,
        message: err.response?.data?.message || "Failed to preview data",
      });
    }
  };

  const handleStartIngestion = async () => {
    if (
      (target === "clickhouse" && !selectedTable) ||
      (source === "clickhouse" && !selectedTable)
    ) {
      setResult({ success: false, message: "Please select a table" });
      return;
    }

    if (selectedColumns.length === 0) {
      setResult({
        success: false,
        message: "Please select at least one column",
      });
      return;
    }

    setProgress(0);
    setResult(null);

    try {
      if (source === "clickhouse" && target === "file") {
        const response = await axios.post("/api/ingest/download", {
          host: clickhouseConfig.host,
          port: clickhouseConfig.port,
          username: "default",
          password: clickhouseConfig.token,
          database: clickhouseConfig.database,
          table: selectedTable,
          columns: selectedColumns,
          joinTables,
          joinCondition,
        });

        // Simulate progress
        for (let i = 0; i <= 100; i += 10) {
          setProgress(i);
          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        setResult({
          success: true,
          message: `Exported ${response.data.count} rows to ${response.data.filename}`,
        });
      } else if (source === "file" && target === "clickhouse") {
        const formData = new FormData();
        formData.append("file", uploadedFile);

        const uploadResponse = await axios.post(
          "/api/ingest/upload",
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
          }
        );

        const insertResponse = await axios.post("/api/ingest/insert", {
          host: clickhouseConfig.host,
          port: clickhouseConfig.port,
          username: "default",
          password: clickhouseConfig.token,
          database: clickhouseConfig.database,
          table: selectedTable || "default_table",
          filename: uploadResponse.data.filename,
          columns: selectedColumns,
          delimiter: fileConfig.delimiter,
        });

        setResult({
          success: true,
          message: `Inserted ${insertResponse.data.count} rows into ${insertResponse.data.table}`,
        });
      }
    } catch (err) {
      console.error("Ingestion error:", err);
      setResult({
        success: false,
        message: err.response?.data?.message || "Ingestion failed",
      });
    }
  };

  return (
    <div className="min-h-screen w-full flex justify-center items-start bg-gradient-to-br from-indigo-50 via-white to-purple-50 py-12 px-4">
      <div className="w-full max-w-5xl space-y-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Data Ingestion Tool
          </h1>
          <p className="text-gray-600">
            Seamlessly transfer data between ClickHouse and Flat Files
          </p>
        </div>

        {/* Source/Target Selector */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg p-8 border border-gray-100"
        >
          <div className="flex items-center justify-center space-x-6">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-3">
                {source === "clickhouse" ? (
                  <Database className="h-5 w-5 text-indigo-600" />
                ) : (
                  <FileText className="h-5 w-5 text-indigo-600" />
                )}
                <span className="font-medium text-gray-700">Source</span>
              </div>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white"
              >
                <option value="clickhouse">ClickHouse</option>
                <option value="file">Flat File</option>
              </select>
            </div>

            <div className="flex flex-col items-center space-y-2">
              <button
                onClick={handleSwapDirection}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
              >
                <ArrowLeftRight className="h-6 w-6 text-indigo-600" />
              </button>
              <span className="text-sm text-gray-500">Swap</span>
            </div>

            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-3">
                {target === "clickhouse" ? (
                  <Database className="h-5 w-5 text-indigo-600" />
                ) : (
                  <FileText className="h-5 w-5 text-indigo-600" />
                )}
                <span className="font-medium text-gray-700">Target</span>
              </div>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white"
              >
                <option value="file">Flat File</option>
                <option value="clickhouse">ClickHouse</option>
              </select>
            </div>
          </div>
        </motion.div>

        {/* Connection Forms */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl shadow-lg p-8 border border-gray-100"
        >
          {/* Show ClickHouse config if either source or target is ClickHouse */}
          {(source === "clickhouse" || target === "clickhouse") && (
            <div className="space-y-6 mb-6">
              <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                <Database className="h-5 w-5 text-indigo-600" />
                {source === "clickhouse" ? "Source" : "Target"} ClickHouse
                Configuration
              </h3>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <input
                    type="text"
                    placeholder="Host"
                    value={clickhouseConfig.host}
                    onChange={(e) =>
                      setClickhouseConfig({
                        ...clickhouseConfig,
                        host: e.target.value,
                      })
                    }
                    className={`w-full rounded-lg border-gray-300 ${errors.host ? "border-red-500" : ""}`}
                  />
                  {errors.host && (
                    <p className="mt-1 text-sm text-red-600">{errors.host}</p>
                  )}
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Port"
                    value={clickhouseConfig.port}
                    onChange={(e) =>
                      setClickhouseConfig({
                        ...clickhouseConfig,
                        port: e.target.value,
                      })
                    }
                    className={`w-full rounded-lg border-gray-300 ${errors.port ? "border-red-500" : ""}`}
                  />
                  {errors.port && (
                    <p className="mt-1 text-sm text-red-600">{errors.port}</p>
                  )}
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Database"
                    value={clickhouseConfig.database}
                    onChange={(e) =>
                      setClickhouseConfig({
                        ...clickhouseConfig,
                        database: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border-gray-300"
                  />
                </div>
                <div>
                  <input
                    type="password"
                    placeholder="JWT Token"
                    value={clickhouseConfig.token}
                    onChange={(e) =>
                      setClickhouseConfig({
                        ...clickhouseConfig,
                        token: e.target.value,
                      })
                    }
                    className={`w-full rounded-lg border-gray-300 ${errors.token ? "border-red-500" : ""}`}
                  />
                  {errors.token && (
                    <p className="mt-1 text-sm text-red-600">{errors.token}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Show File config if source is file */}
          {source === "file" && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-600" /> File
                Configuration
              </h3>
              <div>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className={`block w-full text-sm text-gray-700 ${errors.file ? "border-red-500" : ""}`}
                />
                {errors.file && (
                  <p className="mt-1 text-sm text-red-600">{errors.file}</p>
                )}
                {uploadedFile && (
                  <p className="mt-2 text-sm text-gray-600">
                    Selected: {uploadedFile.name}
                  </p>
                )}
              </div>
              <input
                type="text"
                placeholder="Delimiter (default: ,)"
                value={fileConfig.delimiter}
                onChange={(e) =>
                  setFileConfig({ ...fileConfig, delimiter: e.target.value })
                }
                className="w-full rounded-lg border-gray-300"
              />
            </div>
          )}
        </motion.div>

        {/* Connect Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex justify-center"
        >
          <button
            onClick={handleConnect}
            disabled={connectionStatus === "connecting"}
            className={`px-6 py-3 rounded-lg font-medium text-white ${
              connectionStatus === "connected"
                ? "bg-green-600 hover:bg-green-700"
                : connectionStatus === "connecting"
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {connectionStatus === "connecting"
              ? "Connecting..."
              : connectionStatus === "connected"
                ? "Connected"
                : connectionStatus === "failed"
                  ? "Retry Connection"
                  : "Connect"}
          </button>
        </motion.div>

        {/* Table Selection (When ClickHouse is involved) */}
        {connectionStatus === "connected" &&
          (source === "clickhouse" || target === "clickhouse") && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-xl shadow-lg p-8 border border-gray-100"
            >
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                  <Table className="h-5 w-5 text-indigo-600" />
                  {source === "clickhouse" ? "Source" : "Target"} Table
                </h3>
                <select
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  className="w-full rounded-lg border-gray-300"
                >
                  <option value="">Select a table</option>
                  {availableTables.map((table) => (
                    <option key={table} value={table}>
                      {table}
                    </option>
                  ))}
                </select>

                {/* Join Tables Option (only for source ClickHouse) */}
                {source === "clickhouse" && selectedTable && (
                  <div className="space-y-4 mt-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={joinTables.length > 0}
                        onChange={(e) =>
                          setJoinTables(e.target.checked ? [selectedTable] : [])
                        }
                        className="mr-2"
                      />
                      Join with another table
                    </label>

                    {joinTables.length > 0 && (
                      <div className="space-y-4 pl-6 border-l-2 border-indigo-100">
                        <div>
                          <select
                            value={joinTables[1] || ""}
                            onChange={(e) =>
                              setJoinTables([joinTables[0], e.target.value])
                            }
                            className="w-full rounded-lg border-gray-300"
                          >
                            <option value="">Select second table</option>
                            {availableTables
                              .filter((t) => t !== joinTables[0])
                              .map((table) => (
                                <option key={table} value={table}>
                                  {table}
                                </option>
                              ))}
                          </select>
                        </div>

                        {joinTables.length > 1 && (
                          <div>
                            <input
                              type="text"
                              placeholder="Join condition (e.g., t1.id = t2.user_id)"
                              value={joinCondition}
                              onChange={(e) => setJoinCondition(e.target.value)}
                              className="w-full rounded-lg border-gray-300"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}

        {/* Column Selector */}
        {connectionStatus === "connected" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-xl shadow-lg p-8 border border-gray-100"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                {source === "clickhouse" ? (
                  <Database className="h-5 w-5 text-indigo-600" />
                ) : (
                  <FileText className="h-5 w-5 text-indigo-600" />
                )}
                {source === "clickhouse" ? "Source" : "File"} Columns
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={handleLoadColumns}
                  className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200"
                >
                  Load Columns
                </button>
                {availableColumns.length > 0 && (
                  <button
                    onClick={handlePreviewData}
                    className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
                  >
                    Preview Data
                  </button>
                )}
              </div>
            </div>

            {availableColumns.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {availableColumns.map((column) => (
                  <label
                    key={column}
                    className={`flex items-center p-2 rounded-lg ${selectedColumns.includes(column) ? "bg-indigo-50" : "hover:bg-gray-50"}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedColumns.includes(column)}
                      onChange={(e) =>
                        setSelectedColumns((prev) =>
                          e.target.checked
                            ? [...prev, column]
                            : prev.filter((c) => c !== column)
                        )
                      }
                      className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                    />
                    <span className="ml-3 text-sm text-gray-700">{column}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">
                {source === "clickhouse" && !selectedTable
                  ? "Select a table first"
                  : 'Click "Load Columns" to fetch available columns'}
              </p>
            )}
          </motion.div>
        )}

        {/* Data Preview */}
        {showPreview && previewData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-xl shadow-lg p-8 border border-gray-100"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Data Preview (First 5 rows)
              </h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {Object.keys(previewData[0]).map((header) => (
                      <th
                        key={header}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {previewData.map((row, i) => (
                    <tr key={i}>
                      {Object.values(row).map((value, j) => (
                        <td
                          key={j}
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                        >
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Ingestion & Progress */}
        {connectionStatus === "connected" && selectedColumns.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-xl shadow-lg p-8 border border-gray-100"
          >
            <div className="space-y-6">
              <button
                onClick={handleStartIngestion}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center w-full"
              >
                {source === "clickhouse" ? (
                  <>
                    <Download className="mr-2 h-5 w-5" />
                    Export to{" "}
                    {target === "clickhouse" ? "ClickHouse" : "Flat File"}
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-5 w-5" />
                    Import to ClickHouse
                  </>
                )}
              </button>

              {progress > 0 && progress < 100 && (
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5 }}
                    className="bg-indigo-500 h-2 rounded-full"
                  />
                </div>
              )}

              {result && (
                <div
                  className={`flex items-center p-4 rounded-lg ${result.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
                >
                  {result.success ? (
                    <Check className="mr-3 h-5 w-5" />
                  ) : (
                    <X className="mr-3 h-5 w-5" />
                  )}
                  {result.message}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default App;
