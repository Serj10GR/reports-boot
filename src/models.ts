require('dotenv').config();
const mongoose = require('mongoose');

mongoose.set('strictQuery', false);

const url = process.env.MONGODB_URI;

console.log('connecting to', url);

mongoose
  .connect(url)
  .then(() => {
    console.log('connected to MongoDB');
  })
  .catch((error: Error) => {
    console.log('error connecting to MongoDB:', error.message);
  });



const userSchema = new mongoose.Schema({
  chatId: { type: Number, required: true },
  tgUserId: { type: Number, required: true },
  participated: { type: Boolean },
  profile: { type: String },
  hours: { type: Number, default: 0 },
  bibleStudies: { type: Number, default: 0 },
  state: { type: String, default: 'idle' },
  firstName: { type: String },
  lastName: { type: String },
  sent: { type: Boolean },
});

userSchema.set('toJSON', {
  transform: (a: any, returnedObject: any) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
  },
});

module.exports = mongoose.model('User', userSchema);