'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

const moment = require('moment');
const _ = require("lodash");

const generateOrderCode = (length = 6) => {
    let text = ''
    let possible = '0123456789'
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length))
    }

    return moment.utc(new Date).format("YYYYMMDD") + text;
}

module.exports = {
    preCheckOut: async (ctx) => {
        const params = _.assign({}, ctx.request.body, ctx.params);
        let userId = await strapi.services.common.getLoggedUserId(ctx);
        if (_.isNil(userId) || userId == 0) {
            ctx.send({
                success: false,
                message: "To complete this payment, please login to your account"
            });

            return;
        }

        var shoppingCartId = params.shopping_cart_id;
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

        let totalAmount = 0;
        let discountAmount = 0;
        let hasError = false;
        let orderProductEntities = [];

        for (let index = 0; index < shoppingCart.shopping_cart_products.length; index++) {
            const cartItem = shoppingCart.shopping_cart_products[index];
            let product = await strapi.controllers.product.getProductById(cartItem.product);
            if (_.isNil(product)) {
                hasError = true;

                return;
            }

            let variant = product.product_variants.find(s => s.product_variant == product.product_variant);
            if (_.isNil(variant)) {
                hasError = true;

                return;
            }

            totalAmount += variant.selling_price * variant.qtty;
            orderProductEntities.push({
                order: 0,
                products: product.id,
                product_variants: variant.id,
                qtty: cartItem.qtty,
                origin_price: 0,
                selling_price: variant.selling_price,
                currency: params.currency,
                discount_amount: 0,
                note: null
            });
        }

        if (hasError) {
            ctx.send({
                success: false,
                message: "Product does not exists"
            });

            return;
        }

        let orderEntity = {
            order_code: generateOrderCode(5),
            order_via: "Web",
            order_status: 1,
            payment_status: 1,
            shipping_status: 1,
            total_amount: totalAmount,
            currency: params.currency,
            discount_amount: discountAmount,
            order_note: "",
            user: userId
        };

        var order = await strapi.query("order").create(orderEntity);
        if (_.isNil(order)) {
            ctx.send({
                success: false,
                message: "Checkout failed"
            });

            return;
        }

        orderProductEntities.forEach(item => {
            item.order = order.id;
        });

        console.log(`orderProductEntities`, orderProductEntities);

        var orderProducts = await strapi.query("order-product").create(orderProductEntities);
        console.log(`orderProducts`, orderProducts);

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
