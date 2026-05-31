require('dotenv').config();

module.exports = {
    botToken: process.env.BOT_TOKEN,
    adminId: process.env.ADMIN_ID ? process.env.ADMIN_ID.toString() : "0",
    firebaseKeyPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-key.json'
};
