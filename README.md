# Bidirectional ClickHouse & Flat File Data Ingestion Tool

This project is a web-based application that enables **bidirectional data ingestion** between a ClickHouse database and flat file (CSV) sources. It supports ingestion in both directions:

- **ClickHouse → Flat File**
- **Flat File → ClickHouse**

It features a simple UI for users to:
- Configure source and target settings
- Select specific columns for ingestion
- View schema details and preview data
- Monitor ingestion progress
- See a final record count after ingestion

---

## 🌐 Tech Stack

- **Frontend**: React, Tailwind CSS, Lucide Icons, Framer Motion
- **Backend**: Node.js, Express
- **Database**: ClickHouse (via the `clickhouse` npm package)

---


## ⚙️ Project Setup

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd <your-repo-folder>

```


### 2. Install Dependencies

In the root directory:

```bash
npm install

Then in the server directory:
cd server
npm install

```
### 3. Environment Configuration

Create a .env file inside the server directory and add the following variables:
```bash
PORT=
CLICKHOUSE_URL=https://your-clickhouse-host:8443
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=your-password
CLICKHOUSE_DB=default

```
### 4. Run the Project
```bash
In one terminal (for frontend):
npm run dev
In a second terminal (for backend):
cd server
npm run dev
📁 Folder Structure

├── public/
├── src/
│   ├── App.jsx
│   └── ...
├── server/
│   ├── server.js
│   ├── routes/
│   |── utils/  
|   └── .env
|     
├── package.json
└── README.md
```

> ⚠️ **Disclaimer**: This project was completed by **Khushal Goyal**, University Roll No. **2210991791**, from **Chitkara University**, as part of the **Software Engineering Internship Assignment**.  
> It is shared publicly **for educational and portfolio purposes only**.  
> **Do not copy, reuse, or submit this as your own assignment**. Doing so may constitute **plagiarism** or **academic dishonesty**, and appropriate action may be taken by the concerned institution or organization.



