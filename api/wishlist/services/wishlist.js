'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/services.html#core-services)
 * to customize this service
 */

module.exports = {
    checkWishlist: async(userId, productId) => {
        var dataresult = await strapi.query('wishlist').find();
        if (dataresult != null) { return true; } else { return false; }
    }
};