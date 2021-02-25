'use strict';

const product = require("../../product/controllers/product");

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/services.html#core-services)
 * to customize this service
 */

module.exports = {
    getListFlashSaleActivesId: async(listFlashsaleIds) => {
        var arrayId = [];
        var dataQuery = {
            flashsale_in: listFlashsaleIds
        }
        var dataFlashsaleProducts = await strapi.query('flashsaleproducts').find(dataQuery);
        for (let index = 0; index < dataFlashsaleProducts.length; index++) {
            arrayId.push(dataFlashsaleProducts[index].id);
        }
        return arrayId;
    },
    getListFlashSaleActivesId: async() => {
        var arrayId = [];
        var dateTimeUtcNow = new Date(new Date().toUTCString());
        var dateValue = new Date(dateTimeUtcNow.getFullYear(), dateTimeUtcNow.getMonth(), dateTimeUtcNow.getDate());
        var dateTimeValue = dateTimeUtcNow.getTime();
        console.log(dateValue);
        console.log(dateTimeValue);
        // [{ runeveryday: true }, { starttime_gte: dateValue }, { endtime_lte: dateValue }],
        // [{ runeveryday: false }, { activedate: dateValue }, { starttime_gte: dateValue }, { endtime_lte: dateTimeValue }]
        var dataQuery = {
            _or: [
                [{ runeveryday: true }],
                [{ runeveryday: false }, { activedate: dateValue }]
            ],
            _sort: "id:asc",
        };
        var dataresult = await strapi.query('flashsale').find(dataQuery);
        for (let index = 0; index < dataresult.length; index++) {
            arrayId.push(dataresult[index].id);
        }
        return arrayId;
    },
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
        var ishave_discount_promotion = false;
        var ishave_discount_flashsale = false;

        var arrayPromotionActive = await strapi.services.promotionproduct.getPromotionActiveId();
        var arrayFlashSaleActive = [];
        if (product.flashsaleproduct) {
            var flashsaelData = product.flashsaleproduct;
            //if have flash sale will use it
            if (arrayFlashSaleActive && arrayFlashSaleActive.length > 0 && arrayFlashSaleActive.includes(flashsaelData.id)) {
                ishave_discount_flashsale = true;
            }
        }

        if (product.promotionproduct) {

            var promotionData = product.promotionproduct;
            //then use promotion
            if (arrayPromotionActive && arrayPromotionActive.length > 0 && arrayPromotionActive.includes(promotionData.id)) {
                ishave_discount_promotion = true;
                //
                switch (promotionData.promotiontype) {
                    case strapi.config.constants.promotion_types_status.discount_money:
                        product.promotion_price = product.price - promotionData.reduction;
                        product.promotion_percent = (product.promotion_price * 100) / product.price;
                        //Check variants
                        if (product.product_variants && product.product_variants.length > 0) {
                            product.product_variants.forEach(function(variantItem) {
                                variantItem.promotion_price = variantItem.price - promotionData.reduction;
                                variantItem.promotion_percent = (variantItem.promotion_price * 100) / variantItem.price;
                            });
                        }
                        break;
                    case strapi.config.constants.promotion_types_status.discount_percent:
                        let priceDiscountNumber = ((product.price * promotionData.reduction) / 100).toFixed(2);
                        product.promotion_price = product.price - priceDiscountNumber;
                        product.promotion_percent = promotionData.reduction;
                        //Check variants
                        if (product.product_variants && product.product_variants.length > 0) {
                            product.product_variants.forEach(function(variantItem) {
                                variantItem.promotion_price = variantItem.price - priceDiscountNumber;
                                variantItem.promotion_percent = promotionData.reduction;
                            });
                        }
                        break;
                    case strapi.config.constants.promotion_types_status.fix_money:
                        product.promotion_price = promotionData.reduction;
                        product.promotion_percent = (product.promotion_price * 100) / product.price;
                        //Check variants
                        if (product.product_variants && product.product_variants.length > 0) {
                            product.product_variants.forEach(function(variantItem) {
                                variantItem.promotion_price = promotionData.reduction;
                                variantItem.promotion_percent = (variantItem.promotion_price * 100) / variantItem.price;
                            });
                        }
                        break;
                    default:
                        product.promotion_price = product.price;
                        product.promotion_percent = 0;
                        break;
                }

                if (promotionData.isfreeship) {
                    product.isfreeship = promotionData.isfreeship;
                }
            } else {
                //if have not need reset to null
                product.promotionproduct = null;
            }
        }
        product.ishave_discount_promotion = ishave_discount_promotion;
        product.ishave_discount_flashsale = ishave_discount_flashsale;
        return product;
    }
};