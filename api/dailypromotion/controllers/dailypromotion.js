'use strict';
const { sanitizeEntity } = require('strapi-utils');
const _ = require('lodash');
/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */
const removeAuthorFields = (entity) => {
    const sanitizedValue = _.omit(entity, ['created_by', 'updated_by', 'created_at', 'updated_at', 'formats', 'user',
        'dailypromotiondetail'
    ]);
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
        //Add more filter
        const now = new Date;
        var utc_timestamp = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(),
            now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());

        if (entities && entities.length > 0) {
            //entities = entities.filter(x => x.status = 3 && x.starttime < utc_timestamp && x.endtime > utc_timestamp);
            entities = entities.filter(x => x.status = 3);

            // var entities = await strapi.services.common.normalizationResponse(
            //     entities, ["user"]
            // );

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
        var dailypromotionModels = await strapi.services.common.normalizationResponse(
            dataresult, ["user"]
        );
        ctx.send(Object.values(removeAuthorFields(dailypromotionModels)));
    },
    getcouponcodeimage: async ctx => {
        var dataresult = await strapi.query('dailypromotion').find({ status_eq: 3, dailypromotiontype_eq: 2 });
        var dailypromotionModels = await strapi.services.common.normalizationResponse(
            dataresult, ["user"]
        );
        ctx.send(Object.values(removeAuthorFields(dailypromotionModels)));
    },
    getecatalogue: async ctx => {
        var dataresult = await strapi.query('dailypromotion').find({ status_eq: 3, dailypromotiontype_eq: 3 });
        var dailypromotionModels = await strapi.services.common.normalizationResponse(
            dataresult, ["user"]
        );
        ctx.send(Object.values(removeAuthorFields(dailypromotionModels)));
    },
    getpopup: async ctx => {
        var dataresult = await strapi.query('dailypromotion').find({ status_eq: 3, dailypromotiontype_eq: 4 });
        var dailypromotionModels = await strapi.services.common.normalizationResponse(
            dataresult, ["user"]
        );
        ctx.send(Object.values(removeAuthorFields(dailypromotionModels)));
    },
    getproductionlist: async ctx => {
        var dataresult = await strapi.query('dailypromotion').find({ status_eq: 3, dailypromotiontype_eq: 5 });
        var dailypromotionModels = await strapi.services.common.normalizationResponse(
            dataresult, ["user"]
        );
        ctx.send(Object.values(removeAuthorFields(dailypromotionModels)));
    },
    getproductioncategory: async ctx => {
        var dataresult = await strapi.query('dailypromotion').find({ status_eq: 3, dailypromotiontype_eq: 5 });
        var dailypromotionModels = await strapi.services.common.normalizationResponse(
            dataresult, ["user"]
        );
        ctx.send(Object.values(removeAuthorFields(dailypromotionModels)));
    },
    getnewoutlet: async ctx => {
        var dataresult = await strapi.query('dailypromotion').find({ status_eq: 3, dailypromotiontype_eq: 7 });
        var dailypromotionModels = await strapi.services.common.normalizationResponse(
            dataresult, ["user"]
        );
        ctx.send(Object.values(removeAuthorFields(dailypromotionModels)));
    },
    getcampaign: async ctx => {
        var dataresult = await strapi.query('dailypromotion').find({ status_eq: 3, dailypromotiontype_eq: 8 });
        var dailypromotionModels = await strapi.services.common.normalizationResponse(
            dataresult, ["user"]
        );
        ctx.send(Object.values(removeAuthorFields(dailypromotionModels)));
    },
    getmemberexclusive: async ctx => {
        var dataresult = await strapi.query('dailypromotion').find({ status_eq: 3, dailypromotiontype_eq: 9 });
        var dailypromotionModels = await strapi.services.common.normalizationResponse(
            dataresult, ["user"]
        );
        ctx.send(Object.values(removeAuthorFields(dailypromotionModels)));
    },
    getPromotionBanner: async ctx => {
        var dataresult = await strapi.query('dailypromotion').find({ status_eq: 3, dailypromotiontype_eq: 10 });
        var dailypromotionModels = await strapi.services.common.normalizationResponse(
            dataresult, ["user"]
        );
        ctx.send(Object.values(removeAuthorFields(dailypromotionModels)));
    }
};