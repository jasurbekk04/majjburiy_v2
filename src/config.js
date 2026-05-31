require('dotenv').config();

module.exports = {
    botToken: process.env.BOT_TOKEN,
    adminId: parseInt(process.env.ADMIN_ID) || 0,
    firebaseKeyPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-key.json'
};
