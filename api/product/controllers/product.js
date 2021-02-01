"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */
const { sanitizeEntity } = require("strapi-utils");
const _ = require("lodash");
const axios = require("axios");

module.exports = {
    searchProducts: async(ctx) => {
        const queryString = _.assign({}, ctx.request.query, ctx.params);
        const params = _.assign({}, ctx.request.params, ctx.params);

        let pageIndex = 1,
            pageSize = 10;

        if (!_.isNil(params.page_index) && !_.isNil(params.page_size)) {
            pageIndex = parseInt(params.page_index);
            pageSize = parseInt(params.page_size);
        }

        var dataQuery = {
            _start: (pageIndex - 1) * pageSize,
            _limit: pageSize,
            _sort: "name:desc",
        };

        if (!_.isNil(queryString.name)) {
            dataQuery.name_contains = queryString.name;
        }

        if (!_.isNil(queryString.category_ids)) {
            dataQuery.categoryid_in = queryString.category_ids.split(",");
        }

        if (!_.isNil(queryString.min_price)) {
            dataQuery.price_gte = parseFloat(queryString.min_price);
        }

        if (!_.isNil(queryString.max_price)) {
            dataQuery.price_lte = parseFloat(queryString.max_price);
        }

        if (!_.isNil(queryString.rating_point)) {
            dataQuery.rating_point_gte = parseFloat(queryString.rating_point);
        }

        var totalRows = await strapi.query('product').count(dataQuery);
        var entities = await strapi.query("product").find(dataQuery);
        let productModels = await strapi.services.common.normalizationResponse(
            entities
        );

        var res = {
            totalRows,
            source: _.values(productModels)
        };

        ctx.send(res);
    },
    getDetails: async(ctx) => {
        var userId = 0;
        if (ctx.request && ctx.request.header && ctx.request.header.authorization) {
            try {
                const { id, isAdmin = false } = await strapi.plugins[
                    "users-permissions"
                ].services.jwt.getToken(ctx);
                userId = id;
            } catch (err) {
                //return handleErrors(ctx, err, 'unauthorized');
            }
        }

        const params = _.assign({}, ctx.request.params, ctx.params);
        let productId = params.product_id;
        var product = await strapi.query("product").findOne({
            id: productId,
        });

        if (!product) {
            ctx.send({});
            return;
        }

        let productModel = await strapi.services.common.normalizationResponse(product);
        productModel.is_wish_list = await strapi.services.wishlist.checkWishlist(
            userId,
            productId
        );

        ctx.send(productModel);
    },
};