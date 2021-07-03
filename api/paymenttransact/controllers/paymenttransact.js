'use strict';
const sanitizeEntity = require('strapi-utils');
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
    getPaymentType: async ctx => {

        let pmType = await strapi.query("paymenttype").find({
            isactive: true
        });
        let paymentType = await strapi.services.common.normalizationResponse(pmType, ["created_at", "updated_at", "isactive", "gwcode", "merchantcode", "countrycode", "paymenttypecode", "wallet_provider_id"]);

        return Object.values(paymentType);

    },
    getPaymentMethods: async ctx => {
        const params = _.assign({}, ctx.request.params, ctx.params);

        var paymentTypeCode = params.paymenttypecode;

        let pmType = await strapi.query("paymentmethods").find({
            "isactive": true,
            "paymenttypecode": paymentTypeCode
        });
        let paymentType = await strapi.services.common.normalizationResponse(pmType, ["created_at", "updated_at", "isactive", "gwcode", "merchantcode", "countrycode", "paymenttypecode", "wallet_provider_id"]);
        return Object.values(paymentType);
    },
    createpayment: async ctx => {

        const params = _.assign({}, ctx.request.body, ctx.params);
        // let amt_currency = params.currency;
        // let amt = parseFloat(params.amount);
        // let transdes = params.transdes;
        let orderId = params.orderId;
        let mobileUserid = params.mobileuserid;

        // get order information
        let ord = await strapi.query("order").findOne({
            "id": orderId,
            "payment_status": strapi.config.constants.order_payment_status.new
        });

        if (_.isNil(ord)) {
            ctx.send({
                success: false,
                message: "Invalid order"
            });
            return;
        }
        let walletId = ord.paymentmethod;

        if (_.isNil(walletId)) {
            ctx.send({
                success: false,
                message: "Invalid payment method"
            });
            return;
        }

        // get payment methodID
        let payment = await strapi.query("paymentmethods").findOne({
            id: walletId.id
        });

        if (_.isNil(payment)) {
            return ctx.send({
                success: false,
                message: "Not exist payment method"
            });
        };

        var transID = await strapi.services.common.generatePayOrderNo();


        console.log('===============payment===========');
        console.log(payment);
        let API_ENPOINT = "http://128.199.86.59:1337";
        if (!_.isNil(process.env.API_ENPOINT)) {
            API_ENPOINT = process.env.API_ENPOINT.trim();
        }

        //let amt = 
        var inputparams = {
            TransID: transID,
            TransAMT: ord.total_amount,
            TransCurrentcy: ord.currency,
            PaymentId: walletId.wallet_provider_id,
            Transdes: `Payment ${ord.order_code}`,
            ResponseUrl: `${API_ENPOINT}/payment/ipay-response`,
            BackendUrl: `${API_ENPOINT}/payment/ipay-backend`
        }


        if (payment.gwcode === "HP") {
            //console.log("Go to here");
            var value = await strapi.services.happypaypaymentservice.createPayment(inputparams);
        } else if (payment.gwcode === "IPAY88") {
            value = await strapi.services.ipay88payservice.createPayment(inputparams);
        }


        ctx.send(value);

    },
    responseurl: async ctx => {
        console.log(`==============Response URL===============`);
        console.log(ctx);
        console.log(`==============End Response URL===============`);
    },
    backendurl: async ctx => {
        console.log(`==============Backend URL===============`);
        console.log(ctx);
        console.log(`==============End Backend URL===============`);
        return "RECEIVEOK";
    }
};