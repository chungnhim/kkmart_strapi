'use strict';

/**
 * `lalamoveshippingservice` service.
 */

const CryptoJS = require('crypto-js');
const axios = require('axios');
const _ = require("lodash");
const uuid = require('uuid');
const moment = require('moment');

const removeAuthorFields = (entity) => {
    const sanitizedValue = _.omit(entity, ['created_by', 'updated_by', 'created_at', 'updated_at', 'formats', 'deviceinfos', 'transaction_histories', 'outlets', 'role', 'provider', 'confirmed', ]);
    _.forEach(sanitizedValue, (value, key) => {
        if (_.isArray(value)) {
            sanitizedValue[key] = value.map(removeAuthorFields);
        } else if (_.isObject(value)) {
            sanitizedValue[key] = removeAuthorFields(value);
        }
    });

    return sanitizedValue;
};

module.exports = {

    creditcoinInStore: async(mobileuserid, outletid, transactionamount, qrcode, taxno) => {
        //input: mobileuserid - this is seller action
        //input: qrcode
        //input: outletid
        //input: transactionamount
        //input: refno
        // input: taxno

        //check validate transaction amount
        if (!transactionamount || transactionamount < 0) {

            return {
                success: false,
                id: '1',
                message: "Please provide transaction amount."
            }
        }
        //check validate outletid
        if (!outletid || outletid < 0) {

            return {
                success: false,
                id: '2',
                message: "Please provide outletid."
            }
        }
        //check validate qrcode
        if (!qrcode) {

            return {
                success: false,
                id: '4',
                message: "Please provide qrcode."
            }
        }

        //1 check if outletid not belong user
        const checkoutlet = await strapi.query('outlet').findOne({
            id: outletid,
        });
        if (checkoutlet == null) {
            //|| (checkoutlet != null && checkoutlet.user.id != mobileuserid)
            return {
                success: false,
                id: '6',
                message: "Invalidate outlet permission."
            }
        } else {
            let checkUserOfOutlet = checkoutlet.users.filter(s => s.id == mobileuserid);
            if (checkUserOfOutlet == null || (checkUserOfOutlet != null && checkUserOfOutlet.length == 0)) {
                return ctx.badRequest(
                    null,
                    formatError({
                        id: '6',
                        message: 'Invalidate outlet permission.',
                    })
                );
            }
        }
        //2 get detail user with qrcode
        var checkuser = await strapi.query('user', 'users-permissions').findOne({
            qrcode: qrcode
        });
        if (checkuser == null) {
            return {
                success: false,
                id: '7',
                message: "Wrong qrcode."
            }
        }
        //3. get detail from transaction-config
        var transactionconfig = await strapi.query('transaction-config').findOne({
            trxconfigid: '013'
        });
        if (transactionconfig) {
            //3.1 insert to coin transaction history
            var moment = require('moment');
            var startDate = new Date;
            var startDateUTC = moment.utc(startDate);
            var endDateUTC = moment.utc(startDate);
            endDateUTC = endDateUTC.add(transactionconfig.dayeffective, 'days');
            var expiredDate = moment.utc(startDate);
            expiredDate = expiredDate.add(transactionconfig.monthexpired, 'months');
            expiredDate = expiredDate.endOf('month');
            //credit amount KCoin
            let creditamount = (transactionamount * transactionconfig.amountpercent) / parseFloat(100);

            var isprocessed = false;
            //expiredDate from transaction-config
            var newlog = await strapi.query('transaction-history').create({
                createddate: startDateUTC.format(),
                expireddate: expiredDate.format(),
                //availabledate: endDateUTC.toISOString(),
                availabledate: endDateUTC.format(),
                creditamount: creditamount,
                debitamount: 0,
                transactionamount: transactionamount,
                taxno: taxno,
                transactionno: uuid(),
                outletid: outletid,
                status: 'complete',
                user: checkuser,
                mobileuserid: checkuser.id,
                trxconfigid: transactionconfig.trxconfigid,
                remark: transactionconfig.trxdescription,
                isprocessed: isprocessed,
                useremail: checkuser.email,
                userqrcode: checkuser.qrcode
            });
            if (transactionconfig.dayeffective == 0) {
                //3.2 check if ransactionconfig.dayeffective == 0
                //add to balance now
                //4. update mobileusercoinaccount
                var mycoinaccount = await strapi.query('mobileusercoinaccount').findOne({
                    mobileuserid: checkuser.id
                });
                if (mycoinaccount == null) {
                    var newmycoinaccount = await strapi.query('mobileusercoinaccount').create({
                        mobileuserid: checkuser.id,
                        balance: 0,
                        totalcredit: 0,
                        totaldebit: 0,
                        totalexpried: 0,
                        modifieddate: new Date(new Date().toUTCString())
                    });
                    mycoinaccount = await strapi.query('mobileusercoinaccount').findOne({
                        mobileuserid: checkuser.id
                    });
                }
                if (mycoinaccount) {
                    mycoinaccount.balance = mycoinaccount.balance + creditamount;
                    mycoinaccount.totalcredit = mycoinaccount.totalcredit + creditamount;
                    await strapi.query('mobileusercoinaccount').update({ mobileuserid: checkuser.id },
                        mycoinaccount
                    );
                }
                //update transaction-history
                newlog.isprocessed = true;
                await strapi.query('transaction-history').update({
                    mobileuserid: checkuser.id,
                    trxconfigid: transactionconfig.trxconfigid,
                    outletid: outletid,
                    transactionno: newlog.transactionno
                }, {
                    isprocessed: true
                });
                //send notification here
                //select notification type credit 1001
                var notificationtype = await strapi.query('notificationtypes').findOne({
                    notificationcode: '1001'
                });
                if (notificationtype) {

                    //build message
                    let notificationContent = notificationtype.template.replace('{AMOUNT}', creditamount);
                    let notificationdata = notificationtype.templatedata.replace('{AMOUNT}', creditamount);
                    let notificationTitle = notificationtype.title;
                    let notificationType = notificationtype.notificationtype;
                    //insert to table notification logs

                    let dataNotificationlog = {
                        noticetypeid: notificationtype.id,
                        noticetypename: notificationtype.typename,
                        noticetitle: notificationtype.title,
                        pushstatus: 'Y',
                        status: 'A',
                        noticecontent: notificationContent,
                        notificationcode: notificationtype.notificationcode,
                        noticedata: notificationdata,
                        user: checkuser
                    }

                    var newNotificationlogs = await strapi.query('notificationlog').create(dataNotificationlog);

                    //push notification test
                    //get all deviceid reg of this user
                    var listdeviceidreg = await strapi.query('deviceinfo').model.query(qb => {
                        qb.select('devicereg', 'platform')
                            .where('user', checkuser.id);
                    }).fetchAll();
                    listdeviceidreg = listdeviceidreg.toJSON();
                    ////console.log(listdeviceidreg);
                    let arraydevicereg = [];
                    let arraydeviceregios = [];
                    for (var index in listdeviceidreg) {
                        var deviveregid = listdeviceidreg[index].devicereg;
                        if (deviveregid != '' && deviveregid.length > 10 && listdeviceidreg[index].platform == 'android') {
                            arraydevicereg.push(deviveregid);
                        }

                        if (deviveregid != '' && deviveregid.length > 10 && listdeviceidreg[index].platform == 'ios') {
                            arraydeviceregios.push(deviveregid);
                        }
                    }

                    if (arraydevicereg.length > 0) {
                        //android
                        var newcontentforPushFirebase = removeAuthorFields(newNotificationlogs);
                        var dataReturn = await strapi.services.firebasecontrol.sendtoarraydeviceandroid(arraydevicereg, notificationTitle, newcontentforPushFirebase);
                        ////console.log(dataReturn);
                    }

                    if (arraydeviceregios.length > 0) {
                        //ios
                        var newcontentforPushFirebase = removeAuthorFields(newNotificationlogs);
                        var dataReturn = await strapi.services.firebasecontrol.sendtoarraydeviceios(arraydeviceregios, notificationTitle, newcontentforPushFirebase);
                        ////console.log(dataReturn);
                    }

                }
            }
            //5. update expried coin and exprieddate in coin
            //5.1 find total coin will expried expiredDate            

            expiredDate = moment.utc(startDate);
            expiredDate = expiredDate.endOf('month');


            var checkCreditAmount = await strapi.query('transaction-history').model.query(qb => {
                qb.select('creditamount', 'mobileuserid')
                    .where('mobileuserid', checkuser.id)
                    .where('expireddate', '<=', expiredDate.toISOString())
            }).fetchAll();
            var checkDebitAmount = await strapi.query('transaction-history').model.query(qb => {
                qb.select('debitamount', 'mobileuserid')
                    .where('mobileuserid', checkuser.id)
                    .where('expireddate', '<=', expiredDate.toISOString())
            }).fetchAll();
            var totalCredit = 0;
            var totalDebit = 0;
            checkCreditAmount = checkCreditAmount.toJSON();
            checkDebitAmount = checkDebitAmount.toJSON();
            if (checkCreditAmount) {
                totalCredit = checkCreditAmount
                    .map(item => item.creditamount)
                    .reduce((prev, curr) => prev + curr, 0);
            }
            if (checkDebitAmount) {
                totalDebit = checkDebitAmount
                    .map(item => item.debitamount)
                    .reduce((prev, curr) => prev + curr, 0);
            }
            //if in this month or previus month have credit amount
            if (totalCredit > 0) {
                //find in day end of this month
                //5.2 update mobileusercoinaccount for nextexpriedamount and nextexprieddate
                var mycoinaccount = await strapi.query('mobileusercoinaccount').findOne({
                    mobileuserid: checkuser.id
                });

                if (mycoinaccount == null) {
                    var newmycoinaccount = await strapi.query('mobileusercoinaccount').create({
                        mobileuserid: checkuser.id,
                        balance: 0,
                        totalcredit: 0,
                        totaldebit: 0,
                        totalexpried: 0,
                        modifieddate: new Date(new Date().toUTCString())
                    });
                    mycoinaccount = await strapi.query('mobileusercoinaccount').findOne({
                        mobileuserid: checkuser.id
                    });
                }

                if (mycoinaccount) {
                    mycoinaccount.nextexpriedamount = totalCredit - totalDebit;
                    mycoinaccount.nextexprieddate = expiredDate.format();
                    await strapi.query('mobileusercoinaccount').update({ mobileuserid: checkuser.id },
                        mycoinaccount
                    );
                }
            } else {
                //find for next end day of month
                expiredDate = expiredDate.add(transactionconfig.monthexpired, 'months');
                checkCreditAmount = await strapi.query('transaction-history').model.query(qb => {
                    qb.select('creditamount', 'mobileuserid')
                        .where('mobileuserid', checkuser.id)
                        .where('expireddate', '<=', expiredDate.toISOString())
                }).fetchAll();
                checkDebitAmount = await strapi.query('transaction-history').model.query(qb => {
                    qb.select('debitamount', 'mobileuserid')
                        .where('mobileuserid', checkuser.id)
                        .where('expireddate', '<=', expiredDate.toISOString())
                }).fetchAll();
                totalCredit = 0;
                totalDebit = 0;
                checkCreditAmount = checkCreditAmount.toJSON();
                checkDebitAmount = checkDebitAmount.toJSON();
                if (checkCreditAmount) {
                    totalCredit = checkCreditAmount
                        .map(item => item.creditamount)
                        .reduce((prev, curr) => prev + curr, 0);
                }
                if (checkDebitAmount) {
                    totalDebit = checkDebitAmount
                        .map(item => item.debitamount)
                        .reduce((prev, curr) => prev + curr, 0);
                }
                var mycoinaccount = await strapi.query('mobileusercoinaccount').findOne({
                    mobileuserid: checkuser.id
                });
                if (mycoinaccount == null) {
                    var newmycoinaccount = await strapi.query('mobileusercoinaccount').create({
                        mobileuserid: checkuser.id,
                        balance: 0,
                        totalcredit: 0,
                        totaldebit: 0,
                        totalexpried: 0,
                        modifieddate: new Date(new Date().toUTCString())
                    });
                    mycoinaccount = await strapi.query('mobileusercoinaccount').findOne({
                        mobileuserid: checkuser.id
                    });
                }
                if (mycoinaccount) {
                    mycoinaccount.nextexpriedamount = totalCredit - totalDebit;
                    mycoinaccount.nextexprieddate = expiredDate.format();
                    await strapi.query('mobileusercoinaccount').update({ mobileuserid: checkuser.id },
                        mycoinaccount
                    );
                }
            }

            if (newlog && newlog.user) {
                delete newlog.user;
            }

            return {
                success: true,
                id: '0',
                message: "success",
                content_object: removeAuthorFields(newlog)
            }

        } else {
            return {
                success: false,
                id: '9',
                message: "Can not get next transaction config"
            }
        }
    },
    //================>Debit Coin
    debitCoinInStore: async(outletid, transactionamount, taxno, qrcode, debitamount, kcoinamount) => {
        //input: mobileuserid - this is seller action
        //input: qrcode - this is client wallet
        //input: outletid
        //input: transactionamount
        //input: debitamount
        //input: taxno               

        //check validate kcoinamount
        if (!debitamount || debitamount < 0) {
            return {
                success: false,
                id: '10',
                message: 'Please provide kcoin amount.'
            }
        }

        //2 get detail user with qrcode
        var checkuser = await strapi.query('user', 'users-permissions').findOne({
            qrcode: qrcode
        });
        if (checkuser == null) {
            return {
                success: false,
                id: '7',
                message: 'Invalidate qrcode.',
            };
        }

        var mycoinaccount = await strapi.query('mobileusercoinaccount').findOne({
            mobileuserid: checkuser.id
        });
        //3.1 re create mobileusercoinaccount for this
        if (mycoinaccount == null) {
            var newmycoinaccount = await strapi.query('mobileusercoinaccount').create({
                mobileuserid: checkuser.id,
                balance: 0,
                totalcredit: 0,
                totaldebit: 0,
                totalexpried: 0,
                modifieddate: new Date(new Date().toUTCString())
            });
            mycoinaccount = await strapi.query('mobileusercoinaccount').findOne({
                mobileuserid: checkuser.id
            });
        }

        //4. get detail from transaction-config
        var transactionconfig = await strapi.query('transaction-config').findOne({
            trxconfigid: '014'
        });
        if (transactionconfig) {
            //3.2 debit balance
            mycoinaccount.balance = mycoinaccount.balance - kcoinamount;
            mycoinaccount.totaldebit = mycoinaccount.totaldebit + kcoinamount;
            await strapi.query('mobileusercoinaccount').update({ mobileuserid: checkuser.id },
                mycoinaccount
            );
            //3.3 insert transaction history with debit and then credit
            var transactionno = uuid();
            var moment = require('moment');
            var startDate = new Date;
            var startDateUTC = moment.utc(startDate);
            var endDateUTC = moment.utc(startDate);
            endDateUTC = endDateUTC.add(transactionconfig.dayeffective, 'days');
            var expiredDate = moment.utc(startDate);
            expiredDate = expiredDate.add(transactionconfig.monthexpired, 'months');
            expiredDate = expiredDate.endOf('month');
            //credit amount KCoin
            const creditamount = (transactionamount * transactionconfig.amountpercent) / parseFloat(100);

            var newlogdebit = await strapi.query('transaction-history').create({
                createddate: startDateUTC.format(),
                expireddate: expiredDate.format(),
                availabledate: startDateUTC.format(),
                creditamount: 0,
                debitamount: kcoinamount,
                transactionamount: transactionamount,
                taxno: taxno,
                transactionno: transactionno,
                outletid: outletid,
                status: 'complete',
                user: checkuser,
                mobileuserid: checkuser.id,
                trxconfigid: transactionconfig.trxconfigid,
                remark: transactionconfig.trxdescription,
                isprocessed: true,
                useremail: checkuser.email,
                userqrcode: checkuser.qrcode
            });


            if (transactionconfig.amountpercent > 0) {

                //send notification
                //select notification type credit 1002
                var notificationtype = await strapi.query('notificationtypes').findOne({
                    notificationcode: '1002'
                });

                if (notificationtype) {
                    //build message
                    let notificationContent = notificationtype.template.replace('{AMOUNT}', kcoinamount);
                    let notificationdata = notificationtype.templatedata.replace('{AMOUNT}', kcoinamount);
                    let notificationTitle = notificationtype.title;
                    let notificationType = notificationtype.notificationtype;

                    // insert to table notificationlog
                    let dataNotificationlog = {
                        noticetypeid: notificationtype.id,
                        noticetypename: notificationtype.typename,
                        noticetitle: notificationtype.title,
                        pushstatus: 'Y',
                        status: 'A',
                        noticecontent: notificationContent,
                        notificationcode: notificationtype.notificationcode,
                        noticedata: notificationdata,
                        user: checkuser
                    }

                    var newNotificationlogs = await strapi.query('notificationlog').create(dataNotificationlog);

                    //push notification test
                    //get all deviceid reg of this user
                    var listdeviceidreg = await strapi.query('deviceinfo').model.query(qb => {
                        qb.select('devicereg', 'platform')
                            .where('user', checkuser.id);
                    }).fetchAll();
                    listdeviceidreg = listdeviceidreg.toJSON();
                    let arraydevicereg = [];
                    let arraydeviceregios = [];
                    for (var index in listdeviceidreg) {
                        var deviveregid = listdeviceidreg[index].devicereg;
                        if (deviveregid != '' && deviveregid.length > 10 && listdeviceidreg[index].platform == 'android') {
                            arraydevicereg.push(deviveregid);
                        }

                        if (deviveregid != '' && deviveregid.length > 10 && listdeviceidreg[index].platform == 'ios') {
                            arraydeviceregios.push(deviveregid);
                        }
                    }
                    if (arraydevicereg.length > 0) {
                        //android
                        var newcontentforPushFirebase = removeAuthorFields(newNotificationlogs);
                        var dataReturn = await strapi.services.firebasecontrol.sendtoarraydeviceandroid(arraydevicereg,
                            notificationTitle, newcontentforPushFirebase);

                    }

                    if (arraydeviceregios.length > 0) {
                        //ios
                        var newcontentforPushFirebase = removeAuthorFields(newNotificationlogs);
                        var dataReturn = await strapi.services.firebasecontrol.sendtoarraydeviceios(arraydeviceregios, notificationTitle, newcontentforPushFirebase);
                        ////console.log(dataReturn);

                    }
                }
            }
            if (newlogdebit && newlogdebit.user) {
                delete newlogdebit.user;
            }
            return {
                id: '0',
                message: 'success',
                //content_object: Object.values(removeAuthorFields(newlogdebit)),
                content_object: removeAuthorFields(newlogdebit),
            };
        } else {
            return {
                id: '9',
                message: 'Can not get next transaction config',
            };
        }



    },
    //<================Debit Coin
    staffFirstScan: async(mobileuserid, outletid, transactionamount, qrcode, taxno) => {
        //input: mobileuserid - this is seller action
        //input: qrcode
        //input: outletid
        //input: transactionamount
        //input: refno
        // input: taxno        

        //check validate transaction amount
        if (!transactionamount || transactionamount < 0) {

            return {
                success: false,
                id: '1',
                message: "Please provide transaction amount."
            }
        }
        //check validate outletid
        if (!outletid || outletid < 0) {

            return {
                success: false,
                id: '2',
                message: "Please provide outletid."
            }
        }
        //check validate qrcode
        if (!qrcode) {

            return {
                success: false,
                id: '4',
                message: "Please provide qrcode."
            }
        }

        //1 check if outletid not belong user
        const checkoutlet = await strapi.query('outlet').findOne({
            id: outletid,
        });
        if (checkoutlet == null) {
            //|| (checkoutlet != null && checkoutlet.user.id != mobileuserid)
            return {
                success: false,
                id: '6',
                message: "Invalidate outlet permission."
            }
        } else {
            let checkUserOfOutlet = checkoutlet.users.filter(s => s.id == mobileuserid);
            if (checkUserOfOutlet == null || (checkUserOfOutlet != null && checkUserOfOutlet.length == 0)) {
                return ctx.badRequest(
                    null,
                    formatError({
                        id: '6',
                        message: 'Invalidate outlet permission.',
                    })
                );
            }
        }
        //2 get detail user with qrcode
        var checkuser = await strapi.query('user', 'users-permissions').findOne({
            qrcode: qrcode
        });
        if (checkuser == null) {
            return {
                success: false,
                id: '7',
                message: "Invalidate qrcode."
            }
        }

        // check whether existing transaction 015 or not
        var trxhist = await strapi.query('transaction-history').count({
            trxconfigid: "015",
            user: checkuser.id
        });

        if (trxhist) {
            var result = await strapi.services.cointransactionservice.creditcoinInStore(mobileuserid, outletid, transactionamount, qrcode, taxno);
            return result;
        }

        //3. get detail from transaction-config
        var transactionconfig = await strapi.query('transaction-config').findOne({
            trxconfigid: '015'
        });
        if (transactionconfig) {
            //3.1 insert to coin transaction history            
            var startDate = new Date;
            var startDateUTC = moment.utc(startDate);
            var endDateUTC = moment.utc(startDate);
            endDateUTC = endDateUTC.add(transactionconfig.dayeffective, 'days');
            var expiredDate = moment.utc(startDate);
            expiredDate = expiredDate.add(transactionconfig.monthexpired, 'months');
            expiredDate = expiredDate.endOf('month');
            //credit amount KCoin
            let creditmyr = (transactionamount * transactionconfig.amountpercent) / parseFloat(100);
            let creditamount = 0;

            // calculate kcoinamount
            var exchangerate = await strapi.query('exchangerate').findOne({
                currencycode: 'K',
                basecurrencycode: 'MYR',
            });
            if (exchangerate) {
                creditamount = parseFloat(creditmyr * exchangerate.rate).toFixed(2);
            }

            var isprocessed = false;
            //expiredDate from transaction-config
            var newlog = await strapi.query('transaction-history').create({
                createddate: startDateUTC.format(),
                expireddate: expiredDate.format(),
                //availabledate: endDateUTC.toISOString(),
                availabledate: endDateUTC.format(),
                creditamount: creditamount,
                debitamount: 0,
                transactionamount: transactionamount,
                taxno: taxno,
                transactionno: uuid(),
                outletid: outletid,
                status: 'complete',
                user: checkuser,
                mobileuserid: checkuser.id,
                trxconfigid: transactionconfig.trxconfigid,
                remark: transactionconfig.trxdescription,
                isprocessed: isprocessed,
                useremail: checkuser.email,
                userqrcode: checkuser.qrcode
            });
            if (transactionconfig.dayeffective == 0) {
                //3.2 check if ransactionconfig.dayeffective == 0
                //add to balance now
                //4. update mobileusercoinaccount
                var mycoinaccount = await strapi.query('mobileusercoinaccount').findOne({
                    mobileuserid: checkuser.id
                });
                if (mycoinaccount == null) {
                    var newmycoinaccount = await strapi.query('mobileusercoinaccount').create({
                        mobileuserid: checkuser.id,
                        balance: 0,
                        totalcredit: 0,
                        totaldebit: 0,
                        totalexpried: 0,
                        modifieddate: new Date(new Date().toUTCString())
                    });
                    mycoinaccount = await strapi.query('mobileusercoinaccount').findOne({
                        mobileuserid: checkuser.id
                    });
                }
                if (mycoinaccount) {
                    mycoinaccount.balance = mycoinaccount.balance + creditamount;
                    mycoinaccount.totalcredit = mycoinaccount.totalcredit + creditamount;
                    await strapi.query('mobileusercoinaccount').update({ mobileuserid: checkuser.id },
                        mycoinaccount
                    );
                }
                //update transaction-history
                newlog.isprocessed = true;
                await strapi.query('transaction-history').update({
                    mobileuserid: checkuser.id,
                    trxconfigid: transactionconfig.trxconfigid,
                    outletid: outletid,
                    transactionno: newlog.transactionno
                }, {
                    isprocessed: true
                });
                //send notification here
                //select notification type credit 1001
                var notificationtype = await strapi.query('notificationtypes').findOne({
                    notificationcode: '1001'
                });
                if (notificationtype) {

                    //build message
                    let notificationContent = notificationtype.template.replace('{AMOUNT}', creditamount);
                    let notificationdata = notificationtype.templatedata.replace('{AMOUNT}', creditamount);
                    let notificationTitle = notificationtype.title;
                    let notificationType = notificationtype.notificationtype;
                    //insert to table notification logs

                    let dataNotificationlog = {
                        noticetypeid: notificationtype.id,
                        noticetypename: notificationtype.typename,
                        noticetitle: notificationtype.title,
                        pushstatus: 'Y',
                        status: 'A',
                        noticecontent: notificationContent,
                        notificationcode: notificationtype.notificationcode,
                        noticedata: notificationdata,
                        user: checkuser
                    }

                    var newNotificationlogs = await strapi.query('notificationlog').create(dataNotificationlog);

                    //push notification test
                    //get all deviceid reg of this user
                    var listdeviceidreg = await strapi.query('deviceinfo').model.query(qb => {
                        qb.select('devicereg', 'platform')
                            .where('user', checkuser.id);
                    }).fetchAll();
                    listdeviceidreg = listdeviceidreg.toJSON();
                    ////console.log(listdeviceidreg);
                    let arraydevicereg = [];
                    let arraydeviceregios = [];
                    for (var index in listdeviceidreg) {
                        var deviveregid = listdeviceidreg[index].devicereg;
                        if (deviveregid != '' && deviveregid.length > 10 && listdeviceidreg[index].platform == 'android') {
                            arraydevicereg.push(deviveregid);
                        }

                        if (deviveregid != '' && deviveregid.length > 10 && listdeviceidreg[index].platform == 'ios') {
                            arraydeviceregios.push(deviveregid);
                        }
                    }

                    if (arraydevicereg.length > 0) {
                        //android
                        var newcontentforPushFirebase = removeAuthorFields(newNotificationlogs);
                        var dataReturn = await strapi.services.firebasecontrol.sendtoarraydeviceandroid(arraydevicereg, notificationTitle, newcontentforPushFirebase);
                        ////console.log(dataReturn);
                    }

                    if (arraydeviceregios.length > 0) {
                        //ios
                        var newcontentforPushFirebase = removeAuthorFields(newNotificationlogs);
                        var dataReturn = await strapi.services.firebasecontrol.sendtoarraydeviceios(arraydeviceregios, notificationTitle, newcontentforPushFirebase);
                        ////console.log(dataReturn);
                    }

                }
            }
            //5. update expried coin and exprieddate in coin
            //5.1 find total coin will expried expiredDate            

            expiredDate = moment.utc(startDate);
            expiredDate = expiredDate.endOf('month');


            var checkCreditAmount = await strapi.query('transaction-history').model.query(qb => {
                qb.select('creditamount', 'mobileuserid')
                    .where('mobileuserid', checkuser.id)
                    .where('expireddate', '<=', expiredDate.toISOString())
            }).fetchAll();
            var checkDebitAmount = await strapi.query('transaction-history').model.query(qb => {
                qb.select('debitamount', 'mobileuserid')
                    .where('mobileuserid', checkuser.id)
                    .where('expireddate', '<=', expiredDate.toISOString())
            }).fetchAll();
            var totalCredit = 0;
            var totalDebit = 0;
            checkCreditAmount = checkCreditAmount.toJSON();
            checkDebitAmount = checkDebitAmount.toJSON();
            if (checkCreditAmount) {
                totalCredit = checkCreditAmount
                    .map(item => item.creditamount)
                    .reduce((prev, curr) => prev + curr, 0);
            }
            if (checkDebitAmount) {
                totalDebit = checkDebitAmount
                    .map(item => item.debitamount)
                    .reduce((prev, curr) => prev + curr, 0);
            }
            //if in this month or previus month have credit amount
            if (totalCredit > 0) {
                //find in day end of this month
                //5.2 update mobileusercoinaccount for nextexpriedamount and nextexprieddate
                var mycoinaccount = await strapi.query('mobileusercoinaccount').findOne({
                    mobileuserid: checkuser.id
                });

                if (mycoinaccount == null) {
                    var newmycoinaccount = await strapi.query('mobileusercoinaccount').create({
                        mobileuserid: checkuser.id,
                        balance: 0,
                        totalcredit: 0,
                        totaldebit: 0,
                        totalexpried: 0,
                        modifieddate: new Date(new Date().toUTCString())
                    });
                    mycoinaccount = await strapi.query('mobileusercoinaccount').findOne({
                        mobileuserid: checkuser.id
                    });
                }

                if (mycoinaccount) {
                    mycoinaccount.nextexpriedamount = totalCredit - totalDebit;
                    mycoinaccount.nextexprieddate = expiredDate.format();
                    await strapi.query('mobileusercoinaccount').update({ mobileuserid: checkuser.id },
                        mycoinaccount
                    );
                }
            } else {
                //find for next end day of month
                expiredDate = expiredDate.add(transactionconfig.monthexpired, 'months');
                checkCreditAmount = await strapi.query('transaction-history').model.query(qb => {
                    qb.select('creditamount', 'mobileuserid')
                        .where('mobileuserid', checkuser.id)
                        .where('expireddate', '<=', expiredDate.toISOString())
                }).fetchAll();
                checkDebitAmount = await strapi.query('transaction-history').model.query(qb => {
                    qb.select('debitamount', 'mobileuserid')
                        .where('mobileuserid', checkuser.id)
                        .where('expireddate', '<=', expiredDate.toISOString())
                }).fetchAll();
                totalCredit = 0;
                totalDebit = 0;
                checkCreditAmount = checkCreditAmount.toJSON();
                checkDebitAmount = checkDebitAmount.toJSON();
                if (checkCreditAmount) {
                    totalCredit = checkCreditAmount
                        .map(item => item.creditamount)
                        .reduce((prev, curr) => prev + curr, 0);
                }
                if (checkDebitAmount) {
                    totalDebit = checkDebitAmount
                        .map(item => item.debitamount)
                        .reduce((prev, curr) => prev + curr, 0);
                }
                var mycoinaccount = await strapi.query('mobileusercoinaccount').findOne({
                    mobileuserid: checkuser.id
                });
                if (mycoinaccount == null) {
                    var newmycoinaccount = await strapi.query('mobileusercoinaccount').create({
                        mobileuserid: checkuser.id,
                        balance: 0,
                        totalcredit: 0,
                        totaldebit: 0,
                        totalexpried: 0,
                        modifieddate: new Date(new Date().toUTCString())
                    });
                    mycoinaccount = await strapi.query('mobileusercoinaccount').findOne({
                        mobileuserid: checkuser.id
                    });
                }
                if (mycoinaccount) {
                    mycoinaccount.nextexpriedamount = totalCredit - totalDebit;
                    mycoinaccount.nextexprieddate = expiredDate.format();
                    await strapi.query('mobileusercoinaccount').update({ mobileuserid: checkuser.id },
                        mycoinaccount
                    );
                }
            }

            if (newlog && newlog.user) {
                delete newlog.user;
            }

            return {
                success: true,
                id: '0',
                message: "success",
                content_object: removeAuthorFields(newlog)
            }

        } else {
            return {
                success: false,
                id: '9',
                message: "Can not get next transaction config"
            }
        }
    },
    //================> Creditcoin CMS
    creditcoinCMS: async(mobileuserid, transactionamount, qrcode, taxno) => {
        //input: mobileuserid - this is seller action
        //input: qrcode       
        //input: transactionamount
        //input: refno
        // input: taxno

        //check validate transaction amount
        if (!transactionamount || transactionamount < 0) {

            return {
                success: false,
                id: '1',
                message: "Please provide transaction amount."
            }
        }

        //check validate qrcode
        if (!qrcode) {

            return {
                success: false,
                id: '4',
                message: "Please provide qrcode."
            }
        }

        //3. get detail from transaction-config
        var transactionconfig = await strapi.query('transaction-config').findOne({
            trxconfigid: '016'
        });
        if (transactionconfig) {
            //3.1 insert to coin transaction history
            var moment = require('moment');
            var startDate = new Date;
            var startDateUTC = moment.utc(startDate);
            var endDateUTC = moment.utc(startDate);
            endDateUTC = endDateUTC.add(transactionconfig.dayeffective, 'days');
            var expiredDate = moment.utc(startDate);
            expiredDate = expiredDate.add(transactionconfig.monthexpired, 'months');
            expiredDate = expiredDate.endOf('month');
            //credit amount KCoin
            let creditamount = (transactionamount * transactionconfig.amountpercent) / parseFloat(100);

            var isprocessed = false;
            //expiredDate from transaction-config
            var newlog = await strapi.query('transaction-history').create({
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
            if (transactionconfig.dayeffective == 0) {
                //3.2 check if ransactionconfig.dayeffective == 0
                //add to balance now
                //4. update mobileusercoinaccount
                var mycoinaccount = await strapi.query('mobileusercoinaccount').findOne({
                    mobileuserid: checkuser.id
                });
                if (mycoinaccount == null) {
                    var newmycoinaccount = await strapi.query('mobileusercoinaccount').create({
                        mobileuserid: checkuser.id,
                        balance: 0,
                        totalcredit: 0,
                        totaldebit: 0,
                        totalexpried: 0,
                        modifieddate: new Date(new Date().toUTCString())
                    });
                    mycoinaccount = await strapi.query('mobileusercoinaccount').findOne({
                        mobileuserid: checkuser.id
                    });
                }
                if (mycoinaccount) {
                    mycoinaccount.balance = mycoinaccount.balance + creditamount;
                    mycoinaccount.totalcredit = mycoinaccount.totalcredit + creditamount;
                    await strapi.query('mobileusercoinaccount').update({ mobileuserid: checkuser.id },
                        mycoinaccount
                    );
                }
                //update transaction-history
                newlog.isprocessed = true;
                await strapi.query('transaction-history').update({
                    mobileuserid: checkuser.id,
                    trxconfigid: transactionconfig.trxconfigid,
                    transactionno: newlog.transactionno
                }, {
                    isprocessed: true
                });
                //send notification here
                //select notification type credit 1001
                var notificationtype = await strapi.query('notificationtypes').findOne({
                    notificationcode: '1001'
                });
                if (notificationtype) {

                    //build message
                    let notificationContent = notificationtype.template.replace('{AMOUNT}', creditamount);
                    let notificationdata = notificationtype.templatedata.replace('{AMOUNT}', creditamount);
                    let notificationTitle = notificationtype.title;
                    let notificationType = notificationtype.notificationtype;
                    //insert to table notification logs

                    let dataNotificationlog = {
                        noticetypeid: notificationtype.id,
                        noticetypename: notificationtype.typename,
                        noticetitle: notificationtype.title,
                        pushstatus: 'Y',
                        status: 'A',
                        noticecontent: notificationContent,
                        notificationcode: notificationtype.notificationcode,
                        noticedata: notificationdata,
                        user: checkuser
                    }

                    var newNotificationlogs = await strapi.query('notificationlog').create(dataNotificationlog);

                    //push notification test
                    //get all deviceid reg of this user
                    var listdeviceidreg = await strapi.query('deviceinfo').model.query(qb => {
                        qb.select('devicereg', 'platform')
                            .where('user', checkuser.id);
                    }).fetchAll();
                    listdeviceidreg = listdeviceidreg.toJSON();
                    ////console.log(listdeviceidreg);
                    let arraydevicereg = [];
                    let arraydeviceregios = [];
                    for (var index in listdeviceidreg) {
                        var deviveregid = listdeviceidreg[index].devicereg;
                        if (deviveregid != '' && deviveregid.length > 10 && listdeviceidreg[index].platform == 'android') {
                            arraydevicereg.push(deviveregid);
                        }

                        if (deviveregid != '' && deviveregid.length > 10 && listdeviceidreg[index].platform == 'ios') {
                            arraydeviceregios.push(deviveregid);
                        }
                    }

                    if (arraydevicereg.length > 0) {
                        //android
                        var newcontentforPushFirebase = removeAuthorFields(newNotificationlogs);
                        var dataReturn = await strapi.services.firebasecontrol.sendtoarraydeviceandroid(arraydevicereg, notificationTitle, newcontentforPushFirebase);
                        ////console.log(dataReturn);
                    }

                    if (arraydeviceregios.length > 0) {
                        //ios
                        var newcontentforPushFirebase = removeAuthorFields(newNotificationlogs);
                        var dataReturn = await strapi.services.firebasecontrol.sendtoarraydeviceios(arraydeviceregios, notificationTitle, newcontentforPushFirebase);
                        ////console.log(dataReturn);
                    }

                }
            }
            //5. update expried coin and exprieddate in coin
            //5.1 find total coin will expried expiredDate            

            expiredDate = moment.utc(startDate);
            expiredDate = expiredDate.endOf('month');


            var checkCreditAmount = await strapi.query('transaction-history').model.query(qb => {
                qb.select('creditamount', 'mobileuserid')
                    .where('mobileuserid', checkuser.id)
                    .where('expireddate', '<=', expiredDate.toISOString())
            }).fetchAll();
            var checkDebitAmount = await strapi.query('transaction-history').model.query(qb => {
                qb.select('debitamount', 'mobileuserid')
                    .where('mobileuserid', checkuser.id)
                    .where('expireddate', '<=', expiredDate.toISOString())
            }).fetchAll();
            var totalCredit = 0;
            var totalDebit = 0;
            checkCreditAmount = checkCreditAmount.toJSON();
            checkDebitAmount = checkDebitAmount.toJSON();
            if (checkCreditAmount) {
                totalCredit = checkCreditAmount
                    .map(item => item.creditamount)
                    .reduce((prev, curr) => prev + curr, 0);
            }
            if (checkDebitAmount) {
                totalDebit = checkDebitAmount
                    .map(item => item.debitamount)
                    .reduce((prev, curr) => prev + curr, 0);
            }
            //if in this month or previus month have credit amount
            if (totalCredit > 0) {
                //find in day end of this month
                //5.2 update mobileusercoinaccount for nextexpriedamount and nextexprieddate
                var mycoinaccount = await strapi.query('mobileusercoinaccount').findOne({
                    mobileuserid: checkuser.id
                });

                if (mycoinaccount == null) {
                    var newmycoinaccount = await strapi.query('mobileusercoinaccount').create({
                        mobileuserid: checkuser.id,
                        balance: 0,
                        totalcredit: 0,
                        totaldebit: 0,
                        totalexpried: 0,
                        modifieddate: new Date(new Date().toUTCString())
                    });
                    mycoinaccount = await strapi.query('mobileusercoinaccount').findOne({
                        mobileuserid: checkuser.id
                    });
                }

                if (mycoinaccount) {
                    mycoinaccount.nextexpriedamount = totalCredit - totalDebit;
                    mycoinaccount.nextexprieddate = expiredDate.format();
                    await strapi.query('mobileusercoinaccount').update({ mobileuserid: checkuser.id },
                        mycoinaccount
                    );
                }
            } else {
                //find for next end day of month
                expiredDate = expiredDate.add(transactionconfig.monthexpired, 'months');
                checkCreditAmount = await strapi.query('transaction-history').model.query(qb => {
                    qb.select('creditamount', 'mobileuserid')
                        .where('mobileuserid', checkuser.id)
                        .where('expireddate', '<=', expiredDate.toISOString())
                }).fetchAll();
                checkDebitAmount = await strapi.query('transaction-history').model.query(qb => {
                    qb.select('debitamount', 'mobileuserid')
                        .where('mobileuserid', checkuser.id)
                        .where('expireddate', '<=', expiredDate.toISOString())
                }).fetchAll();
                totalCredit = 0;
                totalDebit = 0;
                checkCreditAmount = checkCreditAmount.toJSON();
                checkDebitAmount = checkDebitAmount.toJSON();
                if (checkCreditAmount) {
                    totalCredit = checkCreditAmount
                        .map(item => item.creditamount)
                        .reduce((prev, curr) => prev + curr, 0);
                }
                if (checkDebitAmount) {
                    totalDebit = checkDebitAmount
                        .map(item => item.debitamount)
                        .reduce((prev, curr) => prev + curr, 0);
                }
                var mycoinaccount = await strapi.query('mobileusercoinaccount').findOne({
                    mobileuserid: checkuser.id
                });
                if (mycoinaccount == null) {
                    var newmycoinaccount = await strapi.query('mobileusercoinaccount').create({
                        mobileuserid: checkuser.id,
                        balance: 0,
                        totalcredit: 0,
                        totaldebit: 0,
                        totalexpried: 0,
                        modifieddate: new Date(new Date().toUTCString())
                    });
                    mycoinaccount = await strapi.query('mobileusercoinaccount').findOne({
                        mobileuserid: checkuser.id
                    });
                }
                if (mycoinaccount) {
                    mycoinaccount.nextexpriedamount = totalCredit - totalDebit;
                    mycoinaccount.nextexprieddate = expiredDate.format();
                    await strapi.query('mobileusercoinaccount').update({ mobileuserid: checkuser.id },
                        mycoinaccount
                    );
                }
            }

            if (newlog && newlog.user) {
                delete newlog.user;
            }

            return {
                success: true,
                id: '0',
                message: "success",
                content_object: removeAuthorFields(newlog)
            }

        } else {
            return {
                success: false,
                id: '9',
                message: "Can not get next transaction config"
            }
        }
    }
}