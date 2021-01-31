'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */
const { sanitizeEntity } = require('strapi-utils');
const _ = require('lodash');
const axios = require('axios');

const removeAuthorFields = (entity) => {
    const sanitizedValue = _.omit(entity, ['created_by', 'updated_by', 'user', 'formats', ]);
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


        //get in table type
        //
        //console.log(ctx.query);
        const params = _.assign({}, ctx.request.body, ctx.params);

        let userId = params.userId;
        let productId = params.productId;
        let dataQuery = {
            user: userId,
            product: productId
        }
        var dataresult = await strapi.query('wishlist').find();
        if (dataresult != null) {
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

        const { userId } = ctx.params;
        let dataQuery = {
            user: userId
        }
        var dataResult = await strapi.query("wishlist").find(dataQuery);
        if (dataResult.length > 0) {
            var dataProductResult = [];

            for (const item of dataResult) {
                console.log(item.product.id);
                var getProductResult = await strapi.query("product").findOne({ id: item.product.id });
                dataProductResult.push(getProductResult);
            }

            let data = Object.values(removeAuthorFields(dataProductResult));
            let productModel = await strapi.services.common.addFullUrl(data);
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