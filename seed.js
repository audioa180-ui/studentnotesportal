require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const Class = require('./models/Class');
const Semester = require('./models/Semester');
const Subject = require('./models/Subject');
const Note = require('./models/Note');
const User = require('./models/User');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

    // Clear old data
    await Promise.all([Class.deleteMany(), Semester.deleteMany(), Subject.deleteMany(), Note.deleteMany(), User.deleteMany()]);

    // Create admin user
    const adminPass = await bcrypt.hash("admin123", 10);
    const admin = new User({ username: "admin", password: adminPass });
    await admin.save();

    // Create sample class, semester, subject, note
    const c = new Class({ name: "BCA" });
    await c.save();

    const sem = new Semester({ name: "Semester 1", class_id: c._id });
    await sem.save();

    const sub = new Subject({ name: "Database", semester_id: sem._id });
    await sub.save();

    const note = new Note({
      title: "Intro to DBMS",
      subject_id: sub._id,
      filename: "sample.pdf",
      originalName: "sample.pdf",
      uploadedAt: new Date()
    });
    await note.save();

    console.log("✅ Database seeded successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Seeding error:", err);
    process.exit(1);
  }
})();
