require('dotenv').config();
const bcrypt = require('bcryptjs');
const connectDB = require('./config/db');
const User = require('./models/User');

(async () => {
  await connectDB();

  const user = await User.findOne({
    email: 'admin@b2world.com'
  });

  console.log(user.passwordHash);

  console.log(
    'Admin@123 =>',
    await bcrypt.compare('Admin@123', user.passwordHash)
  );

  console.log(
    'Admin@B2World123! =>',
    await bcrypt.compare('Admin@B2World123!', user.passwordHash)
  );

  
  process.exit(0);
})();