'use strict';
const { sanitizeEntity } = require('strapi-utils');
const _ = require('lodash');
/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */
const removeAuthorFields = (entity) => {
    const sanitizedValue = _.omit(entity, ['created_by', 'updated_by', 'created_at', 'updated_at', 'formats', 'user', 'status', 'products']);
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
    findcategories: async ctx => {
        var dataresult = await strapi.query('category').find({ level_eq: 1, isenable_eq: true });
        var dataArrayUrl = Object.values(removeAuthorFields(dataresult))
        var dataArrayUrl = await strapi.services.common.normalizationResponse(
            dataArrayUrl
        );
        dataArrayUrl = Object.values(removeAuthorFields(dataArrayUrl))
        ctx.send(dataArrayUrl);
    },

    findsubcategories: async ctx => {

        const params = _.assign({}, ctx.request.body, ctx.params);
        let parentid = params.parentid;
        if (parentid == null) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'category.getcategories.parentid',
                    message: 'parentid is requied.',
                })
            );
        } else {
            var dataresult = await strapi.query('category').find({ parentid_eq: parentid, isenable_eq: true });
            var dataArrayUrl = Object.values(removeAuthorFields(dataresult))
            var dataArrayUrl = await strapi.services.common.normalizationResponse(
                dataArrayUrl
            );
            dataArrayUrl = Object.values(removeAuthorFields(dataArrayUrl))
            ctx.send(dataArrayUrl);
        }
    },
};