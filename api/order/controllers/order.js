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

const getByOrderCode = async (orderCode) => {
    var order = await strapi.query("order").findOne({
        order_code: orderCode,
    });

    return order;
}

module.exports = {
    checkOut: async (ctx) => {
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

            totalAmount += variant.selling_price * cartItem.qtty;
            orderProductEntities.push({
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
            order_via: params.order_via,
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
                message: "Pre checkout failed"
            });

            return;
        }

        for (let i = 0; i < orderProductEntities.length; i++) {
            const product = orderProductEntities[i];
            product.order = order.id;

            await strapi.query("order-product").create(product);
        }

        // Add shipping information
        var shipping = {
            order: order.id,
            full_name: params.shipping.full_name,
            phone_number: params.shipping.phone_number,
            province_id: params.shipping.province_id,
            district_id: params.shipping.district_id,
            ward_id: params.shipping.ward_id,
            address: params.shipping.address,
            note: params.shipping.note,
            status: 1,
            deliver_date: null,
            actual_deliver_date: null,
            deliver_note: null,
            shipping_provider: null
        };

        await strapi.query("order-shipping").create(shipping);

        ctx.send({
            success: true,
            message: "Pre checkout has been successfully",
            order_id: order.id,
            total_amount: totalAmount,
            discount_amount: discountAmount,
            order_code: orderEntity.order_code
        });
    },
    getByOrderCode: async (ctx) => {
        const params = _.assign({}, ctx.request.params, ctx.params);
        var orderCode = params.orderCode;

        if (_.isNil(orderCode)) {
            ctx.send({
                success: false,
                message: "Please input order code"
            });

            return;
        }

        var order = await getByOrderCode(orderCode);
        if (_.isNil(order)) {
            ctx.send({
                success: false,
                message: "Order not found"
            });

            return;
        }

        console.log(`res`, res);

        var res = await strapi.services.common.normalizationResponse(
            order
        );

        ctx.send({
            success: true,
            order: res
        });

    }
};
