const bcrypt = require('bcrypt');
const saltRounds = 12;
const newPassword = // Replace with your desired password

bcrypt.hash(newPassword, saltRounds).then(hash => {
  console.log(hash);
});