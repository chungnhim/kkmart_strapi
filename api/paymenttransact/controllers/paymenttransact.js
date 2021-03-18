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
    getPaymentType: async ctx =>{

        let pmType = await strapi.query("paymenttype").find({
            isactive: true
        });
        let paymentType = await strapi.services.common.normalizationResponse(pmType, ["created_at","updated_at","isactive"]);
        return Object.values(paymentType);
    },
    getPaymentMethods: async ctx =>{
        let pmType = await strapi.query("paymentmethods").find({
            isactive: true
        });
        let paymentType = await strapi.services.common.normalizationResponse(pmType, ["created_at","updated_at","isactive","gwcode","merchantcode","countrycode","paymenttypecode","wallet_provider_id"]);
        return Object.values(paymentType);
    },
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
