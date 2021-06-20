'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

module.exports = {

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
    cmsPushNotification: ctx => {
        //params

        const params = _.assign({}, ctx.request.body, ctx.params);

    }


};