const mongoose = require('mongoose');

const SemesterSchema = new mongoose.Schema({
  name: { type: String, required: true },
  class_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true }
});

module.exports = mongoose.model('Semester', SemesterSchema);
