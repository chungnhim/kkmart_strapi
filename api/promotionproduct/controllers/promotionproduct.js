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

module.exports = {
    getListPromotionActives: async ctx => {
        var arrayIdActive = await strapi.services.promotionproduct.getPromotionActiveId();
        console.log(arrayIdActive);
        var dateTimeUtcNow = new Date(new Date().toUTCString());
        var dataQuery = {
            id_in: arrayIdActive,
            _sort: "id:asc"
        }
        var dataresult = await strapi.query('promotionproduct').find(dataQuery);
        dataresult = await strapi.services.common.normalizationResponse(
            dataresult
        );
        ctx.send(Object.values(removeAuthorFields(dataresult)));
    },
    searchProducts: async ctx => {
        ctx.send('OK');
    }
};