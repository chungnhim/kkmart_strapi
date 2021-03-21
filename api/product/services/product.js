"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */
const _ = require("lodash");

var removeFields = [
    "shopping_cart_products",
    "order_products",
    "product_ratings",
    "brand",
    "user"
    //"promotionproduct",
    //"flashsaleproduct"
];

module.exports = {

    getProductById: async(productId) => {
        var productResult = await strapi.query("product").findOne({
            id: productId,
        });
        let productModels = await strapi.services.promotionproduct.priceRecalculationOfProduct(productResult);

        productModels = await strapi.services.common.normalizationResponse(
            productModels,
            removeFields
        );
        return productModels;
    },
    getProductOfShoppingCart: async(shoppingCartArray) => {
        for (let index = 0; index < shoppingCartArray.length; index++) {
            var shoppingCartData = shoppingCartArray[index].shopping_cart_products;
            if (shoppingCartData) {
                for (let j = 0; j < shoppingCartData.length; j++) {
                    let shoppingCartDataItems = shoppingCartData[j];
                    if (shoppingCartDataItems) {
                        if (shoppingCartDataItems.product != 'null') {
                            let productId = shoppingCartDataItems.product;
                            shoppingCartDataItems.product = await strapi.services.product.getProductById(productId);
                            //Lay 1 variant cua cart                     
                            var variant_select_data = shoppingCartDataItems.product.product_variants.find(s => s.id = shoppingCartDataItems.product_variant);
                            if (!_.isNil(variant_select_data)) {
                                shoppingCartDataItems.product.product_variants = [];
                                shoppingCartDataItems.product.product_variants.push(variant_select_data);
                            }
                        }
                    }
                }
            }

        }
        return shoppingCartArray;
    },
    getProductOfShoppingCartOne: async(shoppingCart) => {

        var shoppingCartData = shoppingCart.shopping_cart_products;
        if (shoppingCartData) {
            for (let j = 0; j < shoppingCartData.length; j++) {
                let shoppingCartDataItems = shoppingCartData[j];
                if (shoppingCartDataItems) {
                    if (shoppingCartDataItems.product != 'null') {

                        let productId = shoppingCartDataItems.product;
                        shoppingCartDataItems.product = await strapi.services.product.getProductById(productId);
                        //Lay 1 variant cua cart                     
                        var variant_select_data = shoppingCartDataItems.product.product_variants.find(s => s.id = shoppingCartDataItems.product_variant);
                        if (!_.isNil(variant_select_data)) {
                            shoppingCartDataItems.product.product_variants = [];
                            shoppingCartDataItems.product.product_variants.push(variant_select_data);
                        }

                    }
                }
            }
        }
        return shoppingCart;
    },
    getProductOfShoppingCartOneCheckOut: async(shoppingCart, checkoutId) => {
        let cartItem = [];
        var shoppingCartData = shoppingCart.shopping_cart_products.filter(s => s.checkoutid == checkoutId);
        if (shoppingCartData) {
            for (let j = 0; j < shoppingCartData.length; j++) {
                let shoppingCartDataItems = shoppingCartData[j];
                if (shoppingCartDataItems) {
                    if (shoppingCartDataItems.product != 'null') {
                        let productId = shoppingCartDataItems.product;
                        shoppingCartDataItems.product = await strapi.services.product.getProductById(productId);
                        //Lay 1 variant cua cart                     
                        var variant_select_data = shoppingCartDataItems.product.product_variants.find(s => s.id = shoppingCartDataItems.product_variant);
                        if (!_.isNil(variant_select_data)) {
                            shoppingCartDataItems.product.product_variants = [];
                            shoppingCartDataItems.product.product_variants.push(variant_select_data);
                        }
                    }
                }
                cartItem.push(shoppingCartDataItems);
            }
        }
        return cartItem;
    }

};