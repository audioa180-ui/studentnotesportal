const mongoose = require('mongoose');

const ClassSchema = new mongoose.Schema({
  name: { type: String, required: true }
});

module.exports = mongoose.model('Class', ClassSchema);
