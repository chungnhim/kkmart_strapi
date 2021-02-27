'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */
const { sanitizeEntity } = require('strapi-utils');
const _ = require('lodash');
const axios = require('axios');

const removeAuthorFields = (entity) => {
    const sanitizedValue = _.omit(entity, ['created_by', 'updated_by', 'user', 'formats', 'promotiontype',
        'reduction', 'promotionapplytype', 'promotionapplyfor', 'activedate', 'enddate', 'isenddate', 'created_at', 'updated_at', 'numberapply', 'isfreeship',
        'products'
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

var removeFields = [
    "shopping_cart_products",
    "order_products",
    "product_ratings",
    "brand",
    //"promotionproduct",
    //"flashsaleproduct"
];

module.exports = {
    searchProducts: async ctx => {

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
            dataQuery.categoryid_in = queryString.category_ids.split(",");
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

        if (!_.isNil(queryString.brand_ids) && !_.isEmpty(queryString.brand_ids)) {
            dataQuery.brand_in = queryString.brand_ids.split(",");
        }

        if (!_.isNil(queryString.promotion_ids) && !_.isEmpty(queryString.promotion_ids)) {
            dataQuery.promotionproduct_in = queryString.promotion_ids.split(",");
        }

        if (!_.isNil(queryString.flashsale_ids) && !_.isEmpty(queryString.flashsale_ids)) {
            var arrayFlashsaleProduct = await strapi.services.promotionproduct.getListFlashSaleProductsActivesId(flashsale_ids);
            dataQuery.flashsaleproduct_in = arrayFlashsaleProduct;
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
    }
};