'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

const _ = require('lodash');
const formatError = error => [
    { messages: [{ id: error.id, message: error.message, field: error.field }] },
];

const buildLalamoveReq = async (userId, userAddressId, cartItemsId, shippingNote) => {
    console.log(`userId`, userId);

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

    let weigh = 0;
    shoppingCart.shopping_cart_products.filter(s => cartItemsId.includes(s.id)).forEach(product => {
        weigh += (_.isNil(product.weight) ? 0 : parseFloat(product.weight));
    });

    var userAddress = await strapi.query("user-address").findOne({ id: userAddressId });
    if (_.isNil(userAddress)) {
        return {
            success: false,
            message: "User address not found"
        }
    }

    var nearMe = await strapi.services.outlet.getNearMe(userAddress.longitude,
        userAddress.latitude,
        100000);

    if (nearMe.length == 0) {
        return {
            success: false,
            message: "Can not detect pickup address"
        }
    }

    let pickUpPoint = {
        address: nearMe[0].address,
        latitude: nearMe[0].latitude,
        longitude: nearMe[0].longitude,
        countryCode: nearMe[0].country.codeiso2,
        name: nearMe[0].name,
        phone: nearMe[0].telephone,
        remarks: ""
    };

    let deliverAddress = `${userAddress.address1}, ${userAddress.city}, ${userAddress.state.name}, ${userAddress.country.name}`;
    let deliverPoint = {
        address: deliverAddress,
        latitude: userAddress.latitude,
        longitude: userAddress.longitude,
        countryCode: userAddress.country.codeiso2,
        name: userAddress.full_name,
        phone: userAddress.phone_number,
        remarks: shippingNote
    }

    return {
        weigh: weigh,
        pickUpPoint: pickUpPoint,
        deliverPoint: deliverPoint
    }
}

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

        var reqParams = await buildLalamoveReq(userId, userAddressId, cartItemsId, shippingNote);

        if (params.provider == "LALAMOVE") {
            var res = await strapi.services.lalamoveshippingservice.getQuotations(
                params.schedule_at, reqParams.weigh, reqParams.pickUpPoint, reqParams.deliverPoint
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

        var reqParams = await buildLalamoveReq(userId, userAddressId, cartItemsId, shippingNote);
        if (params.provider == "LALAMOVE") {
            var res = await strapi.services.lalamoveshippingservice.placeOrder(
                params.schedule_at, reqParams.weigh, reqParams.pickUpPoint, reqParams.deliverPoint
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