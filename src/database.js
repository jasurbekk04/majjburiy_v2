const admin = require('firebase-admin');
const config = require('./config');
const fs = require('fs');
const dayjs = require('dayjs');

let serviceAccount;

try {
    if (process.env.FIREBASE_KEY_JSON) {
        console.log('[DEBUG] Attempting to parse FIREBASE_KEY_JSON...');
        serviceAccount = JSON.parse(process.env.FIREBASE_KEY_JSON);
        console.log('[DEBUG] FIREBASE_KEY_JSON successfully parsed.');
    } else if (fs.existsSync(config.firebaseKeyPath)) {
        serviceAccount = require('../' + config.firebaseKeyPath);
    } else {
        console.warn('[WARNING] Firebase key not found in ENV or File.');
    }
} catch (e) {
    console.error('[ERROR] Firebase initialization error:', e.message);
}

if (serviceAccount) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('[DEBUG] Firebase Admin initialized.');
}
const db = admin.firestore();
console.log('[DEBUG] Firestore initialized.');

// Collections
const USERS = db.collection('users');
const SETTINGS = db.collection('settings').doc('main');

const dbHelpers = {
    // User functions
    async saveUser(user) {
        const userRef = USERS.doc(user.id.toString());
        const doc = await userRef.get();
        
        const userData = {
            id: user.id,
            username: user.username || null,
            first_name: user.first_name || null,
            last_name: user.last_name || null,
            status: 'active',
            joinedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastActive: admin.firestore.FieldValue.serverTimestamp()
        };

        if (!doc.exists) {
            await userRef.set(userData);
        } else {
            await userRef.update({
                username: user.username || null,
                status: 'active',
                lastActive: admin.firestore.FieldValue.serverTimestamp()
            });
        }
    },

    async setBlocked(userId) {
        await USERS.doc(userId.toString()).update({ status: 'blocked' });
    },

    async getUsers() {
        const snapshot = await USERS.get();
        return snapshot.docs.map(doc => doc.data());
    },

    // Stats functions
    async getStats() {
        const snapshot = await USERS.get();
        const users = snapshot.docs.map(doc => doc.data());
        
        const total = users.length;
        const active = users.filter(u => u.status === 'active').length;
        const blocked = users.filter(u => u.status === 'blocked').length;
        
        const yesterday = dayjs().subtract(24, 'hour').toDate();
        const joinedLast24h = users.filter(u => {
            if (!u.joinedAt) return false;
            const date = u.joinedAt.toDate ? u.joinedAt.toDate() : new Date(u.joinedAt);
            return date > yesterday;
        }).length;

        const settings = await this.getSettings();
        const channelsCount = settings.channels ? settings.channels.length : 0;

        return { total, active, blocked, joinedLast24h, channelsCount };
    },

    // Settings functions
    async getSettings() {
        const doc = await SETTINGS.get();
        if (!doc.exists) {
            const defaultSettings = {
                channels: [], // array of { id, title, username, link, type: 'sub' | 'request' }
                codeLink: 'https://t.me/example'
            };
            await SETTINGS.set(defaultSettings);
            return defaultSettings;
        }
        return doc.data();
    },

    async updateSettings(data) {
        await SETTINGS.update(data);
    },

    async addChannel(channel) {
        const settings = await this.getSettings();
        const channels = settings.channels || [];
        channels.push(channel);
        await SETTINGS.update({ channels });
    },

    async removeChannel(channelId) {
        const settings = await this.getSettings();
        const channels = (settings.channels || []).filter(c => c.id !== channelId);
        await SETTINGS.update({ channels });
    },

    // Join Request tracking
    async addJoinRequest(userId, channelId) {
        await db.collection('join_requests').doc(`${userId}_${channelId}`).set({
            userId,
            channelId,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    },

    async checkJoinRequest(userId, channelId) {
        const doc = await db.collection('join_requests').doc(`${userId}_${channelId}`).get();
        return doc.exists;
    }
};

module.exports = { db, dbHelpers };
