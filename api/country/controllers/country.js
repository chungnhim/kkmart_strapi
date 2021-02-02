'use strict';
const { sanitizeEntity } = require('strapi-utils');
const _ = require('lodash');

const removeAuthorFields = (entity) => {
    const sanitizedValue = _.omit(entity, ['created_by', 'updated_by', 'created_at', 'updated_at', 'formats', 'user', 'users', 'status']);
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

    async find(ctx) {
        const entity = await strapi.services.country.find();
        const sanitizedEntity = sanitizeEntity(entity, { model: strapi.models.country });
        var dataArrayUrl = removeAuthorFields(sanitizedEntity);
        dataArrayUrl = await strapi.services.common.normalizationResponse(
            dataArrayUrl
        );
        dataArrayUrl = Object.values(removeAuthorFields(dataArrayUrl))
        ctx.send(dataArrayUrl);
    }
};