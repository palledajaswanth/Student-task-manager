# 🎓 Student Task Manager

> A complete full-stack web application for managing student tasks — built with **Node.js + Express** backend and **vanilla HTML/CSS/JS** frontend, designed for AWS cloud deployment.

---

## 📁 Folder Structure

```
student-task-manager/
│
├── backend/
│   └── server.js          ← Express REST API server
│
├── frontend/
│   ├── index.html         ← Main UI (Login, Register, Tasks)
│   ├── style.css          ← Dark theme, glassmorphism styling
│   └── script.js          ← fetch() API calls, CRUD logic
│
├── package.json           ← Node.js project config + dependencies
├── node_modules/          ← Installed packages (auto-generated)
└── README.md              ← This file
```

---

## ⚡ Features

| Feature | Description |
|---|---|
| 📝 Register | Create a new student account |
| 🔐 Login | Authenticate with username + password |
| ➕ Add Task | Create tasks with title, description, and deadline |
| 📋 View Tasks | See all tasks filtered by All / Pending / Completed |
| ✅ Complete Task | Mark tasks as done with one click |
| 🗑️ Delete Task | Remove tasks permanently |
| 📊 Stats Bar | Live counts of Total / Done / Pending tasks |
| 🔔 Deadline Status | Tasks show overdue / due soon / on-time labels |

---

## 🚀 How to Run Locally

### Prerequisites

