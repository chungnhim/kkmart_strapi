'use strict';
const { sanitizeEntity } = require('strapi-utils');
const _ = require('lodash');
/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */
const removeAuthorFields = (entity) => {
    const sanitizedValue = _.omit(entity, ['created_by', 'updated_by', 'created_at', 'updated_at', 'formats', 'user', 'status']);
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

    getEFastTunnel: async ctx => {
        var dataresult = await strapi.query('efasttunnel').find({ isactive_eq: true });
        var dataArrayUrl = Object.values(removeAuthorFields(dataresult))
        var dataArrayUrl = await strapi.services.common.normalizationResponse(
            dataArrayUrl, ["user"]
        );
        dataArrayUrl = Object.values(removeAuthorFields(dataArrayUrl))
        ctx.send(dataArrayUrl);
    },
};