'use strict';

/**
 * `lalamoveshippingservice` service.
 */

const CryptoJS = require('crypto-js');
const axios = require('axios');
const _ = require("lodash");
const uuid = require('uuid');

const generateSHA256Signature = async(inputstring) => {
    try {

        const signature = CryptoJS.SHA256(inputstring).toString(CryptoJS.enc.Hex);

        return {
            success: true,
            signature: signature
        };
    } catch (error) {
        console.log(`SHA256 generate signature`, error);
        return {
            success: false,
            signature: ""
        };
    }
}

module.exports = {

    createPayment: async(body) => {

        // body
        // var inputparams = {
        //     TransID: transID,
        //     TransAMT: ord.total_amount,
        //     TransCurrentcy: ord.currency,
        //     PaymentId: walletId.wallet_provider_id,
        //     Transdes: `Payment ${ord.order_code}`
        // }
        console.log(`=======body===========`);
        console.log(body);

        const LangVaule = "UTF-8";
        const SignatureTypeValue = "SHA256";
        const keyMerID = "MerchantCode";
        const keyTransId = "PaymentId";
        const keyTransType = "RefNo";
        const keyTranAMT = "Amount";
        const keyCurrentcy = "Currency";
        const keyDesc = "ProdDesc";
        const keyUserName = "UserName";
        const keyUserEmail = "UserEmail";
        const keyUserContact = "UserContact";
        const keyRemark = "Remark";
        const keyLang = "Lang";
        const keySignatureType = "SignatureType";
        const keySignature = "Signature";
        const keyResponseURL = "ResponseURL";
        const keyBackendUrl = "BackendURL";

        let gatewayInfo = await strapi.query("paymentgateway").findOne({ gwcode: "IPAY88", isactive: true });
        if (_.isNil(gatewayInfo)) {
            return {
                success: false,
                message: "Payment info not supported"
            }
        }



        let merID = gatewayInfo.merchantid;
        let merKey = gatewayInfo.merchantkey;
        let gatewayurl = gatewayInfo.gwurl;
        let refNo = body.TransID;
        //let amount = body.TransAMT.toFixed(2);
        //for test
        let amount = "0.01";
        let rawSignature = `${merKey}${merID}${refNo}${amount.replace(",","").replace(".","")}${body.TransCurrentcy}`;

        console.log(rawSignature);

        let signatureobj = await generateSHA256Signature(rawSignature);
        if (signatureobj.success === true) {
            var signature = signatureobj.signature;
        } else {
            return {
                success: false,
                message: "Fail to generate signature"
            }
        }



        var req = {
            "MerchantCode": merID, // in UTC timezone
            "PaymentId": body.PaymentId,
            "RefNo": refNo,
            "Amount": body.TransAMT,
            "Currency": body.TransCurrentcy,
            "ProdDesc": body.Transdes,
            "UserName": "abc123",
            "UserEmail": "abc123@gmail.com",
            "UserContact": "123456",
            "Remark": body.Transdes,
            "Lang": LangVaule,
            "SignatureType": SignatureTypeValue,
            "Signature": signature,
            "ResponseURL": body.ResponseUrl,
            "BackendURL": body.BackendUrl,
        }



        //let header = getHttpHeader(auth.apiKey, auth.timestamp, auth.signature);
        console.log(`=========== request==========`)
        console.log(req)
        console.log(`===========end request==========`)
        console.log(gatewayurl);
        var res = await
        axios.post(gatewayurl, req).then(function(response) {
            let httpCode = response.status;
            //console.log(`vao day 1`);
            //console.log(response);
            return response.data

        }).catch(function(error) {
            console.log(`vao day 2`);
            console.log(error);
            console.log(`========end exception ==========`);
            let httpCode = error.response.status;
            let message = "";
            if (httpCode == 401) {
                message = "Unauthorized";
            } else {
                message = "Get quotation failed"
            }

            return "Payment Fail"
        });
        // console.log(`============ressponse===========`);
        // console.log(res);
        // console.log(`============end ressponse===========`)
        return res;
    },
}