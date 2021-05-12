'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */
const _ = require("lodash");

module.exports = {
    // <=========================
    // Coin transactions
    coinTransactions: async(ctx) => {
        // body params
        // scheduleAt UTC time, not local time
        //{
        // "mobileuserids":[1,2],
        // "trxconfigids":["001","013","014"]
        // "fromdate":"2021-07-10T07:00:00.000Z"
        // "todate":"2020-07-10T07:00:00.000Z"
        //}

        const queryString = _.assign({}, ctx.request.query, ctx.params);
        const params = _.assign({}, ctx.request.params, ctx.params);

        let pageIndex = 1,
            pageSize = 10;

        if (!_.isNil(params.page_index) && !_.isNil(params.page_size)) {
            pageIndex = parseInt(params.page_index);
            pageSize = parseInt(params.page_size);
        }

        var dataQuery = {
            _start: (pageIndex - 1) * pageSize,
            _limit: pageSize,
            _sort: "createddate:desc",
        };
        console.log(queryString);
        if (!_.isNil(queryString.mobileuserids) && !_.isEmpty(queryString.mobileuserids)) {
            console.log(queryString);
            dataQuery.mobileuserid_in = queryString.mobileuserids.split(",");
        }

        if (!_.isNil(queryString.trxconfigids) && !_.isEmpty(queryString.trxconfigids)) {
            dataQuery.trxconfigid_in = queryString.trxconfigids.split(",");
        }

        if (!_.isNil(queryString.fromdate) && !_.isEmpty(queryString.fromdate)) {
            dataQuery.createddate_gte = queryString.fromdate;
        }
        if (!_.isNil(queryString.todate) && !_.isEmpty(queryString.todate)) {
            dataQuery.createddate_lte = queryString.todate;
        }
        console.log('go to here 1');
        var totalRows = await strapi.query('transaction-history').count(dataQuery);
        var entities = await strapi.query("transaction-history").find(dataQuery);

        let productModels = await strapi.services.common.normalizationResponse(
            entities, [
                "updated_at",
                "expireddate",
                "createddate",
                "availabledate",
                "isprocessed",
                "outlet",
                "user",
                "outletid"
                //"promotionproduct",
                //"flashsaleproduct"
            ]
        );

        var res = {
            totalRows,
            source: _.values(productModels)
        };

        ctx.send(res);
    },
    getTrxConfigs: async(ctx) => {

        let entities1 = await strapi.query("transaction-config").find();
        console.log(entities1);
        let productModels = await strapi.services.common.normalizationResponse(
            entities1, [
                "updated_at",
                "unittype",
                "amount",
                "dayeffective",
                "isexpired",
                "amountpercent",
                "dayexpired",
                "monthexpired",
                "isdisplay"
                //"flashsaleproduct"
            ]
        );
        ctx.send(_.values(productModels));
    }
};