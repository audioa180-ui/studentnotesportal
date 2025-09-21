const mongoose = require('mongoose');

const SubjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  semester_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester', required: true }
});

module.exports = mongoose.model('Subject', SubjectSchema);
