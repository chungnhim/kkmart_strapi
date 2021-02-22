'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/services.html#core-services)
 * to customize this service
 */

module.exports = {
    checkWishlist: async(userId, productId) => {
        var dataQuery = {
            user: userId,
            product: productId
        }
        var dataresult = await strapi.query('wishlist').find(dataQuery);
        if (dataresult != null && dataresult.length > 0) { return true; } else { return false; }
    }
};