Make sure you have installed:
- [Node.js](https://nodejs.org/) (v16 or higher)
- npm (comes with Node.js)

You can verify with:
```bash
node --version
npm --version
```

---

### Step 1 — Clone / Open the Project

```bash
cd student-task-manager
```

---

### Step 2 — Install Dependencies

```bash
npm install
```

This installs:
- `express` — Web framework
- `cors` — Cross-origin resource sharing middleware
- `uuid` — Generates unique task/user IDs
- `nodemon` — Auto-restarts server on file changes (dev only)

---

### Step 3 — Start the Backend Server

```bash
# For production (normal start):
npm start

# For development (auto-restart on save):
npm run dev
```

You should see:
```
✅ Student Task Manager Backend running on http://localhost:5000
📋 API Endpoints:
   POST   /register
   POST   /login
   POST   /tasks
   GET    /tasks?userId=
   PUT    /tasks/:id
   DELETE /tasks/:id
   GET    /health
```

---

### Step 4 — Open the Frontend

Open the frontend in your browser:

```
frontend/index.html
```

> Simply double-click `index.html` in the `frontend/` folder,  
> OR right-click → "Open with" → your browser (Chrome, Edge, Firefox).

The frontend connects to `http://localhost:5000` by default.

---

### Step 5 — Use the App

1. Click **Register** → Create an account
2. Click **Login** → Sign in
3. Add tasks with title, description, deadline
4. Mark tasks complete or delete them
5. Use filters to view All / Pending / Done tasks

---

## 🌐 REST API Reference

All API endpoints run at: `http://localhost:5000`

### Auth Endpoints

#### `POST /register`
Register a new user.
```json
// Request Body:
{ "username": "alice", "password": "1234" }

// Response (201):
{ "message": "User registered successfully!", "userId": "uuid-..." }
```

#### `POST /login`
Login with credentials.
```json
// Request Body:
{ "username": "alice", "password": "1234" }

// Response (200):
{ "message": "Welcome back, alice!", "userId": "uuid-...", "username": "alice" }
```

---

### Task Endpoints

#### `POST /tasks`
Create a new task.
```json
// Request Body:
{
  "userId": "uuid-...",
  "title": "Math Assignment",
  "description": "Chapter 5 exercises",
  "deadline": "2025-12-31"
}

// Response (201):
{
  "message": "Task created successfully!",
  "task": {
    "id": "uuid-...",
    "userId": "uuid-...",
    "title": "Math Assignment",
    "description": "Chapter 5 exercises",
    "deadline": "2025-12-31",
    "completed": false
  }
}
```

#### `GET /tasks?userId=<id>`
Get all tasks for a user.
```json
// Response (200):
{
  "message": "Found 3 task(s).",
  "tasks": [ { ...task }, { ...task } ]
}
```

#### `PUT /tasks/:id`
Mark a task as completed.
```json
// Request Body:
{ "userId": "uuid-..." }

// Response (200):
{ "message": "Task marked as completed!", "task": { ...updatedTask } }
```

#### `DELETE /tasks/:id`
Delete a task.
```json
// Request Body:
{ "userId": "uuid-..." }

// Response (200):
{ "message": "Task \"Math Assignment\" deleted successfully." }
```

#### `GET /health`
Check if server is running.
```json
// Response (200):
{ "status": "OK", "message": "Server is running!" }
```

---

## ☁️ AWS Cloud Deployment Guide

This project is designed to demonstrate **6 AWS Services**:

---

### 1. 🖥️ Amazon EC2 — Backend Deployment

**Purpose:** Host and run the Node.js Express backend server.

**Steps:**

1. Go to **AWS Console → EC2 → Launch Instance**
2. Choose **Amazon Linux 2023** or **Ubuntu 22.04**
3. Select instance type: **t2.micro** *(Free Tier eligible)*
4. Configure Security Group — add inbound rules:
   - `SSH` on port `22`
   - `Custom TCP` on port `5000`
5. Launch and download your `.pem` key
6. SSH into your instance:
   ```bash
   ssh -i "your-key.pem" ec2-user@YOUR_EC2_PUBLIC_IP
   ```
7. Install Node.js on EC2:
   ```bash
   curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
   sudo yum install -y nodejs
   ```
8. Upload project files:
   ```bash
   scp -i "your-key.pem" -r ./backend package.json ec2-user@YOUR_EC2_IP:~/student-task-manager/
   ```
9. Install and start:
   ```bash
   cd ~/student-task-manager
   npm install
   # Use PM2 to keep server running after logout:
   sudo npm install -g pm2
   pm2 start backend/server.js --name "task-manager"
   pm2 startup
   pm2 save
   ```
10. Your backend is now live at: `http://YOUR_EC2_PUBLIC_IP:5000`

> **Remember:** Update `API_URL` in `frontend/script.js` to point to your EC2 IP!

---

### 2. 🪣 Amazon S3 — Frontend Hosting

**Purpose:** Host the static frontend (HTML, CSS, JS) as a website.

**Steps:**

1. Go to **AWS Console → S3 → Create Bucket**
2. Bucket name: `student-task-manager-frontend` *(must be globally unique)*
3. Region: Choose closest to your users
4. **Uncheck** "Block all public access" → Acknowledge the warning
5. Create the bucket
6. Upload files: `frontend/index.html`, `frontend/style.css`, `frontend/script.js`
7. Go to **Properties → Static website hosting → Enable**
   - Index document: `index.html`
   - Error document: `index.html`
8. Go to **Permissions → Bucket Policy** and paste:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Sid": "PublicRead",
       "Effect": "Allow",
       "Principal": "*",
       "Action": "s3:GetObject",
       "Resource": "arn:aws:s3:::student-task-manager-frontend/*"
     }]
   }
   ```
9. Your frontend URL:
   ```
   http://student-task-manager-frontend.s3-website-ap-south-1.amazonaws.com
   ```

> **Before uploading**, edit `script.js` line 1:
> ```js
> const API_URL = 'http://YOUR_EC2_PUBLIC_IP:5000';
> ```

---

### 3. 🗄️ Amazon RDS — Database (Conceptual)

**Purpose:** Replace the in-memory array with a persistent database.

**Why RDS?**
Currently, data resets every time the server restarts. In production, use **Amazon RDS** (Relational Database Service) for persistent storage.

**How it would work:**
1. Create an RDS instance (MySQL or PostgreSQL, Free Tier eligible)
2. Install `mysql2` npm package: `npm install mysql2`
3. Replace the in-memory arrays in `server.js` with SQL queries:
   ```js
   // Instead of: users.push(newUser)
   // You would do: await db.query('INSERT INTO users SET ?', newUser)
   ```
4. RDS automatically handles:
   - Daily automated backups
   - Multi-AZ failover for high availability
   - Storage scaling
5. Connect EC2 to RDS within the same **VPC** for security

> **RDS is not implemented** in this project (uses in-memory storage for simplicity), but this is the production upgrade path.

---

### 4. 🔑 AWS IAM — Identity & Access Management

**Purpose:** Securely control who can access which AWS resources.

**Best Practices Used in This Project:**

| Role / User | Permissions |
|---|---|
| EC2 Instance Role | Read from S3, Write to CloudWatch Logs |
| Developer IAM User | EC2 Start/Stop, S3 Upload, RDS Connect |
| S3 Bucket Policy | `s3:GetObject` for public frontend only |

**Key Steps:**
1. Create an **IAM Role** for EC2 with:
   - `CloudWatchLogsFullAccess` (for logging)
   - `AmazonSNSFullAccess` (for deadline alerts)
2. Attach the IAM role to your EC2 instance at launch
3. Never use your root AWS account for daily tasks
4. Enable **MFA (Multi-Factor Authentication)** on all IAM users

---

### 5. 📊 Amazon CloudWatch — Monitoring & Logs

**Purpose:** Monitor server health, view logs, and set performance alerts.

**What Gets Monitored:**
- All `console.log()` statements in `server.js` stream to CloudWatch Logs
- CPU, Memory, Network usage of the EC2 instance
- API call count per endpoint (via custom metrics)

**Setup Steps:**
1. Install the **CloudWatch Agent** on EC2:
   ```bash
   sudo yum install amazon-cloudwatch-agent -y
   ```
2. Configure it to ship `/var/log` and Node.js stdout to CloudWatch
3. Create **Alarms** in CloudWatch:
   - CPU > 80% → Send SNS notification
   - Error rate spike → Page the developer
4. View logs at: **CloudWatch → Log Groups → /student-task-manager**

**Example: Log would appear like this in CloudWatch:**
```
[LOGIN] User logged in: alice
[TASK CREATED] "Math Assignment" for userId: uuid-...
[TASK DELETED] Task "Old Task" removed.
```

---

### 6. 📢 Amazon SNS — Task Deadline Notifications

**Purpose:** Send email/SMS alerts when a task deadline is approaching.

**Use Case:**  
When a student adds a task with a deadline, SNS sends a reminder email 1 day before the due date.

**How It Would Work:**

1. Create an **SNS Topic**: `TaskDeadlineAlerts`
2. Subscribe student's email to the topic
3. In `server.js`, after POST /tasks, add:
   ```js
   const AWS = require('aws-sdk');
   const sns = new AWS.SNS({ region: 'ap-south-1' });

   await sns.publish({
     TopicArn: 'arn:aws:sns:ap-south-1:ACCOUNT_ID:TaskDeadlineAlerts',
     Subject:  'Task Deadline Reminder',
     Message:  `Reminder: Your task "${title}" is due on ${deadline}.`
   }).promise();
   ```
4. Install AWS SDK: `npm install aws-sdk`
5. EC2 IAM Role must have `AmazonSNSFullAccess` permission

**Notification Flow:**
```
Student adds task → Backend POST /tasks → SNS publishes message
→ Email sent to student: "Your task is due tomorrow!"
```

> SNS also supports SMS, mobile push notifications, and HTTP/HTTPS webhooks.

---

## 🏗️ Complete AWS Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        INTERNET                             │
└──────────────────┬────────────────────┬─────────────────────┘
                   │                    │
          ┌────────▼──────┐    ┌────────▼──────────┐
          │  Amazon S3    │    │   Amazon EC2       │
          │  (Frontend)   │    │   (Backend)        │
          │  index.html   │    │   server.js        │
          │  style.css    │    │   Port: 5000       │
          │  script.js    │    └────────┬───────────┘
          └───────────────┘            │
                                       │
                   ┌───────────────────┤
                   │                   │
          ┌────────▼──────┐    ┌───────▼───────────┐
          │  Amazon RDS   │    │  Amazon SNS        │
          │  (Database)   │    │  (Email Alerts)    │
          │  MySQL/Postgres│   │  Deadline Notify   │
          └───────────────┘    └───────────────────┘
                   │
       ┌───────────┼───────────────┐
       │                           │
 ┌─────▼──────┐           ┌───────▼──────┐
 │ AWS IAM    │           │ CloudWatch   │
 │ (Roles &   │           │ (Logs &      │
 │  Policies) │           │  Monitoring) │
 └────────────┘           └──────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Node.js + Express.js |
| **Frontend** | HTML5 + CSS3 + Vanilla JavaScript |
| **Storage** | In-memory arrays (production → Amazon RDS) |
| **HTTP Client** | `fetch()` API (built into browser) |
| **IDs** | UUID v4 |
| **Deployment** | AWS EC2 (backend) + AWS S3 (frontend) |

---

## 📦 Dependencies

```json
{
  "dependencies": {
    "express": "^4.18.2",   // Web framework
    "cors": "^2.8.5",       // CORS middleware
    "uuid": "^9.0.0"        // Unique ID generation
  },
  "devDependencies": {
    "nodemon": "^3.0.1"     // Auto-restart in development
  }
}
```

---

## 🧪 Testing the API

You can test the backend using **cURL** or any REST client:

```bash
# Health Check
curl http://localhost:5000/health

