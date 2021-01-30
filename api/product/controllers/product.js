"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */
const { sanitizeEntity } = require("strapi-utils");
const _ = require("lodash");
const axios = require("axios");

const removeAuthorFields = (entity) => {
    const sanitizedValue = _.omit(entity, ['created_by', 'updated_by', 'created_at', 'updated_at']);
    _.forEach(sanitizedValue, (value, key) => {
        if (_.isArray(value)) {
            sanitizedValue[key] = value.map(removeAuthorFields);
        } else if (_.isObject(value)) {
            sanitizedValue[key] = removeAuthorFields(value);
        }
    });

    return sanitizedValue;
};


module.exports = {
    searchproducts: async(ctx) => {
        const params = _.assign({}, ctx.request.body, ctx.params);

        let name = params.name;
        var dataQuery = {
            name_contains: name,
            _start: 0,
            _limit: 10,
            _sort: "name:desc",
        };

        console.log(dataQuery);
        var dataresult = await strapi.query("product").find(dataQuery);
        let data = Object.values(removeAuthorFields(dataresult));
        ctx.send(data);
    },
    getDetails: async(ctx) => {
        //checkUser
        //check jwt token
        var userId = 0;
        if (ctx.request && ctx.request.header && ctx.request.header.authorization) {
            try {
                const { id, isAdmin = false } = await strapi.plugins['users-permissions'].services.jwt.getToken(ctx);
                userId = id;
            } catch (err) {
                //return handleErrors(ctx, err, 'unauthorized');
            }
        }
        //
        const params = _.assign({}, ctx.request.params, ctx.params);

        let productId = params.productId;
        var product = await strapi.query("product").findOne({
            id: productId,
        });

        if (!product) {
            ctx.send({});
            return;
        }

        let productModels = Object.values(removeAuthorFields([product]));
        let productModel = null;
        if (productModels.length > 0) {
            productModel = productModels[0];
        }

        productModel = await strapi.services.common.addFullUrl(productModel);
        productModel.is_wish_list = await strapi.services.wishlist.checkWishlist(userId, product.id);
        let data = removeAuthorFields(productModel);
        ctx.send(data);
    },
};