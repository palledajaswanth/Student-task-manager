/**
 * ============================================================
 *  STUDENT TASK MANAGER - Backend Server
 *  File: backend/server.js
 *  Framework: Node.js + Express
 * ============================================================
 *
 *  AWS CLOUD SERVICES OVERVIEW:
 * ---------------------------------------------------------------
 *  1. Amazon EC2 (Elastic Compute Cloud):
 *     - This Node.js server is deployed on an EC2 instance.
 *     - EC2 provides virtual machines (servers) in the cloud.
 *     - You launch an EC2 instance (e.g., t2.micro - free tier),
 *       SSH into it, install Node.js, upload this file, and run:
 *       `node backend/server.js` or use PM2 for process management.
 *     - EC2 allows your app to be accessible 24/7 on the internet.
 *
 *  2. Amazon S3 (Simple Storage Service):
 *     - The frontend (HTML, CSS, JS) is hosted on an S3 bucket.
 *     - S3 can serve static websites at very low cost.
 *     - You upload frontend/ files to a bucket, enable
 *       "Static Website Hosting", and set public access.
 *     - Very scalable and durable (99.999999999% durability).
 *
 *  3. Amazon RDS (Relational Database Service):
 *     - Currently, tasks/users are stored in-memory (arrays).
 *     - In production, you would replace this with Amazon RDS.
 *     - RDS provides managed MySQL, PostgreSQL, or Aurora databases.
 *     - Benefits: automated backups, scaling, high availability.
 *     - Example: Create an RDS MySQL instance and connect via
 *       the `mysql2` npm package instead of in-memory arrays.
 *
 *  4. AWS IAM (Identity and Access Management):
 *     - IAM manages WHO can access WHAT in AWS.
 *     - You create IAM roles for EC2 (e.g., to access S3/RDS).
 *     - You create IAM users for developers with limited permissions.
 *     - Best practice: Follow "principle of least privilege".
 *     - Example: EC2 role only gets READ access to S3; no full admin.
 *
 *  5. Amazon CloudWatch:
 *     - CloudWatch monitors logs and performance metrics.
 *     - On EC2, you install the CloudWatch agent to stream logs.
 *     - You can set ALARMS (e.g., CPU > 80% → send alert).
 *     - All console.log() statements in this file would appear
 *       in CloudWatch Logs when running on EC2 with the agent.
 *     - Useful for debugging and performance monitoring.
 *
 *  6. Amazon SNS (Simple Notification Service):
 *     - SNS is used to send notifications (Email, SMS, Push).
 *     - Use case: When a task deadline is near, SNS sends an email.
 *     - You create an SNS Topic, subscribe an email, and publish
 *       a message from your Node.js code using the AWS SDK:
 *       `await sns.publish({ TopicArn, Message }).promise();`
 *     - This enables real-time deadline alerts to students.
 * ---------------------------------------------------------------
 */

// ── Imports ────────────────────────────────────────────────────
const express = require('express');   // Web framework for Node.js
const cors    = require('cors');       // Allows frontend to call backend (cross-origin)
const { v4: uuidv4 } = require('uuid'); // Generates unique IDs for tasks/users

// ── App Initialization ─────────────────────────────────────────
const app  = express();
const PORT = 5001; // Backend runs on port 5000

// ── Middleware ─────────────────────────────────────────────────
app.use(cors());             // Enable CORS for all origins (frontend can access)
app.use(express.json());     // Parse incoming JSON request bodies

// ── In-Memory Data Storage ─────────────────────────────────────
// NOTE: Data resets when server restarts.
// In production, replace with Amazon RDS (see AWS notes above).
let users = [];  // Stores registered users: { id, username, password }
let tasks = [];  // Stores tasks: { id, userId, title, description, deadline, completed }

// ── Helper: Find user by username ──────────────────────────────
const findUserByUsername = (username) =>
  users.find(u => u.username === username);

// ══════════════════════════════════════════════════════════════
//  AUTH ROUTES
// ══════════════════════════════════════════════════════════════

/**
 * POST /register
 * Registers a new user.
 * Body: { username, password }
 * Response: 201 Created | 400 Bad Request
 *
 * AWS NOTE: On production EC2, passwords should be hashed using
 * bcrypt and stored in Amazon RDS, NOT plain text in memory.
 */
app.post('/register', (req, res) => {
  const { username, password } = req.body;

  // Validate input
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  // Check if username already exists
  if (findUserByUsername(username)) {
    return res.status(400).json({ message: 'Username already exists. Please choose another.' });
  }

  // Create and store the new user
  const newUser = {
    id: uuidv4(),          // Unique ID using UUID library
    username,
    password               // ⚠ Plain text for simplicity; use bcrypt in production
  };

  users.push(newUser);
  console.log(`[REGISTER] New user registered: ${username}`); // CloudWatch will log this

  return res.status(201).json({
    message: `User "${username}" registered successfully!`,
    userId: newUser.id
  });
});

