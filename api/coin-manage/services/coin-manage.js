'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/services.html#core-services)
 * to customize this service
 */
const CryptoJS = require('crypto-js');
const axios = require('axios');
const _ = require("lodash");

const generateSignature = async(rawBody, secrectkey) => {
    try {

        let rawSignature = `${secrectkey}${rawBody}`;
        const signature = CryptoJS.HmacSHA256(rawSignature, secretKey).toString();

        return {
            success: true,
            signature,
            apiKey,
            timestamp: time
        };
    } catch (error) {
        //console.log(`lalamove generate signature`, error);
        return {
            success: false
        };
    }
}


module.exports = {
    getQuotations: async(userAddressId, products, shippingNote, scheduleAt) => {
        let quotationBody = await buildLalamoveReq(userAddressId, products, shippingNote, scheduleAt);
        if (!quotationBody.success) {
            return quotationBody;
        }

        const path = "/v2/quotations";
        const method = "POST";

        var auth = await generateSignature(quotationBody.data, method, path);
        if (!auth.success) {
            return {
                success: false,
                message: "Unauthorized"
            }
        }

        let header = getHttpHeader(auth.apiKey, auth.timestamp, auth.signature, "MY_KUL");
        var res = await
        axios.post(`${LALAMOVE_API}${path}`, quotationBody.data, {
            headers: header
        }).then(function(response) {
            let httpCode = response.status;
            return {
                success: true,
                body: quotationBody.data,
                totalFee: response.data.totalFee,
                totalFeeCurrency: response.data.totalFeeCurrency
            }
        }).catch(function(error) {
            let httpCode = error.response.status;
            let message = "";
            if (httpCode == 401) {
                message = "Unauthorized";
            } else {
                message = "Get quotation failed"
            }

            return {
                success: false,
                message: message,
                data: error.response.data
            }
        });

        return res;
    }


};