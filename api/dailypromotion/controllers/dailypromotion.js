'use strict';
const { sanitizeEntity } = require('strapi-utils');
const _ = require('lodash');
/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */
const removeAuthorFields = (entity) => {
    const sanitizedValue = _.omit(entity, ['created_by', 'updated_by', 'created_at', 'updated_at', 'formats', 'user', 'dailypromotiondetail', 'status', 'dailypromotiontype']);
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

    async findOne(ctx) {
        const { id } = ctx.params;

        const entity = await strapi.services.dailypromotion.findOne({ id });
        const sanitizedEntity = sanitizeEntity(entity, { model: strapi.models.dailypromotion });
        return removeAuthorFields(sanitizedEntity);
    },
    async find(ctx) {
        let entities;
        if (ctx.query._q) {
            entities = await strapi.services.dailypromotion.search(ctx.query);
        } else {
            entities = await strapi.services.dailypromotion.find(ctx.query);
        }
        return entities.map(entity => {
            const dailypromotion = sanitizeEntity(entity, {
                model: strapi.models.dailypromotion,
            });
            return removeAuthorFields(dailypromotion);
        });
    },
    getcouponcodetext: async ctx => {
        var dataresult = await strapi.query('dailypromotion').find({ status_eq: 3, dailypromotiontype_eq: 1 });
        ctx.send(Object.values(removeAuthorFields(dataresult)));
    },
    getcouponcodeimage: async ctx => {
        var dataresult = await strapi.query('dailypromotion').find({ status_eq: 3, dailypromotiontype_eq: 2 });
        ctx.send(Object.values(removeAuthorFields(dataresult)));
    },
    getecatalogue: async ctx => {
        var dataresult = await strapi.query('dailypromotion').find({ status_eq: 3, dailypromotiontype_eq: 3 });
        ctx.send(Object.values(removeAuthorFields(dataresult)));
    },
    getpopup: async ctx => {
        var dataresult = await strapi.query('dailypromotion').find({ status_eq: 3, dailypromotiontype_eq: 4 });
        ctx.send(Object.values(removeAuthorFields(dataresult)));
    },
    getproductionlist: async ctx => {
        var dataresult = await strapi.query('dailypromotion').find({ status_eq: 3, dailypromotiontype_eq: 5 });
        ctx.send(Object.values(removeAuthorFields(dataresult)));
    },
    getproductioncategory: async ctx => {
        var dataresult = await strapi.query('dailypromotion').find({ status_eq: 3, dailypromotiontype_eq: 5 });
        ctx.send(Object.values(removeAuthorFields(dataresult)));
    },
    getnewoutlet: async ctx => {
        var dataresult = await strapi.query('dailypromotion').find({ status_eq: 3, dailypromotiontype_eq: 7 });
        ctx.send(Object.values(removeAuthorFields(dataresult)));
    },
    getcampaign: async ctx => {
        var dataresult = await strapi.query('dailypromotion').find({ status_eq: 3, dailypromotiontype_eq: 8 });
        ctx.send(Object.values(removeAuthorFields(dataresult)));
    },
    getmemberexclusive: async ctx => {
        var dataresult = await strapi.query('dailypromotion').find({ status_eq: 3, dailypromotiontype_eq: 9 });
        ctx.send(Object.values(removeAuthorFields(dataresult)));
    }
};