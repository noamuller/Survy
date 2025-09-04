const { db } = require('./firebaseAdmin..js');
const USERS_COLLECTION = 'users';

const userService = {
  async findUserById(userId) {
    const doc = await db.collection(USERS_COLLECTION).doc(userId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },

  async updateUser(userId, updatedData) {
    await db.collection(USERS_COLLECTION).doc(userId).update(updatedData);
    const doc = await db.collection(USERS_COLLECTION).doc(userId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },

  async deleteUser(userId) {
    await db.collection(USERS_COLLECTION).doc(userId).delete();
    return true;
  }
};

module.exports = userService;