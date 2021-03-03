'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

const _ = require("lodash");

module.exports = {
    find: async(ctx) => {
        let userId = await strapi.services.common.getLoggedUserId(ctx);
        if (userId == 0) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'Invalidate Token',
                    message: 'Invalidate Token',
                })
            );
        }
        var shoppingCart = await strapi.query("shopping-cart").find({
            user: userId,
            status: strapi.config.constants.shopping_cart_status.new
        });
        //

        shoppingCart = await strapi.services.product.getProductOfShoppingCart(shoppingCart);

        let cartModel = await strapi.services.common.normalizationResponse(shoppingCart);
        ctx.send({
            success: true,
            cart: Object.values(cartModel)
        });
    },
    addProductToCart: async(ctx) => {
        let userId = await strapi.services.common.getLoggedUserId(ctx);

        const params = _.assign({}, ctx.request.body, ctx.params);
        let productId = params.product_id;
        let productVariantId = params.product_variant_id;
        let qtty = params.qtty;
        let shoppingCartId = params.shopping_cart_id == null ? 0 : params.shopping_cart_id;

        var shoppingCart = await strapi.query("shopping-cart").findOne({
            id: shoppingCartId,
        });

        if (_.isNil(shoppingCart)) {
            var cartEntity = {
                status: strapi.config.constants.shopping_cart_status.new
            };

            if (userId != 0) {
                cartEntity.user = userId;
            }

            shoppingCart = await strapi.query("shopping-cart").create(cartEntity);
        } else {
            if (userId != 0) {
                shoppingCart.user = userId;
            }

            shoppingCart = await strapi.query("shopping-cart").update({ id: shoppingCart.id }, shoppingCart);
        }

        if (_.isNil(shoppingCart)) {
            ctx.send({
                success: false,
                message: "Cannot add the item to shopping cart"
            });

            return;
        }

        let product = await strapi.services.product.getProductById(productId);
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

        var existsProduct = shoppingCart.shopping_cart_products.find(s => s.product == productId && s.product_variant == productVariantId);
        var shoppingCartProduct = null;

        if (_.isNil(existsProduct)) {
            // Case add new item to cart            
            console.log('Case add new item to cart');

            shoppingCartProduct = await strapi.query("shopping-cart-product").create({
                shopping_cart: shoppingCart.id,
                product: productId,
                product_variant: productVariantId,
                qtty: qtty,
                origin_price: variant.price,
                selling_price: variant.selling_price
            });
        } else {
            // Case update qtty of an existing item
            console.log('Case update qtty of an existing item');

            existsProduct.qtty += qtty;
            shoppingCartProduct = await strapi.query("shopping-cart-product").update({ id: existsProduct.id },
                existsProduct
            );
        }

        if (_.isNil(shoppingCartProduct)) {
            ctx.send({
                success: false,
                message: "Cannot add the item to shopping cart"
            });

            return;
        }

        ctx.send({
            success: true,
            message: "Add the item to shopping cart successfully",
            cart_id: shoppingCart.id
        });
    },
    getCart: async(ctx) => {
        const params = _.assign({}, ctx.request.params, ctx.params);

        var shoppingCartId = params.shopping_cart_id;
        var shoppingCart = await strapi.query("shopping-cart").findOne({
            id: shoppingCartId,
        });

        shoppingCart = await strapi.services.product.getProductOfShoppingCartOne(shoppingCart);
        let cartModel = await strapi.services.common.normalizationResponse(shoppingCart);
        ctx.send({
            success: true,
            cart: cartModel
        });
    },
    removeCartItem: async(ctx) => {
        const params = _.assign({}, ctx.request.params, ctx.params);
        let cartProductId = params.cart_product_id;
        var shoppingCartId = params.shopping_cart_id;

        console.log(params);

        var shoppingCart = await strapi.query("shopping-cart").findOne({
            id: shoppingCartId,
        });

        if (_.isNil(shoppingCart)) {
            ctx.send({
                success: false,
                message: "Shopping cart does not exists"
            });

            return;
        }

        var existsProduct = shoppingCart.shopping_cart_products.find(s => s.id == cartProductId);
        if (_.isNil(existsProduct)) {
            ctx.send({
                success: false,
                message: "Product does not exists"
            });

            return;
        }

        var res = await strapi.query("shopping-cart-product").delete({
            id: cartProductId,
        });

        if (!_.isNil(res) && res.id == cartProductId) {
            ctx.send({
                success: true,
                message: "Cart item has been remove successfully"
            });
        }

        ctx.send({
            success: false,
            message: "Product does not exists"
        });
    }
};