/**
 * POST /login
 * Logs in an existing user.
 * Body: { username, password }
 * Response: 200 OK with userId | 401 Unauthorized
 *
 * AWS NOTE: In production, use JWT tokens or Amazon Cognito
 * for secure session management instead of basic username/password check.
 */
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Validate input
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  // Find user and verify credentials
  const user = findUserByUsername(username);

  if (!user || user.password !== password) {
    return res.status(401).json({ message: 'Invalid username or password.' });
  }

  console.log(`[LOGIN] User logged in: ${username}`); // CloudWatch logs this

  return res.status(200).json({
    message: `Welcome back, ${username}!`,
    userId: user.id,
    username: user.username
  });
});

// ══════════════════════════════════════════════════════════════
//  TASK ROUTES
// ══════════════════════════════════════════════════════════════

/**
 * POST /tasks
 * Creates a new task for the logged-in user.
 * Body: { userId, title, description, deadline }
 * Response: 201 Created with the new task object
 *
 * AWS SNS NOTE: After creating a task, you could publish to an
 * SNS Topic to schedule a deadline notification email to the student.
 */
app.post('/tasks', (req, res) => {
  const { userId, title, description, deadline } = req.body;

  // Validate required fields
  if (!userId || !title || !deadline) {
    return res.status(400).json({ message: 'userId, title, and deadline are required.' });
  }

  // Create a new task object
  const newTask = {
    id:          uuidv4(),     // Unique task ID
    userId,                    // Associates task with a user
    title,                     // Task title (required)
    description: description || '', // Optional description
    deadline,                  // Due date string (e.g., "2025-12-31")
    completed:   false         // Default: not completed
  };

  tasks.push(newTask);

  console.log(`[TASK CREATED] "${title}" for userId: ${userId}`);
  // AWS SNS: Here you would call SNS to send a deadline reminder email

  return res.status(201).json({
    message: 'Task created successfully!',
    task: newTask
  });
});

/**
 * GET /tasks?userId=<id>
 * Retrieves all tasks for a specific user.
 * Query: userId
 * Response: 200 OK with array of tasks
 *
 * AWS CloudWatch NOTE: This endpoint's access patterns can be
 * monitored using CloudWatch metrics and custom dashboards.
 */
app.get('/tasks', (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ message: 'userId query parameter is required.' });
  }

  // Filter tasks belonging to this user only
  const userTasks = tasks.filter(task => task.userId === userId);

  console.log(`[GET TASKS] Fetched ${userTasks.length} tasks for userId: ${userId}`);

  return res.status(200).json({
    message: `Found ${userTasks.length} task(s).`,
    tasks: userTasks
  });
});

/**
 * PUT /tasks/:id
 * Marks a task as completed.
 * Param: id (task ID)
 * Body: { userId } (to verify ownership)
 * Response: 200 OK with updated task | 404 Not Found
 *
 * AWS NOTE: On task completion, you could use SNS to send a
 * congratulatory notification to the student.
 */
app.put('/tasks/:id', (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  // Find the task by ID
  const task = tasks.find(t => t.id === id && t.userId === userId);

  if (!task) {
    return res.status(404).json({ message: 'Task not found or does not belong to you.' });
  }

  // Toggle the completed status
  task.completed = true;

  console.log(`[TASK COMPLETED] Task "${task.title}" marked as done.`);

  return res.status(200).json({
    message: 'Task marked as completed!',
    task
  });
});

/**
 * DELETE /tasks/:id
 * Deletes a specific task.
 * Param: id (task ID)
 * Body: { userId } (to verify ownership)
 * Response: 200 OK | 404 Not Found
 *
 * AWS NOTE: Before deleting, you could log this event to
 * CloudWatch for audit trail purposes.
 */
app.delete('/tasks/:id', (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  // Find the task index
  const index = tasks.findIndex(t => t.id === id && t.userId === userId);

  if (index === -1) {
    return res.status(404).json({ message: 'Task not found or does not belong to you.' });
  }

  const deletedTask = tasks.splice(index, 1)[0]; // Remove from array

  console.log(`[TASK DELETED] Task "${deletedTask.title}" removed.`);

  return res.status(200).json({
    message: `Task "${deletedTask.title}" deleted successfully.`
  });
});

// ── Health Check Route ─────────────────────────────────────────
// Useful for AWS EC2 health checks and Load Balancer target groups
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running!' });
});

// ── Start Server ───────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Student Task Manager Backend running on http://localhost:${PORT}`);
  console.log(`📋 API Endpoints:`);
  console.log(`   POST   /register      → Register new user`);
  console.log(`   POST   /login         → Login user`);
  console.log(`   POST   /tasks         → Create new task`);
  console.log(`   GET    /tasks?userId= → Get all tasks for user`);
  console.log(`   PUT    /tasks/:id     → Mark task as completed`);
  console.log(`   DELETE /tasks/:id     → Delete a task`);
  console.log(`   GET    /health        → Health check`);
  console.log(`\n☁️  AWS Services: EC2 (deploy), S3 (frontend), RDS (database),`);
  console.log(`                  IAM (access), CloudWatch (logs), SNS (alerts)`);
});
