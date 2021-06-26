'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */
const _ = require("lodash");

module.exports = {

    //============> this function temprory do not using
    cmsAddPushNotification: async(ctx) => {
        //params
        //{
        //    "startDate":"",
        //    "endDate":"",
        //    "title":"",
        //    "content":"",
        //    "image":"",
        //    "linkurl":"",
        //    "isalway":"",
        //    "totalpushtime":""
        //    "customertype":""
        //    "users":[1,2,3,4]
        //    "groupcustomers":[1,2,3,4]
        //}    
        const params = _.assign({}, ctx.request.body, ctx.params);

        var startDateUTC = moment.utc(params.startDate);
        var endDateUTC = moment.utc(params.enddatetime);

        var newlog = await strapi.query('pushnotificationmanage').create({
            createddate: startDateUTC.format(),
            expireddate: expiredDate.format(),
            //availabledate: endDateUTC.toISOString(),
            availabledate: endDateUTC.format(),
            creditamount: creditamount,
            debitamount: 0,
            transactionamount: transactionamount,
            taxno: taxno,
            transactionno: uuid(),
            status: 'complete',
            user: checkuser,
            mobileuserid: checkuser.id,
            trxconfigid: transactionconfig.trxconfigid,
            remark: transactionconfig.trxdescription,
            isprocessed: isprocessed,
            useremail: checkuser.email,
            userqrcode: checkuser.qrcode
        });


    },
    cmsSearchPushNotification: async(ctx) => {
        //params
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
            _sort: "id:desc",
        };

        if (!_.isNil(queryString.title) && !_.isEmpty(queryString.title)) {
            dataQuery.titlenotification_contains = queryString.title;
        }

        if (!_.isNil(queryString.content) && !_.isEmpty(queryString.content)) {
            dataQuery.notificationcontent_contains = queryString.content;
        }

        if (!_.isNil(queryString.status) && !_.isEmpty(queryString.status)) {
            dataQuery.status = queryString.status;
        }
        if (!_.isNil(queryString.starttime) && !_.isEmpty(queryString.starttime)) {
            dataQuery.starttime_gte = queryString.fromdate;
        }
        if (!_.isNil(queryString.endtime) && !_.isEmpty(queryString.endtime)) {
            dataQuery.endtime_lte = queryString.todate;
        }



        ////console.log(dataQuery);

        var totalRows = await strapi.query('pushnotificationmanage').count(dataQuery);
        var entities = await strapi.query("pushnotificationmanage").find(dataQuery);


        let productModels = await strapi.services.common.normalizationResponse(
            entities, ["users", "groupcustomers"]
        );

        var res = {
            totalRows,
            source: _.values(productModels)
        };

        ctx.send(res);

    }


};