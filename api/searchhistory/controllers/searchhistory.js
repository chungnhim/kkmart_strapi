'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */
const _ = require("lodash");

module.exports = {
    createNew: async(ctx) => {
        let userId = await strapi.services.common.getLoggedUserId(ctx);
        if (_.isNil(userId) || userId == 0) {
            ctx.send({
                success: false,
                message: "Please login to your account"
            });
            return;
        }

        const params = _.assign({}, ctx.request.body, ctx.params);
        var dataCreate = {
            searchkeyword: params.search_keyword,
            user: userId
        };
        var resultCreate = await strapi.query("searchhistory").create(dataCreate);
        if (!_.isNil(resultCreate)) {
            ctx.send({
                success: true,
                message: "Create search history success."
            });
            return;
        } else {
            ctx.send({
                success: false,
                message: "Create search history error."
            });
            return;
        }

    },
    getSearchHistory: async(ctx) => {
        let userId = await strapi.services.common.getLoggedUserId(ctx);
        if (_.isNil(userId) || userId == 0) {
            ctx.send({
                success: false,
                message: "Please login to your account"
            });
            return;
        }

        var querySearch = {
            user: userId,
            _sort: "created_at:desc",
            _limit: 10
        }

        var dataResult = await strapi.query("searchhistory").find(querySearch);
        var totalRows = await strapi.query("searchhistory").count(querySearch);
        let models = await strapi.services.common.normalizationResponse(
            dataResult, ["user", "updated_at", "searchtime"]
        );

        ctx.send({
            success: true,
            totalRows: totalRows,
            address: _.values(models)
        });

    },
    deleteOfUse: async(ctx) => {
        let userId = await strapi.services.common.getLoggedUserId(ctx);
        if (_.isNil(userId) || userId == 0) {
            ctx.send({
                success: false,
                message: "Please login to your account"
            });
            return;
        }

        const params = _.assign({}, ctx.request.params, ctx.params);
        let history_id = params.id;
        var res = await strapi.query("searchhistory").delete({
            id: history_id,
            user: userId
        });
        ctx.send({
            success: true,
            message: "Search history has been remove successfully"
        });
    }
};