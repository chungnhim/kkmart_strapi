'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

const { sanitizeEntity } = require('strapi-utils');
const _ = require('lodash');

var removeFields = [
    //"mobileuserid"
];
module.exports = {

    feedbackSearch: async(ctx) => {
        const queryString = _.assign({}, ctx.request.query, ctx.params);
        const params = _.assign({}, ctx.request.params, ctx.params);
        let pageIndex = 1,
            pageSize = 10;

        var arrayIDAccountByPhone = [];
        var arrayIDAccountByEmail = [];

        if (!_.isNil(params.page_index) && !_.isNil(params.page_size)) {
            pageIndex = parseInt(params.page_index);
            pageSize = parseInt(params.page_size);
        }

        var dataQuery = {
            _start: (pageIndex - 1) * pageSize,
            _limit: pageSize,
            _sort: "id:desc",
        };

        if (!_.isNil(queryString.fromdate) && !_.isEmpty(queryString.fromdate)) {
            dataQuery.created_at_gte = queryString.fromdate;
        }

        if (!_.isNil(queryString.todate) && !_.isEmpty(queryString.todate)) {
            dataQuery.created_at_lte = queryString.todate;
        }

        if (!_.isNil(queryString.status) && !_.isEmpty(queryString.status)) {
            dataQuery.status = queryString.status;
        }

        if (!_.isNil(queryString.phone) && !_.isNil(queryString.phone)) {
            //Search user have phone
            var dataQueryUser = {
                phone_contains: queryString.phone
            }
            var entitiesUser = await strapi.query('user', 'users-permissions').find(dataQueryUser);
            for (let index = 0; index < entitiesUser.length; index++) {
                const element = entitiesUser[index];
                arrayIDAccountByPhone.push(element.id);
            }
            if (arrayIDAccountByPhone.length > 0) {
                dataQuery.mobileuserid_in = arrayIDAccountByPhone;
            }
        }

        // if (!_.isNil(queryString.email) && !_.isNil(queryString.email)) {
        //     //Search user have email
        //     var dataQueryUser = {
        //         email_contains: queryString.email
        //     }
        //     var entitiesUser = await strapi.query('user', 'users-permissions').find(dataQueryUser);
        //     for (let index = 0; index < entitiesUser.length; index++) {
        //         const element = entitiesUser[index];
        //         arrayIDAccountByEmail.push(element.id);
        //     }
        //     if (arrayIDAccountByEmail.length > 0) {
        //         dataQuery.mobileuserid_in = arrayIDAccountByEmail;
        //     }
        // }


        var totalRows = await strapi.query('feedback').count(dataQuery);
        var entities = await strapi.query("feedback").find(dataQuery);

        for (let index = 0; index < entities.length; index++) {
            const element = entities[index];
            if (element.mobileuserid) {
                var dataQueryUserCheck = {
                    id: element.mobileuserid
                }
                var entitiesUserCheck = await strapi.query('user', 'users-permissions').findOne(dataQueryUserCheck);
                if (entitiesUserCheck) {
                    element.phone = entitiesUserCheck.phone;
                    element.email = entitiesUserCheck.email;
                }
            } else {
                element.phone = "";
                element.email = '';
            }
        }

        let productModels = await strapi.services.common.normalizationResponse(
            entities,
            removeFields
        );

        var res = {
            totalRows,
            source: _.values(productModels)
        };

        ctx.send(res);

    },
    updateStatus: async(ctx) => {
        const queryString = _.assign({}, ctx.request.query, ctx.params);
        const params = _.assign({}, ctx.request.params, ctx.params);
        const paramsBody = _.assign({}, ctx.request.body, ctx.params);

        var entityUpdate = {
            status: paramsBody.status
        }
        var entityUpdateSuccess = await strapi.query("feedback").update({ id: params.id }, entityUpdate);
        let productModels = await strapi.services.common.normalizationResponse(
            entityUpdateSuccess,
            removeFields
        );
        ctx.send(productModels);
    }

};