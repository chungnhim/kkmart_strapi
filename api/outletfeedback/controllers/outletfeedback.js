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

const formatError = error => [
    { messages: [{ id: error.id, message: error.message, field: error.field }] },
];

module.exports = {
    addoutletfeedback: async ctx => {
        if (ctx.request && ctx.request.header && ctx.request.header.authorization) {

            const { id, isAdmin = false } = await strapi.plugins[
                'users-permissions'
            ].services.jwt.getToken(ctx);

            var user = await strapi.query('user', 'users-permissions').findOne({
                id: id
            });
            const params = _.assign({}, ctx.request.body, ctx.params);
            let outletid = params.outlet;
            //Check have or not?
            if (user != null) {
                var feedbackcheck = await strapi.query("outletfeedback").findOne({ user: id, outlet: outletid });
                if (feedbackcheck != null) {
                    //Update
                    params.id = feedbackcheck.id;
                    params.user = user;
                    await strapi.query("outletfeedback").update({ id: feedbackcheck.id }, params);
                    try {
                        addrating(outletid, 'satisfaction', params.overallsatisfaction, feedbackcheck.overallsatisfaction);
                        addrating(outletid, 'overallservice', params.overallservice, feedbackcheck.overallservice);
                        addrating(outletid, 'environment', params.environment, feedbackcheck.environment);
                        addrating(outletid, 'productavail', params.productavail, feedbackcheck.productavail);
                        addrating(outletid, 'queuetime', params.queuetime, feedbackcheck.queuetime);
                    } catch (err) {
                        return handleErrors(ctx, err, 'unauthorized');
                    }
                } else {
                    //create outletfeedback
                    params.user = user;
                    await strapi.query("outletfeedback").create(params);

                    //create outletratings


                    try {
                        addrating(outletid, 'satisfaction', params.overallsatisfaction, 0);
                        addrating(outletid, 'overallservice', params.overallservice, 0);
                        addrating(outletid, 'environment', params.environment, 0);
                        addrating(outletid, 'productavail', params.productavail, 0);
                        addrating(outletid, 'queuetime', params.queuetime, 0);
                    } catch (err) {
                        return handleErrors(ctx, err, 'unauthorized');
                    }
                }

                ctx.send({
                    statusCode: 0,
                    error: 'success',
                    message: formatError({
                        id: 'success',
                        message: 'Send feedback outlet success',
                        field: 'outletfeedback.addoutletfeedback'
                    }),
                });
            }

        }
    }
};

async function addrating(outletid, ratingtype, numberstar, numberstarold) {
    try {
        var outletratingcheck = await strapi.query("outletrating").findOne({ outlet: outletid, ratingtype: ratingtype });
        if (outletratingcheck === null) {
            var noonestar = 0;
            var notwostars = 0;
            var nothreestars = 0;
            var nofourstars = 0;
            var nofivestars = 0;
            switch (parseFloat(numberstar)) {
                case 1:
                    noonestar = noonestar + 1;
                    break;
                case 2:
                    notwostars = notwostars + 1;
                    break;
                case 3:
                    nothreestars = nothreestars + 1;
                    break;
                case 4:
                    nofourstars = nofourstars + 1;
                    break;
                case 5:
                    nofivestars = nofivestars + 1;
                    break;
            }

            let datacreate = {
                outlet: outletid,
                noonestar: noonestar,
                notwostars: notwostars,
                nothreestars: nothreestars,
                nofourstars: nofourstars,
                nofivestars: nofivestars,
                ratingtype: ratingtype
            }

            await strapi.query("outletrating").create(datacreate);

        } else {
            var noonestar = outletratingcheck.noonestar;
            var notwostars = outletratingcheck.notwostars;
            var nothreestars = outletratingcheck.nothreestars;
            var nofourstars = outletratingcheck.nofourstars;
            var nofivestars = outletratingcheck.nofivestars;

            switch (numberstarold) {
                case 1:
                    noonestar = noonestar - 1;
                    break;
                case 2:
                    notwostars = notwostars - 1;
                    break;
                case 3:
                    nothreestars = nothreestars - 1;
                    break;
                case 4:
                    nofourstars = nofourstars - 1;
                    break;
                case 5:
                    nofivestars = nofivestars - 1;
                    break;
            }

            switch (parseFloat(numberstar)) {
                case 1:
                    noonestar = noonestar + 1;
                    break;
                case 2:
                    notwostars = notwostars + 1;
                    break;
                case 3:
                    nothreestars = nothreestars + 1;
                    break;
                case 4:
                    nofourstars = nofourstars + 1;
                    break;
                case 5:
                    nofivestars = nofivestars + 1;
                    break;
            }

            let datacreate = {
                outlet: outletid,
                noonestar: noonestar,
                notwostars: notwostars,
                nothreestars: nothreestars,
                nofourstars: nofourstars,
                nofivestars: nofivestars,
                ratingtype: ratingtype
            }
            await strapi.query("outletrating").update({ id: outletratingcheck.id }, datacreate);
        }
    } catch (err) {
        return handleErrors(ctx, err, 'unauthorized');
    }

};