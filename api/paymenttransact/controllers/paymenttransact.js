'use strict';
const { sanitizeEntity } = require('strapi-utils');
const _ = require('lodash');
/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */
/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

module.exports = {
    createpayment: async ctx => {

        let amt_currency = ctx.request.body.currency;
        let amt = parseFloat(ctx.request.body.amount);
        let transdes= ctx.request.body.transdes;
        let orderId = ctx.request.body.orderId;
        let walletId =  ctx.request.body.walletId;
        let transID = "khhfyy";
        let params = {
            "TransID": transID,

        }
        console.log("Go to here");
        let value = await strapi.services.happypaypaymentservice.createPayment(params);
        
ctx.send   ('ok');

    }
};
