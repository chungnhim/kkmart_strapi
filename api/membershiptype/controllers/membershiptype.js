'use strict';
const { sanitizeEntity } = require('strapi-utils');
const _ = require('lodash');

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

    async find(ctx) {
        const entity = await strapi.services.membershiptype.find();
        const sanitizedEntity = sanitizeEntity(entity, { model: strapi.models.membershiptype });
        var dataArrayUrl = removeAuthorFields(sanitizedEntity);
        dataArrayUrl = await strapi.services.common.normalizationResponse(
            dataArrayUrl, ["user"]
        );
        dataArrayUrl = Object.values(removeAuthorFields(dataArrayUrl))
        ctx.send(dataArrayUrl);
    }
};