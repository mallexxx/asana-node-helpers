/**
 * User-related operations
 */

/**
 * Get the current authenticated user
 * @param {Object} usersApiInstance - Asana UsersApi instance
 * @returns {Promise} Promise with user data
 */
async function getCurrentUser(usersApiInstance) {
    try {
        const result = await usersApiInstance.getUser('me', {});
        return result.data;
    } catch (error) {
        console.error('Error fetching user:', error.response?.body || error.message);
        throw error;
    }
}

/**
 * Get a specific user by GID
 * @param {Object} usersApiInstance - Asana UsersApi instance
 * @param {string} userGid - The user GID
 * @returns {Promise} Promise with user data
 */
async function getUser(usersApiInstance, userGid) {
    try {
        const result = await usersApiInstance.getUser(userGid, {});
        return result.data;
    } catch (error) {
        console.error('Error fetching user:', error.response?.body || error.message);
        throw error;
    }
}

module.exports = {
    getCurrentUser,
    getUser
};
