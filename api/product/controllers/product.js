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
            let item = removeAuthorFields(value);
            sanitizedValue[key] = prepareProductModel(item);
        }
    });

    return sanitizedValue;
};

const prepareProductModel = (product, userId) => {
    let API_ENPOINT = "";
    if (!_.isNil(process.env.API_ENPOINT.trim())) {
        API_ENPOINT = process.env.API_ENPOINT.trim();
    }

    _.forEach(product.productimages, (value, key) => {
        if (!_.isNil(value.image) && !_.isNil(value.image.formats)) {
            if (!_.isNil(value.image.formats.small)) {
                value.image.formats.small.url = `${API_ENPOINT}${value.image.formats.small.url}`
            }

            if (!_.isNil(value.image.formats.medium)) {
                value.image.formats.medium.url = `${API_ENPOINT}${value.image.formats.medium.url}`
            }

            if (!_.isNil(value.image.formats.thumbnail)) {
                value.image.formats.thumbnail.url = `${API_ENPOINT}${value.image.formats.thumbnail.url}`
            }
        }
    });



    return product;
}

module.exports = {
    searchProducts: async (ctx) => {
        const queryString = _.assign({}, ctx.request.query, ctx.params);
        const params = _.assign({}, ctx.request.params, ctx.params);

        let name = queryString.name;
        let pageIndex = 1, pageSize = 10;

        if (!_.isNil(params.page_index) && !_.isNil(params.page_size)) {
            pageIndex = parseInt(params.page_index);
            pageSize = parseInt(params.page_size);
        }

        var dataQuery = {
            _start: (pageIndex - 1) * pageSize,
            _limit: pageSize,
            _sort: "name:desc",
        };

        if (!_.isNil(name)) {
            dataQuery.name_contains = name;
        }

        var entity = await strapi.query("product").find(dataQuery);
        let productModels = Object.values(removeAuthorFields(entity));
        ctx.send(productModels);
    },
    getDetails: async (ctx) => {
        //checkUser
        //check jwt token
        var userId = 0;
        console.log(userId);
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

        let productId = params.product_id;
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

        productModel = prepareProductModel(productModel, userId);
        productModel.is_wish_list = await strapi.services.wishlist.checkWishlist(userId, product.id);
        let data = removeAuthorFields(productModel);
        ctx.send(data);
    },
};