# Register a user
curl -X POST http://localhost:5000/register \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"1234"}'

# Login
curl -X POST http://localhost:5000/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"1234"}'

# Add a task (replace USER_ID with actual ID from login)
curl -X POST http://localhost:5000/tasks \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID","title":"Math HW","description":"Chapter 5","deadline":"2025-12-31"}'

# Get all tasks
curl "http://localhost:5000/tasks?userId=USER_ID"

# Mark as complete (replace TASK_ID)
curl -X PUT http://localhost:5000/tasks/TASK_ID \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID"}'

# Delete a task
curl -X DELETE http://localhost:5000/tasks/TASK_ID \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID"}'
```

---

## ⚠️ Common Issues & Solutions

| Problem | Cause | Solution |
|---|---|---|
| "Cannot connect to server" | Backend not running | Run `npm start` in the project root |
| CORS error in browser | Wrong API URL | Ensure frontend calls `localhost:5000` |
| Data disappears on restart | In-memory storage | Expected behaviour; use RDS for persistence |
| Port 5000 already in use | Another process | Change `PORT` in `server.js` to `5001` etc. |
| EC2 connection refused | Security Group | Add inbound rule for TCP port 5000 |

---

## 📝 Project Summary

This project demonstrates:

- ✅ **Full-stack development** with Node.js + HTML/CSS/JS
- ✅ **REST API design** with proper HTTP methods and status codes
- ✅ **Frontend-backend integration** using the `fetch()` API
- ✅ **CRUD operations** (Create, Read, Update, Delete)
- ✅ **AWS cloud deployment** understanding across 6 services:
  - EC2 for compute, S3 for static hosting
  - RDS for database, IAM for security
  - CloudWatch for monitoring, SNS for notifications

---

*Student Task Manager — Built for Full-Stack & Cloud Learning*
