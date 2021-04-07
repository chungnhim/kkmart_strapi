'use strict';
const { sanitizeEntity } = require('strapi-utils');
const _ = require('lodash');
/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */
const removeAuthorFields = (entity) => {
    const sanitizedValue = _.omit(entity, ['created_by', 'updated_by', 'created_at', 'updated_at', 'formats', 'user']);
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
    getnearme: async ctx => {
        var res = await strapi.services.outlet.getNearMe(ctx.request.body.longitude,
            ctx.request.body.latitude,
            ctx.request.body.distance);

        ctx.send(res);
    },
    getbystate: async ctx => {
        //===get outlet by state		
        var stateid = parseFloat(ctx.request.body.stateid);
        var dataresult = await strapi.query('outlet').find({ state_eq: stateid });
        let data = Object.values(removeAuthorFields(dataresult));
        ctx.send(data);
    },
    searchoutlet: async ctx => {
        //ctx.request.body.query
        //console.log(ctx.request.body.query);
        var dataresult = await strapi.query('outlet').find({ address_contains: ctx.request.body.query });
        let data = Object.values(removeAuthorFields(dataresult));
        ctx.send(data);
    }
};