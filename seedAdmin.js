require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(()=> console.log("Connected for seeding"))
.catch(err=> console.error(err));

const AdminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});
const Admin = mongoose.model('Admin', AdminSchema);

(async()=>{
  const username = "admin";
  const password = "admin123";
  const hashed = await bcrypt.hash(password, 10);
  try{
    const existing = await Admin.findOne({ username });
    if(existing){ console.log("Admin already exists"); process.exit(0); }
    await new Admin({ username, password: hashed }).save();
    console.log("✅ Admin user created:", username, "/", password);
  }catch(err){ console.error(err); }
  finally{ mongoose.disconnect(); }
})();
