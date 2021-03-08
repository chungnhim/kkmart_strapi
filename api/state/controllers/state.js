'use strict';
const { sanitizeEntity } = require('strapi-utils');
const _ = require('lodash');
/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */
const removeAuthorFields = (entity) => {
    const sanitizedValue = _.omit(entity, ['created_by', 'updated_by', 'created_at', 'updated_at', 'formats', 'users', 'country']);
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
        const entity = await strapi.services.state.find();
        const sanitizedEntity = sanitizeEntity(entity, { model: strapi.models.state });
        var dataArrayUrl = removeAuthorFields(sanitizedEntity);
        dataArrayUrl = await strapi.services.common.normalizationResponse(
            dataArrayUrl, ["user"]
        );
        dataArrayUrl = Object.values(removeAuthorFields(dataArrayUrl))
        ctx.send(dataArrayUrl);
    },
    //===Get state by countryid
    getbycountry: async ctx => {
        const queryString = _.assign({}, ctx.request.query, ctx.params);
        const params = _.assign({}, ctx.request.params, ctx.params);
        var countryid = parseFloat(queryString.countryid);
        var dataresult = await strapi.query('state').find({ country_eq: countryid });
        ctx.send(Object.values(removeAuthorFields(dataresult)));
    },
    getbycountrypost: async ctx => {
        const params = _.assign({}, ctx.request.body, ctx.params);
        let countryid = params.countryid;
        var dataresult = await strapi.query('state').find({ country_eq: countryid });
        ctx.send(Object.values(removeAuthorFields(dataresult)));
    },
};