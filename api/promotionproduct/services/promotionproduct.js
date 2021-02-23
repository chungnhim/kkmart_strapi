'use strict';

const product = require("../../product/controllers/product");

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/services.html#core-services)
 * to customize this service
 */

module.exports = {
    getPromotionActiveId: async() => {
        var arrayId = [];
        var dateTimeUtcNow = new Date(new Date().toUTCString());
        var dataQuery = {
            activedate_lte: dateTimeUtcNow,
            _or: [
                [{ isenddate: true }],
                [{ isenddate: false }, { enddate_gte: dateTimeUtcNow }]
            ],
            _sort: "id:asc",
        };
        var dataresult = await strapi.query('promotionproduct').find(dataQuery);
        for (let index = 0; index < dataresult.length; index++) {
            arrayId.push(dataresult[index].id);

        }
        return arrayId;
    },

    priceRecalculationOfProduct: async(product) => {
        //
        var arrayPromotionActive = strapi.services.promotionproduct.getPromotionActiveId();
        var arrayFlashSaleActive = [];
        if (product.flashsaleproduct) {
            //if have flash sale will use it
        } else if (product.promotionproduct) {
            var promotionData = product.promotionproduct;
            //then use promotion
            if (arrayPromotionActive && arrayPromotionActive.length > 0 && arrayPromotionActive.includes(promotionData.id)) {
                //
                switch (promotionData.promotiontype) {
                    case strapi.config.constants.promotion_types_status.discount_money:

                        break;
                    case strapi.config.constants.promotion_types_status.discount_percent:

                        break;
                    case strapi.config.constants.promotion_types_status.fix_money:

                        break;
                }
            }

            if (promotionData.isfreeship) {
                product.isfreeship = promotionData.isfreeship;
            }
        }
        return product;
    }
};