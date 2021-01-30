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

module.exports = {
    searchproducts: async ctx => {
        //get in table type
        //
        //console.log(ctx.query);
        const params = _.assign({}, ctx.request.body, ctx.params);

        let name = params.name;
        var dataQuery = {
            name_contains: name,
            _start: 0,
            _limit: 10,
            _sort: 'name:desc'
        };

        console.log(dataQuery);
        var dataresult = await strapi.query('product').find(dataQuery);
        let data = Object.values(removeAuthorFields(dataresult));
        ctx.send(data);

    }

};