'use strict';
const { sanitizeEntity } = require('strapi-utils');
const _ = require('lodash');
/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */
const removeAuthorFields = (entity) => {
    const sanitizedValue = _.omit(entity, ['created_by', 'updated_by', 'created_at', 'updated_at', 'formats']);
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

    //===Get state by countryid
    async feedbackinfo(ctx) {
        let dataquery = { systemdocumenttype_eq: '4', _sort: 'order:asc' };
        let systemdocumentData = await strapi.services.systemdocument.find(dataquery);
        ctx.send(Object.values(removeAuthorFields(systemdocumentData)));
    },
};