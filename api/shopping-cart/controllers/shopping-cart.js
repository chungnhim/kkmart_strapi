'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

const _ = require("lodash");

module.exports = {
    addProductToCart: async(ctx) => {
        let userId = await strapi.services.common.getLoggedUserId(ctx);

        const params = _.assign({}, ctx.request.body, ctx.params);
        let productId = params.product_id;
        let productVariantId = params.product_variant_id;
        let qtty = params.product_id;
        let shoppingCartId = params.shopping_cart_id == null ? 0 : params.shopping_cart_id;

        var shoppingCart = await strapi.query("shopping-cart").findOne({
            id: shoppingCartId,
        });

        if (_.isNil(shoppingCart)) {
            var cartEntity = {};

            if (userId != 0) {
                cartEntity.user = userId;
            }

            shoppingCart = await strapi.query("shopping-cart").create(cartEntity);
        }

        if (_.isNil(shoppingCart)) {
            ctx.send({
                success: false,
                message: "Cannot add the item to shopping cart"
            });

            return;
        }

        let product = await strapi.controllers.product.getProductById(productId);
        if (_.isNil(product)) {
            ctx.send({
                success: false,
                message: "Product does not exists"
            });

            return;
        }

        var variant = product.product_variants.find(s => s.id == productVariantId);
        if (_.isNil(variant)) {
            ctx.send({
                success: false,
                message: "Product does not exists"
            });

            return;
        }

        var shoppingCartProduct = await strapi.query("shopping-cart-product").create({
            shopping_cart: shoppingCart.id,
            product: productId,
            product_variant: productVariantId,
            qtty: qtty,
            origin_price: variant.price,
            selling_price: variant.selling_price
        });

        if (_.isNil(shoppingCartProduct)) {
            ctx.send({
                success: false,
                message: "Cannot add the item to shopping cart"
            });

            return;
        }

        ctx.send({
            success: true,
            message: "Add the item to shopping cart successfully"
        });
    },
};