'use strict';
const { sanitizeEntity } = require('strapi-utils');
const _ = require('lodash');
const uuid = require('uuid');
const axios = require('axios');

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

const removeAuthorFields = (entity) => {
    const sanitizedValue = _.omit(entity, ['created_by', 'updated_by', 'created_at', 'updated_at', 'formats']);
    _.forEach(sanitizedValue, (value, key) => {
        if (_.isArray(value)) {
            sanitizedValue[key] = value.map(removeAuthorFields);
        } else if (_.isObject(value)) {
            sanitizedValue[key] = removeAuthorFields(value);
        }
    });

    return sanitizedValue;
};

const formatError = error => [
    { messages: [{ id: error.id, message: error.message, field: error.field }] },
];

module.exports = {
    sendsmscodereg: async ctx => {

        var qs = require('qs');
        var { phone } = ctx.request.body;
        phone = phone.replace('+', '');

        const user = await strapi.query('user', 'users-permissions').findOne({
            phone: phone,
        });

        if (user != null) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'error',
                    message: 'Phone is already taken.',
                    field: 'smshistory.register.sendsmscodereg'
                })
            );
        }

        let dataquery = { name_eq: 'SMSREG', _sort: 'id:desc' };
        let smstypeData = await strapi.services.smstype.find(dataquery);
        if (smstypeData != null && smstypeData.length > 0) {
            dataquery = {
                phone_eq: phone
            };
            let smshistoriesData = await strapi.services.smshistory.find(dataquery);
            let randomCode = gencoderandom(6);
            let contentSendMessage = smstypeData[0].template.replace('{CODE}', randomCode);
            //let contentEndCode = encodeURIComponent(contentSendMessage);
            let mtid = phone.toString() + (smshistoriesData === null ? '0' : smshistoriesData.length.toString());
            let urlSendMessage = 'http://smsgateway.isentric.com/ExtMTPush/extmtpush';
            let dataReturn = '';
            var dataSMS = qs.stringify({
                'shortcode': '39398',
                'custid': 'kkgroup',
                'rmsisdn': phone,
                'smsisdn': '62003',
                'mtid': mtid,
                'mtprice': '000',
                'productCode': '',
                'productType': '4',
                'keyword': '',
                'dataEncoding': '0',
                'dataStr': contentSendMessage,
                'dataUrl': '',
                'dnRep': '0',
                'groupTag': '10'
            });

            var config = {
                method: 'post',
                url: urlSendMessage,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: dataSMS
            };


            await axios(config)
                .then(function(response) {
                    dataReturn = response.data;
                })
                .catch(function(error) {
                    dataReturn = 'Error call server SMS';
                });


            let dataHistoriesCreate = {
                remark: phone + '.' + mtid + '.' + contentSendMessage,
                content: contentSendMessage,
                phone: phone,
                code: randomCode.toString(),
                smstype: smstypeData[0].id,
                mtid: mtid,
                serverdataresult: dataReturn
            };
            await strapi.query('smshistory').create(dataHistoriesCreate);
            //Check sms return
            //IF return code == 0 ==> Save to database
            if (dataReturn.indexOf('Success.') !== -1) {
                //create data and save to history table
                //send message return success
                return ctx.send({
                    statusCode: 0,
                    error: 'success',
                    message: formatError({
                        id: 'success',
                        message: 'send code success',
                        field: 'smshistory.register.sendsmscodereg'
                    }),
                });
            } else {
                return ctx.badRequest(
                    null,
                    formatError({
                        id: 'error',
                        message: 'Send code Error please check systems.',
                        field: 'smshistory.register.sendsmscodereg'
                    })
                );
            }

        } else {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'error',
                    message: 'System error please ask and check. SmsType Error',
                    field: 'smshistory.register.sendsmscodereg'
                })
            );
        }
    },

    checksmscodereg: async ctx => {
        var qs = require('qs');
        var { phone } = ctx.request.body;
        var { code } = ctx.request.body;
        phone = phone.replace('+', '');
        let dataquery = { name_eq: 'SMSREG', _sort: 'id:desc' };
        let smstypeData = await strapi.services.smstype.find(dataquery);
        if (smstypeData != null && smstypeData.length > 0) {
            dataquery = {
                phone_eq: phone,
                smstype_eq: smstypeData[0].id,
                _sort: "id:desc",
                _limit: 1
            };

            let smshistoriesData = await strapi.services.smshistory.find(dataquery);
            if (smshistoriesData != null && smshistoriesData.length > 0) {
                if (smshistoriesData[0].code === code) {
                    //Check success and expire
                    let datenow = new Date(new Date().toUTCString());
                    let millis = datenow - smshistoriesData[0].created_at;
                    let minutesData = Math.floor(millis / (1000 * 60));
                    if (minutesData <= smshistoriesData[0].smstype.minuteexpire) {
                        ctx.send({
                            statusCode: 0,
                            error: 'success',
                            message: formatError({
                                id: 'success',
                                message: 'Code is true',
                                field: 'smshistory.register.sendsmscodereg'
                            }),
                        });
                    } else {
                        return ctx.badRequest(
                            null,
                            formatError({
                                id: 'error',
                                message: 'This code is expire.',
                                field: 'smshistory.register.checksmscodereg'
                            })
                        );
                    }
                } else {
                    return ctx.badRequest(
                        null,
                        formatError({
                            id: 'error',
                            message: 'This code is wrong.',
                            field: 'smshistory.register.checksmscodereg'
                        })
                    );
                }

            } else {
                return ctx.badRequest(
                    null,
                    formatError({
                        id: 'error',
                        message: 'This Phone and code is wrong.',
                        field: 'smshistory.register.checksmscodereg'
                    })
                );
            }
        }
    },

    sendsmscodeforgotpassword: async ctx => {

        var qs = require('qs');
        var { phone } = ctx.request.body;
        phone = phone.replace('+', '');
        let usermobile = await strapi.query('user', 'users-permissions').findOne({
            phone: phone,
        });

        if (usermobile !== null) {
            let dataquery = { name_eq: 'SMSFORGOTPASSWORD', _sort: 'id:desc' };
            let smstypeData = await strapi.services.smstype.find(dataquery);
            if (smstypeData != null && smstypeData.length > 0) {
                dataquery = {
                    phone_eq: phone
                };
                let smshistoriesData = await strapi.services.smshistory.find(dataquery);
                let randomCode = gencoderandom(6);
                let contentSendMessage = smstypeData[0].template.replace('{CODE}', randomCode);
                //let contentEndCode = encodeURIComponent(contentSendMessage);
                let mtid = phone.toString() + (smshistoriesData === null ? '0' : smshistoriesData.length.toString());
                let urlSendMessage = 'http://smsgateway.isentric.com/ExtMTPush/extmtpush';
                let dataReturn = '';
                var dataSMS = qs.stringify({
                    'shortcode': '39398',
                    'custid': 'kkgroup',
                    'rmsisdn': phone,
                    'smsisdn': '62003',
                    'mtid': mtid,
                    'mtprice': '000',
                    'productCode': '',
                    'productType': '4',
                    'keyword': '',
                    'dataEncoding': '0',
                    'dataStr': contentSendMessage,
                    'dataUrl': '',
                    'dnRep': '0',
                    'groupTag': '10'
                });

                var config = {
                    method: 'post',
                    url: urlSendMessage,
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    data: dataSMS
                };


                await axios(config)
                    .then(function(response) {
                        dataReturn = response.data;
                    })
                    .catch(function(error) {
                        dataReturn = 'Error call server SMS';
                    });


                let dataHistoriesCreate = {
                    remark: phone + '.' + mtid + '.' + contentSendMessage,
                    content: contentSendMessage,
                    phone: phone,
                    code: randomCode.toString(),
                    smstype: smstypeData[0].id,
                    mtid: mtid,
                    serverdataresult: dataReturn
                };
                await strapi.query('smshistory').create(dataHistoriesCreate);
                //Check sms return
                //IF return code == 0 ==> Save to database
                if (dataReturn.indexOf('Success.') !== -1) {
                    //create data and save to history table
                    //send message return success
                    ctx.send({
                        statusCode: 0,
                        error: 'success',
                        message: formatError({
                            id: 'success',
                            message: 'send code success',
                            field: 'smshistory.register.sendsmscodeforgotpassword'
                        }),
                    });
                } else {
                    return ctx.badRequest(
                        null,
                        formatError({
                            id: 'error',
                            message: 'Send code Error please check systems.',
                            field: 'smshistory.register.sendsmscodeforgotpassword'
                        })
                    );
                }

            } else {
                return ctx.badRequest(
                    null,
                    formatError({
                        id: 'error',
                        message: 'System error please ask and check. SmsType Error',
                        field: 'smshistory.register.sendsmscodeforgotpassword'
                    })
                );
            }
        } else {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'error',
                    message: 'Phone not found.',
                    field: 'smshistory.register.sendsmscodeforgotpassword'
                })
            );
        }

    },

    checksmscodeforgotpassword: async ctx => {
        var qs = require('qs');
        var { phone } = ctx.request.body;
        var { code } = ctx.request.body;
        phone = phone.replace('+', '');

        let dataquery = { name_eq: 'SMSFORGOTPASSWORD', _sort: 'id:desc' };
        let smstypeData = await strapi.services.smstype.find(dataquery);
        if (smstypeData != null && smstypeData.length > 0) {
            dataquery = {
                phone_eq: phone,
                smstype_eq: smstypeData[0].id,
                _sort: "id:desc",
                _limit: 1
            };

            let smshistoriesData = await strapi.services.smshistory.find(dataquery);
            if (smshistoriesData != null && smshistoriesData.length > 0) {
                if (smshistoriesData[0].code === code) {
                    //Check success and expire
                    let datenow = new Date(new Date().toUTCString());
                    let millis = datenow - smshistoriesData[0].created_at;
                    let minutesData = Math.floor(millis / (1000 * 60));
                    if (minutesData <= smshistoriesData[0].smstype.minuteexpire) {
                        ctx.send({
                            statusCode: 0,
                            error: 'success',
                            message: formatError({
                                id: 'success',
                                message: 'Code is true',
                                field: 'smshistory.register.checksmscodeforgotpassword'
                            }),
                        });
                    } else {
                        return ctx.badRequest(
                            null,
                            formatError({
                                id: 'error',
                                message: 'This code is expire.',
                                field: 'smshistory.register.checksmscodeforgotpassword'
                            })
                        );
                    }
                } else {
                    return ctx.badRequest(
                        null,
                        formatError({
                            id: 'error',
                            message: 'This code is wrong.',
                            field: 'smshistory.register.checksmscodeforgotpassword'
                        })
                    );
                }

            } else {
                return ctx.badRequest(
                    null,
                    formatError({
                        id: 'error',
                        message: 'This Phone and code is wrong.',
                        field: 'smshistory.register.checksmscodeforgotpassword'
                    })
                );
            }
        }
    }

};

function gencoderandom(length) {
    var result = '';
    //var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var characters = '0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}