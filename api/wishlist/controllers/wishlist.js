'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */
const { sanitizeEntity } = require('strapi-utils');
const _ = require('lodash');
const axios = require('axios');

const removeAuthorFields = (entity) => {
    const sanitizedValue = _.omit(entity, ['created_by', 'updated_by', 'user', 'formats', 'shopping_cart_products',
        'product_ratings', 'order_products'
    ]);
    _.forEach(sanitizedValue, (value, key) => {
        if (_.isArray(value)) {
            sanitizedValue[key] = value.map(removeAuthorFields);
        } else if (_.isObject(value)) {
            if (key == 'created_at' || key == 'updated_at') {
                if (new Date(value) !== "Invalid Date" && !isNaN(new Date(value))) {
                    if (value == new Date(value).toISOString()) {
                        sanitizedValue[key] = value;
                    }
                }

            } else {
                sanitizedValue[key] = removeAuthorFields(value);
            }
        }
    });

    return sanitizedValue;
};

const formatError = error => [
    { messages: [{ id: error.id, message: error.message, field: error.field }] },
];

module.exports = {

    addOrRemove: async ctx => {

        var userId = 0;
        if (ctx.request && ctx.request.header && ctx.request.header.authorization) {
            try {
                const { id, isAdmin = false } = await strapi.plugins[
                    "users-permissions"
                ].services.jwt.getToken(ctx);
                userId = id;

            } catch (err) {}
        }

        if (userId == 0) {
            ctx.unauthorized(`You're not logged in!`);

            return;
        }

        //get in table type
        //
        //console.log(ctx.query);
        const params = _.assign({}, ctx.request.body, ctx.params);
        let productId = params.productId;
        let dataQuery = {
            user: userId,
            product: productId
        }
        var dataresult = await strapi.query('wishlist').find(dataQuery);
        if (dataresult != null && dataresult.length > 0) {
            await strapi.query('wishlist').delete({ id: dataresult[0].id });
            ctx.send({
                statusCode: 0,
                error: 'none',
                message: formatError({
                    id: 'success',
                    message: 'remove wishlist success',
                }),
            });
        } else {
            await strapi.query('wishlist').create(dataQuery);
            ctx.send({
                statusCode: 0,
                error: 'none',
                message: formatError({
                    id: 'success',
                    message: 'add wishlist success',
                }),
            });
        }

    },
    async getOfUser(ctx) {

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

        let dataQuery = {
            user: userId
        }

        var dataResult = await strapi.query("wishlist").find(dataQuery);
        if (dataResult.length > 0) {
            var dataProductResult = [];

            for (const item of dataResult) {
                if (item.product != null) {
                    //console.log(item.product.id);
                    var getProductResult = await strapi.query("product").findOne({ id: item.product.id });
                    getProductResult = await strapi.services.promotionproduct.priceRecalculationOfProduct(getProductResult);
                    getProductResult.is_wish_list = await strapi.services.wishlist.checkWishlist(
                        userId,
                        getProductResult.id
                    );
                    dataProductResult.push(getProductResult);
                }
            }

            let data = Object.values(removeAuthorFields(dataProductResult));
            let productModel = await strapi.services.common.normalizationResponse(data, ["user"]);
            ctx.send(Object.values(productModel));
        } else {
            ctx.send({
                statusCode: 0,
                error: 'none',
                message: formatError({
                    id: 'success',
                    message: 'have not wish list',
                }),
            });
        }

    }

};