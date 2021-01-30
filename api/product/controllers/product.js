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

const prepareProductModel = (product) => {
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

    product.is_wish_list = false;
    return product;
}

module.exports = {
    searchproducts: async (ctx) => {
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
    getDetails: async (ctx) => {
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

        productModel = prepareProductModel(productModel);
        ctx.send(productModel);
    },
};
