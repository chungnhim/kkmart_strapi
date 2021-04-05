'use strict';

const product = require("../../product/controllers/product");

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/services.html#core-services)
 * to customize this service
 */

module.exports = {
    getListFlashSaleProductsActivesId: async(listFlashsaleIds) => {
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
        ////console.log(dateValue);
        ////console.log(dateTimeValue);
        // [{ runeveryday: true }, { starttime_gte: dateValue }, { endtime_lte: dateValue }],
        // [{ runeveryday: false }, { activedate: dateValue }, { starttime_gte: dateValue }, { endtime_lte: dateTimeValue }]
        var dataQuery = {
            _or: [
                [{ runeveryday: true }],
                [{ runeveryday: false }, { activedate: dateValue }]
            ],
            _sort: "id:desc",
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
            _sort: "id:desc",
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
        var arrayFlashSaleActive = await strapi.services.promotionproduct.getListFlashSaleActivesId();
        if (product.flashsaleproduct) {
            var flashsaleData = product.flashsaleproduct;
            //if have flash sale will use it
            if (arrayFlashSaleActive && arrayFlashSaleActive.length > 0 && arrayFlashSaleActive.includes(flashsaleData.flashsale)) {
                ishave_discount_flashsale = true;
                //calculation flash sales
                //get full info flash sale for get name  

                switch (flashsaleData.flashsaletype) {
                    case strapi.config.constants.flashsale_types_status.discount_money:
                        product.flashsale_price = product.price - flashsaleData.reduction;
                        product.flashsale_percent = 100 - ((product.flashsale_price * 100) / product.price);
                        //Check variants
                        if (product.product_variants && product.product_variants.length > 0) {
                            product.product_variants.forEach(function(variantItem) {
                                variantItem.flashsale_price = variantItem.price - flashsaleData.reduction;
                                variantItem.flashsale_percent = 100 - ((variantItem.flashsale_price * 100) / variantItem.price);
                            });
                        }
                        break;
                    case strapi.config.constants.flashsale_types_status.discount_percent:
                        let priceDiscountNumber = ((product.price * flashsaleData.reduction) / 100).toFixed(2);
                        product.flashsale_price = product.price - priceDiscountNumber;
                        product.flashsale_percent = flashsaleData.reduction;
                        //Check variants
                        if (product.product_variants && product.product_variants.length > 0) {
                            product.product_variants.forEach(function(variantItem) {
                                variantItem.flashsale_price = variantItem.price - priceDiscountNumber;
                                variantItem.flashsale_percent = flashsaleData.reduction;
                            });
                        }
                        break;
                    case strapi.config.constants.flashsale_types_status.fix_money:
                        product.flashsale_price = flashsaleData.reduction;
                        product.flashsale_percent = 100 - ((product.flashsale_price * 100) / product.price);
                        //Check variants
                        if (product.product_variants && product.product_variants.length > 0) {
                            product.product_variants.forEach(function(variantItem) {
                                variantItem.flashsale_price = flashsaleData.reduction;
                                variantItem.flashsale_percent = 100 - ((variantItem.flashsale_price * 100) / variantItem.price);
                            });
                        }
                        break;
                    default:
                        product.flashsale_price = product.price;
                        product.flashsale_percent = 0;
                        break;
                }

            } else {
                //if have not need reset to null
                product.flashsaleproduct = null;
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
                        product.promotion_percent = 100 - ((product.promotion_price * 100) / product.price);
                        //Check variants
                        if (product.product_variants && product.product_variants.length > 0) {
                            product.product_variants.forEach(function(variantItem) {
                                variantItem.promotion_price = variantItem.price - promotionData.reduction;
                                variantItem.promotion_percent = 100 - ((variantItem.promotion_price * 100) / variantItem.price);
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
                        product.promotion_percent = 100 - ((product.promotion_price * 100) / product.price);
                        //Check variants
                        if (product.product_variants && product.product_variants.length > 0) {
                            product.product_variants.forEach(function(variantItem) {
                                variantItem.promotion_price = promotionData.reduction;
                                variantItem.promotion_percent = 100 - ((variantItem.promotion_price * 100) / variantItem.price);
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

        var arrayCategoriesId = '';
        if (product.categories) {
            for (let index = 0; index < product.categories.length; index++) {
                const categoryData = product.categories[index];
                arrayCategoriesId = arrayCategoriesId + categoryData.id + ',';
            }
        }

        if (arrayCategoriesId.length > 0) {
            product.categoryid = arrayCategoriesId.substring(0, arrayCategoriesId.length - 1);
        }

        return product;
    }
};