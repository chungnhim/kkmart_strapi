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
        const cartItemsId = params.cart_items_id;
        const shippingNote = params.shipping_note;

        if (params.provider == "LALAMOVE") {
            var res = await strapi.services.lalamoveshippingservice.getQuotations(
                userId, userAddressId, cartItemsId, shippingNote
            );

            ctx.send(res);

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
        const cartItemsId = params.cart_items_id;
        const shippingNote = params.shipping_note;

        if (params.provider == "LALAMOVE") {
            var res = await strapi.services.lalamoveshippingservice.placeOrder(
                userId, userAddressId, cartItemsId, shippingNote
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