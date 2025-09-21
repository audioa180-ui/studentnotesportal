// ===== Load Environment Variables =====
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");

const app = express();
app.use(express.json());
app.use(cors());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ===== MongoDB Connection =====
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("❌ No MongoDB URI provided in environment variables");
  process.exit(1);
}

mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error", err));

// ===== JWT Secret =====
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// ===== Multer Setup for File Uploads =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_")),
});
const upload = multer({ storage });

// ===== MongoDB Schemas =====
const UserSchema = new mongoose.Schema({ username: String, password: String });
const ClassSchema = new mongoose.Schema({ name: String });
const SemesterSchema = new mongoose.Schema({
  name: String,
  classId: { type: mongoose.Schema.Types.ObjectId, ref: "Class" },
});
const SubjectSchema = new mongoose.Schema({
  name: String,
  semesterId: { type: mongoose.Schema.Types.ObjectId, ref: "Semester" },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: "Class" },
});
const NoteSchema = new mongoose.Schema({
  title: String,
  filename: String,
  originalName: String,
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject" },
  semesterId: { type: mongoose.Schema.Types.ObjectId, ref: "Semester" },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: "Class" },
  uploadedAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", UserSchema);
const Class = mongoose.model("Class", ClassSchema);
const Semester = mongoose.model("Semester", SemesterSchema);
const Subject = mongoose.model("Subject", SubjectSchema);
const Note = mongoose.model("Note", NoteSchema);

// ===== Auth Middleware =====
function authMiddleware(req, res, next) {
  const header = req.headers["authorization"];
  if (!header) return res.status(401).json({ error: "No authorization header" });
  const token = header.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = decoded;
    next();
  });
}

// ===== Auth Routes =====
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ error: "Invalid credentials" });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).json({ error: "Invalid credentials" });

  const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, {
    expiresIn: "1d",
  });
  res.json({ token });
});

// ===== PUBLIC GET Routes =====
app.get("/api/classes", async (req, res) => {
  const data = await Class.find();
  res.json(data);
});

app.get("/api/semesters", async (req, res) => {
  const filter = {};
  if (req.query.class_id) filter.classId = req.query.class_id;
  const data = await Semester.find(filter).populate("classId", "name");
  res.json(data);
});

app.get("/api/subjects", async (req, res) => {
  const filter = {};
  if (req.query.semester_id) filter.semesterId = req.query.semester_id;
  const data = await Subject.find(filter)
    .populate("semesterId", "name")
    .populate("classId", "name");
  res.json(data);
});

app.get("/api/notes", async (req, res) => {
  const filter = {};
  if (req.query.subject_id) filter.subjectId = req.query.subject_id;
  const data = await Note.find(filter)
    .populate("subjectId", "name")
    .populate("semesterId", "name")
    .populate("classId", "name");
  res.json(data);
});

// ===== PROTECTED Write Routes =====
app.post("/api/classes", authMiddleware, async (req, res) => {
  const newItem = new Class(req.body);
  await newItem.save();
  res.json(newItem);
});

app.post("/api/semesters", authMiddleware, async (req, res) => {
  const newItem = new Semester(req.body);
  await newItem.save();
  res.json(newItem);
});

app.post("/api/subjects", authMiddleware, async (req, res) => {
  const newItem = new Subject(req.body);
  await newItem.save();
  res.json(newItem);
});

app.post("/api/notes", authMiddleware, upload.single("file"), async (req, res) => {
  const newItem = new Note({
    title: req.body.title,
    filename: req.file.filename,
    originalName: req.file.originalname,
    subjectId: req.body.subjectId,
    semesterId: req.body.semesterId,
    classId: req.body.classId,
  });
  await newItem.save();
  res.json(newItem);
});

// ===== Protected Delete Routes =====
app.delete("/api/classes/:id", authMiddleware, async (req, res) => {
  await Class.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

app.delete("/api/semesters/:id", authMiddleware, async (req, res) => {
  await Semester.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

app.delete("/api/subjects/:id", authMiddleware, async (req, res) => {
  await Subject.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

app.delete("/api/notes/:id", authMiddleware, async (req, res) => {
  await Note.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// ===== User Management (Admin Only) =====
app.post("/api/users", authMiddleware, async (req, res) => {
  const { username, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  const newUser = new User({ username, password: hashed });
  await newUser.save();
  res.json(newUser);
});

app.get("/api/users", authMiddleware, async (req, res) => {
  const users = await User.find({}, "username");
  res.json(users);
});

app.delete("/api/users/:id", authMiddleware, async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// ===== Serve Frontend =====
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// ===== Start Server =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
