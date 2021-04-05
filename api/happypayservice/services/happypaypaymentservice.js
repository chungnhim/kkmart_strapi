'use strict';

/**
 * `lalamoveshippingservice` service.
 */

const CryptoJS = require('crypto-js');
const axios = require('axios');
const _ = require("lodash");
const uuid = require('uuid');

const generateSignature = async(rawBody, method, path) => {
    try {
        const LALAMOVE_API = process.env.LALAMOVE_API || 'https://sandbox-rest.lalamove.com';
        const secretKey = process.env.LALAMOVE_SECRET_KEY || 'MCwCAQACBQDDym2lAgMBAAECBDHB';
        const apiKey = process.env.LALAMOVE_API_KEY || 'apiKey';
        const time = new Date().getTime().toString();

        const body = JSON.stringify(rawBody);
        const rawSignature = `${time}\r\n${method}\r\n${path}\r\n\r\n${body}`;
        const signature = CryptoJS.HmacSHA256(rawSignature, secretKey).toString();

        return {
            success: true,
            signature,
            apiKey,
            timestamp: time,
            apiEndpont: LALAMOVE_API
        };
    } catch (error) {
        //console.log(`lalamove generate signature`, error);
        return {
            success: false
        };
    }
}
const encryptAEStData = (rawstr, merchantKey, ivKey) => {
    try {
        let key = keyGenerator(merchantKey);
        let ivK = CryptoJS.enc.Utf8.parse(ivKey);
        let encrypted = CryptoJS.AES.encrypt(rawstr, key, {
            iv: ivK
        }).toString();
        return encrypted;

    } catch (error) {
        //console.log(`Happypay encrypt error`, error);
        return "";
    }
}
const decryptAESData = (encstr, merchantKey, ivKey) => {
    try {
        let key = keyGenerator(merchantKey);
        let ivK = CryptoJS.enc.Utf8.parse(ivKey);
        let decrypted = CryptoJS.AES.decrypt(encstr, key, {
            iv: ivK
        });
        return decrypted.toString(CryptoJS.enc.Utf8)

    } catch (error) {
        //console.log(`Happypay decrypt error`, error);
        return "";
    }
}
const keyGenerator = (merKey) => {
    let ba = [172, 137, 25, 56, 156, 100, 136, 211, 84, 67, 96, 10, 24, 111, 112, 137, 3];
    let salt = byteArrayToWordArray(ba);
    let iteration = 1024;
    let key = CryptoJS.PBKDF2(merKey, salt, {
        keySize: 128 / 32,
        iterations: iteration
    });
    return key;
}

function byteArrayToWordArray(ba) {
    var wa = [],
        i;
    for (i = 0; i < ba.length; i++) {
        wa[(i / 4) | 0] |= ba[i] << (24 - 8 * i);
    }

    return CryptoJS.lib.WordArray.create(wa, ba.length);
}

function wordToByteArray(word, length) {
    var ba = [],
        i,
        xFF = 0xFF;
    if (length > 0)
        ba.push(word >>> 24);
    if (length > 1)
        ba.push((word >>> 16) & xFF);
    if (length > 2)
        ba.push((word >>> 8) & xFF);
    if (length > 3)
        ba.push(word & xFF);

    return ba;
}

function wordArrayToByteArray(wordArray, length) {
    if (wordArray.hasOwnProperty("sigBytes") && wordArray.hasOwnProperty("words")) {
        length = wordArray.sigBytes;
        wordArray = wordArray.words;
    }

    var result = [],
        bytes,
        i = 0;
    while (length > 0) {
        bytes = wordToByteArray(wordArray[i], Math.min(4, length));
        length -= bytes.length;
        result.push(bytes);
        i++;
    }
    return [].concat.apply([], result);
}

const getHttpHeader = (apiKey, timestamp, signature) => {
    const TOKEN = `${apiKey}:${timestamp}:${signature}`

    return {
        'Authorization': `hmac ${TOKEN}`,
        'X-LLM-Country': 'MY',
        'X-Request-ID': uuid()
    };
}
const genIVKey = (length) => {
    let result = '';
    let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}
module.exports = {
    getConfiguration: () => {
        return {
            "malaysia_service_types": malaysiaServiceTypes,
            "countries": countiesCode
        };
    },
    createPayment: async(body) => {
        const keyMerID = "MERCHANT_ID";
        const keyTransId = "TRANS_ID";
        const keyTransType = "TRANS_TYPE";
        const keyTranAMT = "TRANS_AMT";
        const keyCurrentcy = "AMT_CURRENCY";
        const keyDesc = "TRANS_DESC";
        const keySubMer = "SUB_MERCHANT_ID";
        const keyQRCode = "QR_ID";
        const keyPaymentChannel = "PAYMENT_CHANNEL";
        const keyIV = "IvKey";
        const keyDeviceID = "DEVICE_ID";
        const keyWalletProvider = "WALLET_PROVIDER_ID";

        let gatewayInfo = await strapi.query("paymentgateway").findOne({ gwcode: "HP", isactive: true });
        if (_.isNil(gatewayInfo)) {
            return {
                success: false,
                message: "Payment info not supported"
            }
        }



        let merID = gatewayInfo.merchantid;
        let merKey = gatewayInfo.merchantkey;
        let gatewayurl = gatewayInfo.gwurl;
        //let ivKeyEnc = genIVKey(16);
        let ivKeyEnc = "9ZdyHv5LZTZf65TL";
        //console.log("Ivkey:" + ivKeyEnc);
        //console.log("TransID:" + body.TransID);
        let transID = encryptAEStData(body.TransID, merKey, ivKeyEnc);
        //console.log(transID);

        let encText = "KuTfLnkcIHjJD6wF/qLF3A==";
        let decrp = decryptAESData(encText, merKey, ivKeyEnc);
        //console.log("decypt :" + decrp);
        var req = {
            "MERCHANT_ID": body.scheduleAt, // in UTC timezone
            "serviceType": body.serviceType
        }

        const path = "/v2/quotations";
        const method = "POST";

        var auth = await generateSignature(body, method, path);
        if (!auth.success) {
            return {
                success: false,
                message: "Unauthorized"
            }
        }

        let header = getHttpHeader(auth.apiKey, auth.timestamp, auth.signature);

        var res = await
        axios.post(`${auth.apiEndpont}${path}`, {
            headers: header
        }, req).then(function(response) {
            let httpCode = response.status;
            return {
                success: true,
                data: response.data
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