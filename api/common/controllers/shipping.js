'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

const _ = require('lodash');
const formatError = error => [
    { messages: [{ id: error.id, message: error.message, field: error.field }] },
];

module.exports = {
    async getConfiguration(ctx) {
        var res = await strapi.services.lalamoveshippingservice.getConfiguration();
        ctx.send(res);
    },
    async shippingProvider(ctx) {
        var res = [
            {
                key: "LALAMOVE",
                name: "Lalamove shipping provider"
            }
        ];

        ctx.send(res);
    },
    async getQuotations(ctx) {
        let userId = await strapi.services.common.getLoggedUserId(ctx);
        if (userId == 0) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'Invalid Token',
                    message: 'Invalid Token',
                })
            );
        }

        const params = _.assign({}, ctx.request.body, ctx.params);
        const userAddressId = params.user_address_id;
        const shippingNote = params.shipping_note;

        var shoppingCart = await strapi.query("shopping-cart").findOne({
            user: userId,
            status: strapi.config.constants.shopping_cart_status.new,
            _sort: "id:desc"
        });

        if (_.isNil(shoppingCart)) {
            return {
                success: false,
                message: "Shopping cart does not exists"
            }
        }

        if (_.isNil(shoppingCart.shopping_cart_products) || shoppingCart.shopping_cart_products.length == 0) {
            return {
                success: false,
                message: "No product in shopping cart"
            }
        }

        let products = shoppingCart.shopping_cart_products.filter(s => params.cart_items_id.includes(s.id));
        if (_.isNil(products) || products.length == 0) {
            return {
                success: false,
                message: "Products does not exists in shopping cart"
            }
        }

        if (params.provider == "LALAMOVE") {
            var res = await strapi.services.lalamoveshippingservice.getQuotations(
                userAddressId, products, shippingNote, null
            );

            ctx.send({
                success: res.success,
                totalFee: res.totalFee,
                totalFeeCurrency: res.totalFeeCurrency
            });

            return;
        }

        ctx.send({
            success: false,
            message: "No shipping provider supported"
        });
    },
    async placeOrder(ctx) {
        let userId = await strapi.services.common.getLoggedUserId(ctx);
        if (userId == 0) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'Invalid Token',
                    message: 'Invalid Token',
                })
            );
        }

        const params = _.assign({}, ctx.request.body, ctx.params);
        const userAddressId = params.user_address_id;
        const shippingNote = params.shipping_note;

        var shoppingCart = await strapi.query("shopping-cart").findOne({
            user: userId,
            status: strapi.config.constants.shopping_cart_status.new,
            _sort: "id:desc"
        });

        if (_.isNil(shoppingCart)) {
            return {
                success: false,
                message: "Shopping cart does not exists"
            }
        }

        if (_.isNil(shoppingCart.shopping_cart_products) || shoppingCart.shopping_cart_products.length == 0) {
            return {
                success: false,
                message: "No product in shopping cart"
            }
        }

        let products = shoppingCart.shopping_cart_products.filter(s => params.cart_items_id.includes(s.id));
        if (_.isNil(products) || products.length == 0) {
            return {
                success: false,
                message: "Products does not exists in shopping cart"
            }
        }

        if (params.provider == "LALAMOVE") {
            var res = await strapi.services.lalamoveshippingservice.placeOrder(
                userAddressId, products, shippingNote, null
            );

            ctx.send(res);
            return;
        }

        ctx.send({
            success: false,
            message: "No shipping provider supported"
        });
    },
    async getOrderDetails(ctx) {
        const params = _.assign({}, ctx.request.params, ctx.params);
        if (params.provider == "LALAMOVE") {
            var res = await strapi.services.lalamoveshippingservice.getOrderDetails(
                params.orderRef
            );

            ctx.send(res);

            return;
        }

        ctx.send({
            success: false,
            message: "No shipping provider supported"
        });
    }
};