"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */
const _ = require("lodash");

var removeFields = [
    "shopping_cart_products",
    "order_products",
    "product_ratings",
    "brand",
    "categories"
    //"promotionproduct",
    //"flashsaleproduct"
];

const getProductById = async(productId) => {
    var productResult = await strapi.query("product").findOne({
        id: productId,
    });
    let productModels = await strapi.services.promotionproduct.priceRecalculationOfProduct(productResult);
    productModels = await strapi.services.common.normalizationResponse(
        productModels,
        removeFields
    );
    return productModels;
}

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

        if (!_.isNil(queryString.name) && !_.isEmpty(queryString.name)) {
            dataQuery.name_contains = queryString.name;
        }

        if (!_.isNil(queryString.category_ids) && !_.isEmpty(queryString.category_ids)) {
            dataQuery.categories_in = queryString.category_ids.split(",");
        }

        if (!_.isNil(queryString.min_price) && !_.isEmpty(queryString.min_price)) {
            dataQuery.price_gte = parseFloat(queryString.min_price);
        }

        if (!_.isNil(queryString.max_price) && !_.isEmpty(queryString.max_price)) {
            dataQuery.price_lte = parseFloat(queryString.max_price);
        }

        if (!_.isNil(queryString.rating_point) && !_.isEmpty(queryString.rating_point)) {
            dataQuery.rating_point_gte = parseFloat(queryString.rating_point);
        }

        if (!_.isNil(queryString.promotion_ids) && !_.isEmpty(queryString.promotion_ids)) {
            dataQuery.promotionproduct_in = queryString.promotion_ids.split(",");
        }

        if (!_.isNil(queryString.brand_ids) && !_.isEmpty(queryString.brand_ids)) {
            dataQuery.brand_in = queryString.brand_ids.split(",");
        }

        if (!_.isNil(queryString.price_order) && !_.isEmpty(queryString.price_order)) {
            //low to high
            if (queryString.price_order == '1') {
                dataQuery._sort = 'price:asc';
            }
            //high to low
            if (queryString.price_order == '2') {
                dataQuery._sort = 'price:desc';
            }
            //console.log(dataQuery);
        }
        var totalRows = await strapi.query('product').count(dataQuery);
        var entities = await strapi.query("product").find(dataQuery);
        //Check promotion and flashsale --- get price selling
        for (let index = 0; index < entities.length; index++) {
            entities[index] = await strapi.services.promotionproduct.priceRecalculationOfProduct(entities[index]);
        }

        let productModels = await strapi.services.common.normalizationResponse(
            entities,
            removeFields
        );

        var res = {
            totalRows,
            source: _.values(productModels)
        };

        ctx.send(res);
    },
    getDetails: async(ctx) => {
        let userId = await strapi.services.common.getLoggedUserId(ctx);
        const params = _.assign({}, ctx.request.params, ctx.params);
        let productId = params.product_id;
        var product = await strapi.services.product.getProductById(productId);

        if (!product) {
            ctx.send({});
            return;
        }

        let productModel = await strapi.services.common.normalizationResponse(
            product,
            removeFields
        );
        productModel.is_wish_list = await strapi.services.wishlist.checkWishlist(
            userId,
            productId
        );

        ctx.send(productModel);
    },
    getProductById: async(productId) => {
        return await strapi.services.product.getProductById(productId);
    }
};