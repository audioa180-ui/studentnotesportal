// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');   // ✅ switched from bcrypt → bcryptjs
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (public folder)
app.use(express.static(path.join(__dirname, 'public')));

// Config
const PORT = process.env.PORT || 3000;
const MONGO_URI =
  process.env.MONGO_URI ||
  'mongodb+srv://notes:262692@notes.qm6sdol.mongodb.net/college?retryWrites=true&w=majority&appName=notes';
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

// ===== MongoDB Connection =====
mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => {
    console.error('❌ MongoDB connection error', err);
    process.exit(1);
  });

// ===== Models =====
const User = mongoose.model(
  'User',
  new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true }, // hashed
  })
);

const ClassModel = mongoose.model('Class', new mongoose.Schema({ name: String }));

const Semester = mongoose.model(
  'Semester',
  new mongoose.Schema({
    name: String,
    class_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  })
);

const Subject = mongoose.model(
  'Subject',
  new mongoose.Schema({
    name: String,
    semester_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester' },
  })
);

const Note = mongoose.model(
  'Note',
  new mongoose.Schema({
    title: String,
    subject_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
    file: String,
    originalName: String,
    uploadedAt: { type: Date, default: Date.now },
  })
);

// ===== Auth Middleware =====
function auth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'No authorization header' });
  const token = header.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Malformed token' });
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = decoded;
    next();
  });
}

// ===== Multer Uploads =====
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) =>
    cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_')),
});
const upload = multer({ storage });
app.use('/uploads', express.static(UPLOAD_DIR));

// ===== Auth Routes =====
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Missing username/password' });
    const existing = await User.findOne({ username });
    if (existing) return res.status(409).json({ error: 'Username already exists' });
    const hashed = await bcrypt.hash(password, 10);
    const u = new User({ username, password: hashed });
    await u.save();
    res.json({ message: 'registered' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const u = await User.findOne({ username });
    if (!u) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, u.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: u._id, username: u.username }, JWT_SECRET, {
      expiresIn: '6h',
    });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== Users =====
app.get('/api/users', auth, async (req, res) => {
  res.json(await User.find({}, 'username'));
});
app.post('/api/users', auth, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Missing username/password' });
  const existing = await User.findOne({ username });
  if (existing) return res.status(409).json({ error: 'Username already exists' });
  const hashed = await bcrypt.hash(password, 10);
  const u = new User({ username, password: hashed });
  await u.save();
  res.json({ _id: u._id, username: u.username });
});
app.delete('/api/users/:id', auth, async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ deleted: true });
});

// ===== Classes =====
app.get('/api/classes', auth, async (req, res) => {
  res.json(await ClassModel.find().sort({ name: 1 }));
});
app.post('/api/classes', auth, async (req, res) => {
  const c = new ClassModel({ name: req.body.name });
  await c.save();
  res.json(c);
});
app.delete('/api/classes/:id', auth, async (req, res) => {
  await ClassModel.findByIdAndDelete(req.params.id);
  res.json({ deleted: true });
});

// ===== Semesters =====
app.get('/api/semesters', auth, async (req, res) => {
  const filter = req.query.class_id ? { class_id: req.query.class_id } : {};
  res.json(await Semester.find(filter).populate('class_id', 'name'));
});
app.post('/api/semesters', auth, async (req, res) => {
  const s = new Semester({ name: req.body.name, class_id: req.body.class_id });
  await s.save();
  res.json(s);
});
app.delete('/api/semesters/:id', auth, async (req, res) => {
  await Semester.findByIdAndDelete(req.params.id);
  res.json({ deleted: true });
});

// ===== Subjects =====
app.get('/api/subjects', auth, async (req, res) => {
  const filter = req.query.semester_id ? { semester_id: req.query.semester_id } : {};
  const subs = await Subject.find(filter).populate({
    path: 'semester_id',
    populate: { path: 'class_id', select: 'name' },
  });
  res.json(subs);
});
app.post('/api/subjects', auth, async (req, res) => {
  const s = new Subject({ name: req.body.name, semester_id: req.body.semester_id });
  await s.save();
  res.json(s);
});
app.delete('/api/subjects/:id', auth, async (req, res) => {
  await Subject.findByIdAndDelete(req.params.id);
  res.json({ deleted: true });
});

// ===== Notes =====
app.get('/api/notes', auth, async (req, res) => {
  const notes = await Note.find()
    .populate({
      path: 'subject_id',
      populate: {
        path: 'semester_id',
        populate: { path: 'class_id', select: 'name' },
      },
    })
    .sort({ uploadedAt: -1 });
  res.json(notes);
});
app.post('/api/notes', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file required' });
  const note = new Note({
    title: req.body.title,
    subject_id: req.body.subject_id,
    file: '/uploads/' + req.file.filename,
    originalName: req.file.originalname,
  });
  await note.save();
  res.json(note);
});
app.delete('/api/notes/:id', auth, async (req, res) => {
  const n = await Note.findById(req.params.id);
  if (n && n.file) {
    const p = path.join(__dirname, n.file);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  await Note.findByIdAndDelete(req.params.id);
  res.json({ deleted: true });
});

// ===== Routes for frontend =====
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'frontend.html'));
});
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ===== Seed Default Admin =====
async function seedAdmin() {
  const count = await User.countDocuments();
  if (count === 0) {
    const hashed = await bcrypt.hash('admin123', 10);
    await new User({ username: 'admin', password: hashed }).save();
    console.log('👤 Default admin created: admin / admin123');
  }
}
seedAdmin();

// ===== Start =====
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`👉 Frontend: http://localhost:${PORT}/`);
  console.log(`👉 Admin:    http://localhost:${PORT}/admin`);
});
