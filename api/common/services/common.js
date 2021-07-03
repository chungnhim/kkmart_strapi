"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */
const { sanitizeEntity } = require("strapi-utils");
const _ = require("lodash");
const axios = require("axios");
const moment = require('moment');

const removeAuthorFields = (entity, fields) => {
    let API_ENPOINT = "http://128.199.86.59:1337";
    if (!_.isNil(process.env.API_ENPOINT)) {
        API_ENPOINT = process.env.API_ENPOINT.trim();
    }

    var defaultFields = [
        "created_by",
        "updated_by",
        //"user",
        "formats"
    ];

    if (!_.isNil(fields)) {
        for (let i = 0; i < fields.length; i++) {
            const element = fields[i];
            defaultFields.push(element);
        }
    }

    const sanitizedValue = _.omit(entity, defaultFields);

    _.forEach(sanitizedValue, (value, key) => {
        if (_.isArray(value)) {
            sanitizedValue[key] = value.map(
                function(item, index) {
                    return removeAuthorFields(item, fields);
                });
        } else if (_.isObject(value)) {
            if (key == 'created_at' || key == 'updated_at') {
                if (new Date(value) !== "Invalid Date" && !isNaN(new Date(value))) {
                    if (value == new Date(value).toISOString()) {
                        sanitizedValue[key] = value;
                    }
                }
            } else {
                sanitizedValue[key] = removeAuthorFields(value, fields);
            }
        }

        if (key == 'url') {
            if (value != null && value[0] == '/') {
                sanitizedValue[key] = `${API_ENPOINT}${value}`;
            }
        }
    });

    return sanitizedValue;
};

const getLoggedUserId = async(ctx) => {
    var userId = 0;
    if (ctx.request && ctx.request.header && ctx.request.header.authorization) {
        try {
            const { id, isAdmin = false } = await strapi.plugins[
                "users-permissions"
            ].services.jwt.getToken(ctx);
            userId = id;
        } catch (err) {
            //return handleErrors(ctx, err, 'unauthorized');
        }
    }

    return userId;
};

const opts = {
    errorEventName: 'error',
    logDirectory: 'mylogfiles', // NOTE: folder must exist and be writable...
    fileNamePattern: 'roll-<DATE>.log',
    dateFormat: 'YYYY.MM.DD'
};
const log = require('simple-node-logger').createRollingFileLogger(opts);

const optsError = {
    errorEventName: 'error',
    logDirectory: 'mylogfiles', // NOTE: folder must exist and be writable...
    fileNamePattern: 'error-<DATE>.log',
    dateFormat: 'YYYY.MM.DD'
};
const logErr = require('simple-node-logger').createRollingFileLogger(optsError);

module.exports = {
    normalizationResponse: async(entity, fields) => {
        ////console.log(`fields`, fields);
        return removeAuthorFields(entity, fields);
    },
    getLoggedUserId: async(ctx) => {
        return await getLoggedUserId(ctx);
    },
    sendEmailSendgrid: async(toEmail, toName, subject, textBody) => {
        var qs = require('qs');
        var contentSendEmail = {
                'to': toEmail,
                'toname': toName,
                'subject': subject,
                'text': textBody,
                'from': 'noreply@kkemart.com.my'
            }
            //console.log(contentSendEmail);
        var data = qs.stringify(contentSendEmail);

        //console.log(data);
        var config = {
            method: 'post',
            url: 'https://api.sendgrid.com/api/mail.send.json',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Bearer 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'
            },
            data: data
        };

        await axios(config)
            .then(function(response) {
                console.log(JSON.stringify(response.data));
            })
            .catch(function(error) {
                console.log(error);
            });

    },
    generateUserQrCode: async(identifier, userId) => {
        var runstrtmp = "0000000000";
        // get prefix
        var sysparams = await strapi.query('systemparams').findOne({
            paramname: "qrcodeprefix"
        });
        if (sysparams) {
            var prefix = sysparams.paramvalue;
        } else {
            prefix = "160101";
        }

        /*
        var sq = await strapi.connections.default.raw(`select nextval('user_qrcode_seq')`);
        var sqIds = sq.rows; */
        //console.log(sqIds);
        var runstr = runstrtmp + userId;
        runstr = runstr.substring(runstr.length - runstrtmp.length, runstr.length);
        var userQr = prefix + identifier + moment.utc(new Date).format("DDMMYY") + runstr;

        return userQr;
    },
    // using for kcoin paymant transact
    generatePaymentTransNo: async(identifier) => {
        var runstrtmp = "0000000000";
        // get prefix
        var sysparams = await strapi.query('systemparams').findOne({
            paramname: "paymenttrxprefix"
        });
        if (sysparams) {
            var prefix = sysparams.paramvalue;
        } else {
            // PT : Payment Transaction
            prefix = "PT";
        }
        var sq = await strapi.connections.default.raw(`select nextval('paymenttransact_oder_seq')`);
        var sqIds = sq.rows;
        //console.log(sqIds);
        var runstr = runstrtmp + sqIds[0].nextval;
        runstr = runstr.substring(runstr.length - runstrtmp.length, runstr.length);
        var userQr = prefix + identifier + moment.utc(new Date).format("DDMMYY") + runstr;
        return userQr;
    },
    // using for eMart Payment
    generatePayOrderNo: async() => {
        var runstrtmp = "0000000000";
        // get prefix
        var sysparams = await strapi.query('systemparams').findOne({
            paramname: "emartpaymentprefix"
        });
        if (sysparams) {
            var prefix = sysparams.paramvalue;
        } else {
            // PT : Payment Transaction
            prefix = "EM";
        }
        var sq = await strapi.connections.default.raw(`select nextval('user_payment_trx_seq')`);
        var sqIds = sq.rows;
        console.log(sqIds);
        var runstr = runstrtmp + sqIds[0].nextval;
        runstr = runstr.substring(runstr.length - runstrtmp.length, runstr.length);
        var userQr = prefix + moment.utc(new Date).format("DDMMYY") + runstr;
        console.log(`===========orderno=========`);
        console.log(userQr);
        return userQr;
    },
    handleErrors: async(ctx, err, message) => {
        console.log(err);
        return ctx.send({
            success: false,
            id: '999',
            message: message
        });
    },
    logInfo: async(message) => {
        //console.log(message);
        log.info(message);
    },
    logObject: async(objmsg) => {
        log.info(JSON.stringify(objmsg))
    },
    logError: async(message) => {
        //console.log(message);
        logErr.error(message);
    }


};