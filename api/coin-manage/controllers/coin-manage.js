'use strict';

/**
 * coin-manage.js controller
 *
 * @description: A set of functions called "actions" for managing Mobile User.
 */

/* eslint-disable no-useless-escape */
const crypto = require('crypto');
const uuid = require('uuid');
const _ = require('lodash');
const grant = require('grant-koa');
const { sanitizeEntity } = require('strapi-utils');
const moment = require('moment');
const emailRegExp = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
const formatError = error => [
    { messages: [{ id: error.id, message: error.message, field: error.field }] },
];
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

const generateTransactNo = (length = 6) => {
    let text = ''
    let possible = '0123456789'
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length))
    }

    return moment.utc(new Date).format("YYYYMMDDHHmmss") + text;
}


module.exports = {
    //================>Credit Coin At Shop
    creditCoinAtShop: async ctx => {
        //input: mobileuserid - this is seller action
        //input: qrcode
        //input: outletid
        //input: transactionamount
        //input: taxno
        //trxconfigid : 003 Collect at shop
        const { mobileuserid } = ctx.request.body;
        const { outletid } = ctx.request.body;
        const { transactionamount } = ctx.request.body;
        const { taxno } = ctx.request.body;
        const { qrcode } = ctx.request.body;
        //check validate transaction amount
        if (!transactionamount || transactionamount < 0) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'coin_manage.credit_coin_at_shop.error.transactionamout.invalid',
                    message: 'Please provide transaction amount.',
                })
            );
        }
        //check validate outletid
        if (!outletid || outletid < 0) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'coin_manage.credit_coin_at_shop.error.outlet.invalid',
                    message: 'Please provide transaction outletid.',
                })
            );
        }
        //check validate taxno
        if (!taxno) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'coin_manage.credit_coin_at_shop.error.taxno.invalid',
                    message: 'Please provide taxno.',
                })
            );
        }
        //check validate qrcode
        if (!qrcode) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'coin_manage.credit_coin_at_shop.error.qrcode.invalid',
                    message: 'Please provide qrcode.',
                })
            );
        }
        //check jwt token
        if (ctx.request && ctx.request.header && ctx.request.header.authorization) {
            try {
                const { id, isAdmin = false } = await strapi.plugins['users-permissions'].services.jwt.getToken(ctx);
                if (mobileuserid != id) {
                    return ctx.badRequest(
                        null,
                        formatError({
                            id: 'coin_manage.credit_coin_at_shop.invalid-token',
                            message: 'This login token is not match with Mobile User Id',
                        })
                    );
                }
            } catch (err) {
                return handleErrors(ctx, err, 'unauthorized');
            }
        }
        //1 check if outletid not belong user
        const checkoutlet = await strapi.query('outlet').findOne({
            id: outletid,
        });
        if (checkoutlet == null || (checkoutlet != null && checkoutlet.user.id != mobileuserid)) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'coin_manage.credit_coin_at_shop.error.outlet.invalid_permission',
                    message: 'Invalid outlet permission.',
                })
            );
        }
        //2 get detail user with qrcode
        var checkuser = await strapi.query('user', 'users-permissions').findOne({
            qrcode: qrcode
        });
        if (checkuser == null) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'coin_manage.credit_coin_at_shop.error.qrcode.invalid',
                    message: 'invalid qrcode.',
                })
            );
        }
        //3. get detail from transaction-config
        var transactionconfig = await strapi.query('transaction-config').findOne({
            trxconfigid: '003'
        });
        if (transactionconfig) {
            //3.1 insert to coin transaction history           
            var startDate = new Date;
            var startDateUTC = moment.utc(startDate);
            var endDateUTC = moment.utc(startDate);
            var endDateUTC = endDateUTC.add(transactionconfig.dayeffective, 'days');
            var expiredDate = moment.utc(startDate);
            expiredDate = expiredDate.add(transactionconfig.monthexpired, 'months');
            expiredDate = expiredDate.endOf('month');
            //credit amount KCoin
            const creditamount = (transactionamount * transactionconfig.amountpercent) / parseFloat(100);
            var isprocessed = false;
            //expiredDate from transaction-config
            var newlog = await strapi.query('transaction-history').create({
                createddate: startDateUTC.format(),
                expireddate: expiredDate.format(),
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
                isprocessed: isprocessed
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
                    strapi.query('mobileusercoinaccount').update({ mobileuserid: checkuser.id },
                        mycoinaccount
                    );
                }
                //update transaction-history
                newlog.isprocessed = true;
                strapi.query('transaction-history').update({
                    mobileuserid: checkuser.id,
                    trxconfigid: transactionconfig.trxconfigid,
                    outletid: outletid,
                    transactionno: newlog.transactionno
                }, {
                    isprocessed: true
                });
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
                    strapi.query('mobileusercoinaccount').update({ mobileuserid: checkuser.id },
                        mycoinaccount
                    );
                }
            }

            if (newlog && newlog.user) {
                delete newlog.user;
            }
            ctx.send({
                id: 'success',
                message: 'success',
                content_object: newlog,
            });
        } else {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'coin_manage.credit_coin_at_shop.transaction-config',
                    message: 'Can not get next transaction config',
                })
            );
        }
    },
    //<================Credit Coin At Shop
    //================>My Coin
    myCoin: async ctx => {
        //input: mobileuserid
        const { mobileuserid } = ctx.request.body;
        if (ctx.request && ctx.request.header && ctx.request.header.authorization) {
            try {
                const { id, isAdmin = false } = await strapi.plugins['users-permissions'].services.jwt.getToken(ctx);
                if (mobileuserid != id) {
                    return ctx.badRequest(
                        null,
                        formatError({
                            id: 'coin_manage.my_coin.invalide-token',
                            message: 'This login token is not match with Mobile User Id',
                        })
                    );
                }
            } catch (err) {
                return handleErrors(ctx, err, 'unauthorized');
            }
        }
        //get detail of coin this account;
        var checkuser = await strapi.query('user', 'users-permissions').findOne({
            id: mobileuserid
        });
        if (checkuser == null) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'coin_manage.my_coin.error.invalidate-mobileuser-id',
                    message: 'Invalidate mobileuser id',
                })
            );
        }
        var startDate = new Date;
        var checkCreditAmount = await strapi.query('transaction-history').model.query(function(qb) {
            qb.select('creditamount', 'mobileuserid');
            qb.where(function() {
                this.where('mobileuserid', mobileuserid);
                this.where('availabledate', '<=', startDate.toISOString());
            });
            qb.orWhere(function() {
                this.where('mobileuserid', mobileuserid);
                this.where('expireddate', '>', startDate.toISOString());
            });
        }).fetchAll();
        var checkDebitAmount = await strapi.query('transaction-history').model.query(qb => {
            qb.select('debitamount', 'mobileuserid')
                .where('mobileuserid', mobileuserid)
                .where('availabledate', '<=', startDate.toISOString());
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

        var checkexpiredamount = await strapi.query('transaction-history').model.query(qb => {
            qb.select('creditamount', 'debitamount', 'mobileuserid')
                .where('mobileuserid', mobileuserid)
                //.where('creditamount', '>', 0)
                .where('availabledate', '<', startDate.toISOString())
                .where('expireddate', '<=', startDate.toISOString());
        }).fetchAll();
        var checkpendingamount = await strapi.query('transaction-history').model.query(qb => {
            qb.select('creditamount', 'debitamount', 'mobileuserid')
                .where('mobileuserid', mobileuserid)
                //.where('creditamount', '>', 0)
                .where('availabledate', '>=', startDate.toISOString())
                .where('expireddate', '>', startDate.toISOString());
        }).fetchAll();
        var canredeemamount = totalCredit - totalDebit;
        var pendingamount = 0;
        var expiredamount = 0;
        checkexpiredamount = checkexpiredamount.toJSON();
        checkpendingamount = checkpendingamount.toJSON();

        if (checkexpiredamount) {
            const tmpCredit = checkexpiredamount
                .map(item => item.creditamount)
                .reduce((prev, curr) => prev + curr, 0);
            const tmpDebit = checkexpiredamount
                .map(item => item.debitamount)
                .reduce((prev, curr) => prev + curr, 0);
            expiredamount = tmpCredit - tmpDebit;
        }
        if (checkpendingamount) {
            const tmpCredit = checkpendingamount
                .map(item => item.creditamount)
                .reduce((prev, curr) => prev + curr, 0);
            const tmpDebit = checkpendingamount
                .map(item => item.debitamount)
                .reduce((prev, curr) => prev + curr, 0);
            pendingamount = tmpCredit - tmpDebit;
        }
        var mycoin = {
            qrcode: checkuser.qrcode,
            kcoin: canredeemamount + pendingamount, //canredeem + pending coin
            username: checkuser.username,
            phone: checkuser.phone
        };
        mycoin.canredeemamount = canredeemamount;
        mycoin.pendingamount = pendingamount;
        mycoin.expiredamount = expiredamount;
        mycoin.coinexpireddate = startDate.toISOString();
        ctx.send({
            id: 'success',
            message: 'success',
            content_object: mycoin,
        });
    },
    //<================My Coin
    //================>My Coin New
    myCoinNew: async ctx => {
        //input: mobileuserid
        const { mobileuserid } = ctx.request.body;
        if (ctx.request && ctx.request.header && ctx.request.header.authorization) {
            try {
                const { id, isAdmin = false } = await strapi.plugins['users-permissions'].services.jwt.getToken(ctx);
                if (mobileuserid != id) {
                    return ctx.badRequest(
                        null,
                        formatError({
                            id: 'coin_manage.my_coin.invalide-token',
                            message: 'This login token is not match with Mobile User Id',
                        })
                    );
                }
            } catch (err) {
                return handleErrors(ctx, err, 'unauthorized');
            }
        }
        //get detail of coin this account;
        var checkuser = await strapi.query('user', 'users-permissions').findOne({
            id: mobileuserid
        });
        if (checkuser == null) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'coin_manage.my_coin.error.invalidate-mobileuser-id',
                    message: 'Invalidate mobileuser id',
                })
            );
        }
        var mycoinaccount = await strapi.query('mobileusercoinaccount').findOne({
            mobileuserid: mobileuserid
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
        var mycoin = {
            qrcode: checkuser.qrcode,
            kcoin: mycoinaccount.balance,
            username: checkuser.username,
            phone: checkuser.phone
        };
        var exchangerate = await strapi.query('exchangerate').findOne({
            currencycode: 'K',
            basecurrencycode: 'MYR',
        });
        if (exchangerate) {
            mycoin.myramount = parseFloat(mycoinaccount.balance / exchangerate.rate).toFixed(2);
        }
        mycoin.canredeemamount = mycoinaccount.balance;
        mycoin.pendingamount = 0;
        mycoin.expiredamount = mycoinaccount.nextexpriedamount;
        mycoin.coinexpireddate = mycoinaccount.nextexprieddate;
        ctx.send({
            id: 'success',
            message: 'success',
            content_object: mycoin,
        });
    },
    //<================My Coin New
    //================>My Coin History
    myCoinHistory: async ctx => {
        //input: mobileuserid
        const { mobileuserid } = ctx.request.body;
        var { pagesize } = ctx.request.body;
        var { pagenumber } = ctx.request.body;
        if (!pagesize)
            pagesize = 10;
        if (!pagenumber)
            pagenumber = 0;
        if (ctx.request && ctx.request.header && ctx.request.header.authorization) {
            try {
                const { id, isAdmin = false } = await strapi.plugins['users-permissions'].services.jwt.getToken(ctx);
                if (mobileuserid != id) {
                    return ctx.badRequest(
                        null,
                        formatError({
                            id: 'coin_manage.my_coin.invalide-token',
                            message: 'This login token is not match with Mobile User Id',
                        })
                    );
                }
            } catch (err) {
                return handleErrors(ctx, err, 'unauthorized');
            }
        }
        //get detail of coin this account;
        var checkuser = await strapi.query('user', 'users-permissions').findOne({
            id: mobileuserid
        });
        if (checkuser == null) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'coin_manage.my_coin.error.qrcode.invalidate',
                    message: 'Invalidate qrcode.',
                })
            );
        }
        var startDate = new Date;
        var checkCreditAmount = await strapi.query('transaction-history').model.query(qb => {
            qb.select('creditamount', 'mobileuserid')
                .where('mobileuserid', mobileuserid)
                .where('availabledate', '<=', startDate.toISOString())
                //.where('expireddate', '>', startDate.toISOString());
        }).fetchAll();
        var checkDebitAmount = await strapi.query('transaction-history').model.query(qb => {
            qb.select('debitamount', 'mobileuserid')
                .where('mobileuserid', mobileuserid)
                .where('availabledate', '<=', startDate.toISOString());
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
        var checkexpiredamount = await strapi.query('transaction-history').model.query(qb => {
            qb.select('creditamount', 'debitamount', 'mobileuserid')
                .where('mobileuserid', mobileuserid)
                .where('creditamount', '>', 0)
                .where('availabledate', '<', startDate.toISOString())
                .where('expireddate', '<=', startDate.toISOString());
        }).fetchAll();
        var checkpendingamount = await strapi.query('transaction-history').model.query(qb => {
            qb.select('creditamount', 'debitamount', 'mobileuserid')
                .where('mobileuserid', mobileuserid)
                .where('creditamount', '>', 0)
                .where('availabledate', '>=', startDate.toISOString())
                .where('expireddate', '>', startDate.toISOString());
        }).fetchAll();

        var canredeemamount = totalCredit - totalDebit;
        var pendingamount = 0;
        var expiredamount = 0;
        checkexpiredamount = checkexpiredamount.toJSON();
        checkpendingamount = checkpendingamount.toJSON();

        if (checkexpiredamount) {
            const tmpCredit = checkexpiredamount
                .map(item => item.creditamount)
                .reduce((prev, curr) => prev + curr, 0);
            const tmpDebit = checkexpiredamount
                .map(item => item.debitamount)
                .reduce((prev, curr) => prev + curr, 0);
            expiredamount = tmpCredit - tmpDebit;
        }
        if (checkpendingamount) {
            const tmpCredit = checkpendingamount
                .map(item => item.creditamount)
                .reduce((prev, curr) => prev + curr, 0);
            const tmpDebit = checkpendingamount
                .map(item => item.debitamount)
                .reduce((prev, curr) => prev + curr, 0);
            pendingamount = tmpCredit - tmpDebit;
        }
        var mycoin = {
            qrcode: checkuser.qrcode,
            kcoin: canredeemamount + pendingamount, //canredeem + pending coin
            username: checkuser.username,
            phone: checkuser.phone
        };
        mycoin.canredeemamount = canredeemamount;
        mycoin.pendingamount = pendingamount;
        mycoin.expiredamount = expiredamount;
        mycoin.coinexpireddate = startDate.toISOString();
        //1.get detail transaction order by created date
        var cointransaction = await strapi.query('transaction-history').find({
            mobileuserid: mobileuserid,
            _limit: pagesize,
            _start: pagesize * pagenumber,
            _sort: 'createddate:desc'
        });
        //1.1 remove unuse field
        cointransaction.forEach(function(v) { delete v.user });

        ctx.send({
            id: 'success',
            message: 'success',
            content_object: {
                mycoinwallet: mycoin,
                transaction: Object.values(removeAuthorFields(cointransaction))
            },
        });
    },
    //<================My Coin History
    //================>Credit Coin
    creditCoin: async ctx => {
        //input: mobileuserid - this is seller action
        //input: qrcode
        //input: outletid
        //input: transactionamount
        //input: taxno
        const { mobileuserid } = ctx.request.body;
        const { outletid } = ctx.request.body;
        const { transactionamount } = ctx.request.body;
        const { kcoinamount } = ctx.request.body;
        const { taxno } = ctx.request.body;
        const { qrcode } = ctx.request.body;
        //check validate transaction amount
        if (!transactionamount || transactionamount < 0) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'coin_manage.credit_coin.error.transactionamout.invalidate',
                    message: 'Please provide transaction amount.',
                })
            );
        }
        //check validate outletid
        if (!outletid || outletid < 0) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'coin_manage.credit_coin.error.outlet.invalidate',
                    message: 'Please provide transaction outletid.',
                })
            );
        }
        //check validate taxno
        if (!taxno) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'coin_manage.credit_coin.error.taxno.invalidate',
                    message: 'Please provide taxno.',
                })
            );
        }
        //check validate qrcode
        if (!qrcode) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'coin_manage.credit_coin.error.qrcode.invalidate',
                    message: 'Please provide qrcode.',
                })
            );
        }
        //check jwt token
        if (ctx.request && ctx.request.header && ctx.request.header.authorization) {
            try {
                const { id, isAdmin = false } = await strapi.plugins['users-permissions'].services.jwt.getToken(ctx);
                if (mobileuserid != id) {
                    return ctx.badRequest(
                        null,
                        formatError({
                            id: 'coin_manage.my_coin.invalide-token',
                            message: 'This login token is not match with Mobile User Id',
                        })
                    );
                }
            } catch (err) {
                return handleErrors(ctx, err, 'unauthorized');
            }
        }
        //1 check if outletid not belong user
        const checkoutlet = await strapi.query('outlet').findOne({
            id: outletid,
        });
        if (checkoutlet == null || (checkoutlet != null && checkoutlet.user.id != mobileuserid)) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'coin_manage.credit_coin.error.outlet.invalidate_permission',
                    message: 'Invalidate outlet permission.',
                })
            );
        }
        //2 get detail user with qrcode
        var checkuser = await strapi.query('user', 'users-permissions').findOne({
            qrcode: qrcode
        });
        if (checkuser == null) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'coin_manage.credit_coin.error.qrcode.invalidate',
                    message: 'Invalidate qrcode.',
                })
            );
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
            if (kcoinamount != null && parseFloat(kcoinamount) > 0) {
                creditamount = parseFloat(kcoinamount);
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
                isprocessed: isprocessed
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
                    let notificationContent = notificationtype.template.replace('{AMOUNT}', kcoinamount);
                    let notificationdata = notificationtype.templatedata.replace('{AMOUNT}', kcoinamount);
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
            ctx.send({
                id: 'success',
                message: 'success',
                content_object: removeAuthorFields(newlog),
            });
        } else {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'coin_manage.credit_coin.transaction-config',
                    message: 'Can not get next transaction config',
                })
            );
        }
    },
    //<================Credit Coin
    //================>Debit Coin
    debitCoin: async ctx => {
        //input: mobileuserid - this is seller action
        //input: qrcode - this is client wallet
        //input: outletid
        //input: transactionamount
        //input: taxno
        //input: kcoinamount
        const { mobileuserid } = ctx.request.body;
        const { outletid } = ctx.request.body;
        const { transactionamount } = ctx.request.body;
        const { taxno } = ctx.request.body;
        const { qrcode } = ctx.request.body;
        const { kcoinamount } = ctx.request.body;
        //check validate transaction amount
        if (!transactionamount || transactionamount < 0) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'coin_manage.debit_coin.error.transactionamout.invalidate',
                    message: 'Please provide transaction amount.',
                })
            );
        }
        //check validate outletid
        if (!outletid || outletid < 0) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'coin_manage.debit_coin.error.outlet.invalidate',
                    message: 'Please provide transaction outletid.',
                })
            );
        }
        //check validate taxno
        if (!taxno) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'coin_manage.debit_coin.error.taxno.invalidate',
                    message: 'Please provide taxno.',
                })
            );
        }
        //check validate qrcode
        if (!qrcode) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'coin_manage.debit_coin.error.qrcode.invalidate',
                    message: 'Please provide qrcode.',
                })
            );
        }
        //check validate kcoinamount
        if (!kcoinamount || kcoinamount < 0) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'coin_manage.debit_coin.error.kcoinamount.invalidate',
                    message: 'Please provide kcoin amount.',
                })
            );
        }
        //check jwt token
        if (ctx.request && ctx.request.header && ctx.request.header.authorization) {
            try {
                const { id, isAdmin = false } = await strapi.plugins['users-permissions'].services.jwt.getToken(ctx);
                if (mobileuserid != id) {
                    return ctx.badRequest(
                        null,
                        formatError({
                            id: 'coin_manage.debit_coin.invalide-token',
                            message: 'This login token is not match with Mobile User Id',
                        })
                    );
                }
            } catch (err) {
                return handleErrors(ctx, err, 'unauthorized');
            }
        }
        //1 check if outletid not belong user
        const checkoutlet = await strapi.query('outlet').findOne({
            id: outletid,
        });
        if (checkoutlet == null || (checkoutlet != null && checkoutlet.user.id != mobileuserid)) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'coin_manage.debit_coin.error.outlet.invalidate_permission',
                    message: 'Invalidate outlet permission.',
                })
            );
        }
        //2 get detail user with qrcode
        var checkuser = await strapi.query('user', 'users-permissions').findOne({
            qrcode: qrcode
        });
        if (checkuser == null) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'coin_manage.debit_coin.error.qrcode.invalidate',
                    message: 'Invalidate qrcode.',
                })
            );
        }
        //3. check valid balance
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
        if (mycoinaccount.balance < kcoinamount) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'coin_manage.debit_coin.error.balance.invalidate',
                    message: 'Insufficient Kcoin amount.',
                })
            );
        } else {
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
                    isprocessed: true
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
                ctx.send({
                    id: 'success',
                    message: 'success',
                    //content_object: Object.values(removeAuthorFields(newlogdebit)),
                    content_object: removeAuthorFields(newlogdebit),
                });
            } else {
                return ctx.badRequest(
                    null,
                    formatError({
                        id: 'coin_manage.debit_coin.transaction-config',
                        message: 'Can not get next transaction config',
                    })
                );
            }
        }


    },
    //<================Debit Coin
    //================>Claim Daily Coin
    claimDailyCoin: async ctx => {
        var moment = require('moment');
        //input: mobileuserid
        const { mobileuserid } = ctx.request.body;
        //check jwt token
        if (ctx.request && ctx.request.header && ctx.request.header.authorization) {
            try {
                const { id, isAdmin = false } = await strapi.plugins['users-permissions'].services.jwt.getToken(ctx);
                if (mobileuserid != id) {
                    return ctx.badRequest(
                        null,
                        formatError({
                            id: 'coin_manage.claim_daily_coin.invalide-token',
                            message: 'This login token is not match with Mobile User Id',
                        })
                    );
                }
            } catch (err) {
                return handleErrors(ctx, err, 'unauthorized');
            }
        }
        //1. check if user had recieved today coin
        var dailycoin = await strapi.query('dailycoinhistory').model.query(function(qb) {
            qb.select('datenumber', 'createddate', 'mobileuserid');
            qb.where(function() {
                this.where('mobileuserid', mobileuserid);
            });
            qb.orderBy('createddate', 'DESC');
        }).fetchAll();

        dailycoin = dailycoin.toJSON();

        var datenumber = 1;
        var amountrecieve = 0;
        var credit_or_debit = 'C';
        var trxconfigid = '';
        var transactionremark = '';
        var dayeffective = 0;
        var monthexpired = 1;
        if (dailycoin && Object.keys(dailycoin).length > 0) {

            var now = new Date;
            var createddate = moment(dailycoin[0].createddate);
            var utc_timestamp = moment(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
            if (utc_timestamp.diff(createddate, 'days') == 0) {
                return ctx.badRequest(
                    null,
                    formatError({
                        id: 'coin_manage.claim_daily_coin.today_had_recieved',
                        message: 'You had recieved your coin today.',
                    })
                );
            } else if (createddate.diff(utc_timestamp, 'days') == -1) {
                //add next transaction next datenumber
                datenumber = dailycoin[0].datenumber + 1;
                var nextdatenumber = await strapi.query('dailycoinschedule').findOne({
                    datenumber: datenumber,
                    status: 5
                });
                if (!nextdatenumber) {
                    return ctx.badRequest(
                        null,
                        formatError({
                            id: 'coin_manage.claim_daily_coin.date_number_error',
                            message: 'Can not get next date number.',
                        })
                    );
                } else {
                    var transactionconfig = await strapi.query('transaction-config').findOne({
                        trxconfigid: nextdatenumber.trxconfigid
                    });
                    if (transactionconfig) {
                        datenumber = nextdatenumber.datenumber;
                        amountrecieve = nextdatenumber.amountreceive;
                        credit_or_debit = transactionconfig.creditordebit;
                        trxconfigid = nextdatenumber.trxconfigid;
                        transactionremark = transactionconfig.trxdescription;
                        dayeffective = transactionconfig.dayeffective;
                        monthexpired = transactionconfig.monthexpired;

                    }

                }
            } else {
                var nextdatenumberfirst = await strapi.query('dailycoinschedule').findOne({
                    datenumber: 1,
                    status: 5
                });
                if (!nextdatenumberfirst) {
                    return ctx.badRequest(
                        null,
                        formatError({
                            id: 'coin_manage.claim_daily_coin.date_number_error',
                            message: 'Can not get next date number.',
                        })
                    );
                } else {
                    var transactionconfig = await strapi.query('transaction-config').findOne({
                        trxconfigid: nextdatenumberfirst.trxconfigid
                    });
                    if (transactionconfig) {
                        datenumber = nextdatenumberfirst.datenumber;
                        amountrecieve = nextdatenumberfirst.amountreceive;
                        credit_or_debit = transactionconfig.creditordebit;
                        trxconfigid = nextdatenumberfirst.trxconfigid;
                        transactionremark = transactionconfig.trxdescription;
                        dayeffective = transactionconfig.dayeffective;
                        monthexpired = transactionconfig.monthexpired;
                    }
                }
            }
        } else {
            var nextdatenumberfirst = await strapi.query('dailycoinschedule').findOne({
                datenumber: 1,
                status: 5
            });

            if (!nextdatenumberfirst) {
                return ctx.badRequest(
                    null,
                    formatError({
                        id: 'coin_manage.claim_daily_coin.date_number_error',
                        message: 'Can not get next date number.',
                    })
                );
            } else {
                //get amount from transaction-config
                var transactionconfig = await strapi.query('transaction-config').findOne({
                    trxconfigid: nextdatenumberfirst.trxconfigid
                });
                if (transactionconfig) {
                    datenumber = nextdatenumberfirst.datenumber;
                    amountrecieve = nextdatenumberfirst.amountreceive;
                    credit_or_debit = transactionconfig.creditordebit;
                    trxconfigid = nextdatenumberfirst.trxconfigid;
                    transactionremark = transactionconfig.trxdescription;
                    dayeffective = transactionconfig.dayeffective;
                    monthexpired = transactionconfig.monthexpired;
                }
            }
        }

        //2. insert dailycointransaction
        var createddatedfull = new Date;
        var newdailycoinhistory = await strapi.query('dailycoinhistory').create({
            datenumber: datenumber,
            mobileuserid: mobileuserid,
            createddate: createddatedfull,
            amountrecieve: amountrecieve,
            createddatedfull: createddatedfull
        });
        if (newdailycoinhistory) {
            //3.1 insert to coin transaction history
            var moment = require('moment');
            var startDate = new Date;
            var startDateUTC = moment.utc(startDate);
            var endDateUTC = startDateUTC.add(dayeffective, 'days');
            var expiredDate = moment.utc(startDate);
            expiredDate = expiredDate.add(monthexpired, 'months');
            expiredDate = expiredDate.endOf('month');
            //credit amount KCoin
            const creditamount = amountrecieve;
            var isprocessed = true;
            //expiredDate from transaction-config
            var newlog = await strapi.query('transaction-history').create({
                createddate: startDateUTC.format(),
                expireddate: expiredDate.format(),
                availabledate: endDateUTC.format(),
                creditamount: creditamount,
                debitamount: 0,
                transactionno: uuid(),
                status: 'complete',
                mobileuserid: mobileuserid,
                trxconfigid: trxconfigid,
                remark: transactionremark,
                isprocessed: isprocessed
            });
            //4. update mobileusercoinaccount
            if (transactionconfig.dayeffective == 0) {

                var mycoinaccount = await strapi.query('mobileusercoinaccount').findOne({
                    mobileuserid: mobileuserid
                });
                if (mycoinaccount == null) {
                    var newmycoinaccount = await strapi.query('mobileusercoinaccount').create({
                        mobileuserid: mobileuserid,
                        balance: 0,
                        totalcredit: 0,
                        totaldebit: 0,
                        totalexpried: 0,
                        modifieddate: new Date(new Date().toUTCString())
                    });
                    mycoinaccount = await strapi.query('mobileusercoinaccount').findOne({
                        mobileuserid: mobileuserid
                    });
                }

                if (mycoinaccount) {
                    mycoinaccount.balance = parseFloat(mycoinaccount.balance) + parseFloat(amountrecieve);
                    mycoinaccount.totalcredit = parseFloat(mycoinaccount.totalcredit) + parseFloat(amountrecieve);
                    await strapi.query('mobileusercoinaccount').update({ id: mycoinaccount.id }, mycoinaccount);
                }
            }
            //5. update expried coin and exprieddate in coin
            //5.1 find total coin will expried expiredDate

            expiredDate = moment.utc(startDate);
            expiredDate = expiredDate.endOf('month');


            var checkCreditAmount = await strapi.query('transaction-history').model.query(qb => {
                qb.select('creditamount', 'mobileuserid')
                    .where('mobileuserid', mobileuserid)
                    .where('expireddate', '<=', expiredDate.toISOString())
            }).fetchAll();
            var checkDebitAmount = await strapi.query('transaction-history').model.query(qb => {
                qb.select('debitamount', 'mobileuserid')
                    .where('mobileuserid', mobileuserid)
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
                    mobileuserid: mobileuserid
                });
                if (mycoinaccount == null) {
                    var newmycoinaccount = await strapi.query('mobileusercoinaccount').create({
                        mobileuserid: mobileuserid,
                        balance: 0,
                        totalcredit: 0,
                        totaldebit: 0,
                        totalexpried: 0,
                        modifieddate: new Date(new Date().toUTCString())
                    });
                    mycoinaccount = await strapi.query('mobileusercoinaccount').findOne({
                        mobileuserid: mobileuserid
                    });
                }
                if (mycoinaccount) {
                    mycoinaccount.nextexpriedamount = totalCredit - totalDebit;
                    mycoinaccount.nextexprieddate = expiredDate.format();
                    await strapi.query('mobileusercoinaccount').update({ mobileuserid: mobileuserid },
                        mycoinaccount
                    );
                }
            } else {
                //find for next end day of month
                expiredDate = expiredDate.add(monthexpired, 'months');
                checkCreditAmount = await strapi.query('transaction-history').model.query(qb => {
                    qb.select('creditamount', 'mobileuserid')
                        .where('mobileuserid', mobileuserid)
                        .where('expireddate', '<=', expiredDate.toISOString())
                }).fetchAll();
                checkDebitAmount = await strapi.query('transaction-history').model.query(qb => {
                    qb.select('debitamount', 'mobileuserid')
                        .where('mobileuserid', mobileuserid)
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
                    mobileuserid: mobileuserid
                });

                if (mycoinaccount == null) {
                    var newmycoinaccount = await strapi.query('mobileusercoinaccount').create({
                        mobileuserid: mobileuserid,
                        balance: 0,
                        totalcredit: 0,
                        totaldebit: 0,
                        totalexpried: 0,
                        modifieddate: new Date(new Date().toUTCString())
                    });
                    mycoinaccount = await strapi.query('mobileusercoinaccount').findOne({
                        mobileuserid: mobileuserid
                    });
                }

                if (mycoinaccount) {
                    mycoinaccount.nextexpriedamount = totalCredit - totalDebit;
                    mycoinaccount.nextexprieddate = expiredDate.format();
                    await strapi.query('mobileusercoinaccount').update({ mobileuserid: mobileuserid },
                        mycoinaccount
                    );
                }
            }

            if (newlog && newlog.user) {
                delete newlog.user;
            }
            ctx.send({
                id: 'success',
                message: 'success',
                content_object: newlog,
            });
        }
    },
    //<================Daily Credit Coin
    //================>My Daily Coin Schedule
    myDailyCoinSchedule: async ctx => {
        var moment = require('moment');
        //input: mobileuserid
        const { mobileuserid } = ctx.request.body;
        //check jwt token
        if (ctx.request && ctx.request.header && ctx.request.header.authorization) {
            try {
                const { id, isAdmin = false } = await strapi.plugins['users-permissions'].services.jwt.getToken(ctx);
                if (mobileuserid != id) {
                    return ctx.badRequest(
                        null,
                        formatError({
                            id: 'coin_manage.my_daily_coin_schedule.invalide-token',
                            message: 'This login token is not match with Mobile User Id',
                        })
                    );
                }
            } catch (err) {
                return handleErrors(ctx, err, 'unauthorized');
            }
        }
        //fill all return data
        var mydailycoinschedule = new Array();
        var dailycoinschedule = await strapi.query('dailycoinschedule').model.query(function(qb) {
            qb.select('datenumber', 'trxconfigid');
            qb.where(function() {
                this.where('status', 5);
            });
            qb.orderBy('datenumber', 'ASC');
        }).fetchAll();

        dailycoinschedule = dailycoinschedule.toJSON();

        for (const oneschedule of dailycoinschedule) {
            var transactionconfig = await strapi.query('transaction-config').findOne({
                trxconfigid: oneschedule.trxconfigid
            });
            if (transactionconfig) {
                mydailycoinschedule.push({
                    datenumber: oneschedule.datenumber,
                    trxconfigid: oneschedule.trxconfigid,
                    amountrecieve: transactionconfig.amount,
                    isrecieved: false,
                    canrecieved: false
                });
            }
        }
        //1. check if user had recieved today coin
        var dailycoin = await strapi.query('dailycoinhistory').model.query(function(qb) {
            qb.select('datenumber', 'createddate', 'mobileuserid');
            qb.where(function() {
                this.where('mobileuserid', mobileuserid);
            });
            qb.orderBy('createddate', 'DESC');
        }).fetchAll();

        dailycoin = dailycoin.toJSON();
        if (dailycoin && Object.keys(dailycoin).length > 0) {
            var now = new Date;
            var createddate = moment(dailycoin[0].createddate);
            var utc_timestamp = moment(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
            if (utc_timestamp.diff(createddate, 'days') == 0) {
                mydailycoinschedule.forEach(function(onedailycoinschedule) {
                    if (onedailycoinschedule.datenumber <= dailycoin[0].datenumber) {
                        onedailycoinschedule.isrecieved = true;
                    }
                });
            } else if (createddate.diff(utc_timestamp, 'days') == -1) {
                mydailycoinschedule.forEach(function(onedailycoinschedule) {
                    if (onedailycoinschedule.datenumber <= dailycoin[0].datenumber) {
                        onedailycoinschedule.isrecieved = true;
                    }
                    if (onedailycoinschedule.datenumber > dailycoin[0].datenumber) {
                        onedailycoinschedule.canrecieved = true;
                    }
                });
            } else {
                // -2 or than days
                mydailycoinschedule.forEach(function(onedailycoinschedule) {
                    onedailycoinschedule.canrecieved = true;
                });
            }
        } else {
            mydailycoinschedule[0].canrecieved = true;
        }

        ctx.send({
            id: 'success',
            message: 'success',
            content_object: mydailycoinschedule,
        });
    },
    //<================Claim Daily Coin
    //================>New Function

    coinPaymentRequest: async ctx => {
        console.log(ctx);
        console.log(ctx.request.header);

        const body = _.assign({}, ctx.request.body, ctx.params);
        const headers = _.assign({}, ctx.request.header, ctx.params);
        console.log(body);
        /*{

        } */
        console.log(headers);
        // x-refid
        // x-clientid
        // x-sig

        // get secrect key -> merchantcode
        let secrectkey = "";

        let sortstr = JSON.stringify(body, Object.keys(body).sort());
        // check signature        

        let sig = await strapi.services.coin_manage.generateSignature(
            user_address_id,
            products,
            shipping_note,
            null
        );

        //input: mobileuserid - this is seller action
        //input: qrcode
        //input: outletid
        //input: transactionamount
        //input: taxno



        const { mobileuserid } = ctx.request.body;
        const { outletid } = ctx.request.body;
        const { transactionamount } = ctx.request.body;
        const { kcoinamount } = ctx.request.body;
        const { taxno } = ctx.request.body;
        const { qrcode } = ctx.request.body;
        //check validate transaction amount
        if (!transactionamount || transactionamount < 0) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'coin_manage.credit_coin.error.transactionamout.invalidate',
                    message: 'Please provide transaction amount.',
                })
            );
        }
        //check validate outletid
        if (!outletid || outletid < 0) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'coin_manage.credit_coin.error.outlet.invalidate',
                    message: 'Please provide transaction outletid.',
                })
            );
        }
        //check validate taxno
        if (!taxno) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'coin_manage.credit_coin.error.taxno.invalidate',
                    message: 'Please provide taxno.',
                })
            );
        }
        //check validate qrcode
        if (!qrcode) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'coin_manage.credit_coin.error.qrcode.invalidate',
                    message: 'Please provide qrcode.',
                })
            );
        }
        //check jwt token
        if (ctx.request && ctx.request.header && ctx.request.header.authorization) {
            try {
                const { id, isAdmin = false } = await strapi.plugins['users-permissions'].services.jwt.getToken(ctx);
                if (mobileuserid != id) {
                    return ctx.badRequest(
                        null,
                        formatError({
                            id: 'coin_manage.my_coin.invalide-token',
                            message: 'This login token is not match with Mobile User Id',
                        })
                    );
                }
            } catch (err) {
                return handleErrors(ctx, err, 'unauthorized');
            }
        }
        //1 check if outletid not belong user
        const checkoutlet = await strapi.query('outlet').findOne({
            id: outletid,
        });
        if (checkoutlet == null || (checkoutlet != null && checkoutlet.user.id != mobileuserid)) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'coin_manage.credit_coin.error.outlet.invalidate_permission',
                    message: 'Invalidate outlet permission.',
                })
            );
        }
        //2 get detail user with qrcode
        var checkuser = await strapi.query('user', 'users-permissions').findOne({
            qrcode: qrcode
        });
        if (checkuser == null) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'coin_manage.credit_coin.error.qrcode.invalidate',
                    message: 'Invalidate qrcode.',
                })
            );
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
            if (kcoinamount != null && parseFloat(kcoinamount) > 0) {
                creditamount = parseFloat(kcoinamount);
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
                isprocessed: isprocessed
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
                    let notificationContent = notificationtype.template.replace('{AMOUNT}', kcoinamount);
                    let notificationdata = notificationtype.templatedata.replace('{AMOUNT}', kcoinamount);
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
            ctx.send({
                id: 'success',
                message: 'success',
                content_object: removeAuthorFields(newlog),
            });
        } else {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'coin_manage.credit_coin.transaction-config',
                    message: 'Can not get next transaction config',
                })
            );
        }
    },
    //<=====================User Confirm payment ( Phone)
    userConfirmPayment: async ctx => {
        console.log(ctx);
        console.log(ctx.request.header);

        const body = _.assign({}, ctx.request.body, ctx.params);
        const headers = _.assign({}, ctx.request.header, ctx.params);
        console.log(body);

        console.log(headers);
        return ctx.badRequest(
            null,
            formatError({
                id: 'coin_manage.credit_coin.transaction-config',
                message: 'Can not get next transaction config',
            })
        );
    },

    //================>New Function
    coinPayment: async ctx => {
        //input: mobileuserid - this is seller action
        //input: qrcode
        //input: outletid
        //input: transactionamount
        //input: debitamount
        //input: taxno
        const { mobileuserid } = ctx.request.body;
        const { outletid } = ctx.request.body;
        const { transactionamount } = ctx.request.body;
        const { debitamount } = ctx.request.body;
        const { taxno } = ctx.request.body;
        const { qrcode } = ctx.request.body;
        const { refno } = ctx.request.body;

        let kcoinamount = 0;
        //check validate transaction amount
        if (!transactionamount || transactionamount < 0) {

            ctx.send({
                success: false,
                id: '1',
                message: "Please provide transaction amount."
            })
            return;
        }
        //check validate outletid
        if (!outletid || outletid < 0) {

            return ctx.send({
                success: false,
                id: '2',
                message: "Please provide transaction outletid."
            })

        }
        //check validate refno
        if (!refno) {
            return ctx.send({
                success: false,
                id: '3',
                message: 'Please provide referenceno.',
            });
        }
        //check validate qrcode
        if (!qrcode) {

            return ctx.send({
                success: false,
                id: '4',
                message: 'Please provide qrcode.'
            });
        }
        //check jwt token
        if (ctx.request && ctx.request.header && ctx.request.header.authorization) {
            try {
                const { id, isAdmin = false } = await strapi.plugins['users-permissions'].services.jwt.getToken(ctx);
                if (mobileuserid != id) {
                    return ctx.send({
                        success: false,
                        id: '5',
                        message: 'This login token is not match with Mobile User Id'
                    });
                }
            } catch (err) {
                return handleErrors(ctx, err, 'unauthorized');
            }
        }
        //1 check if outletid not belong user
        const checkoutlet = await strapi.query('outlet').findOne({
            id: outletid,
        });
        if (checkoutlet == null || (checkoutlet != null && checkoutlet.user.id != mobileuserid)) {
            return ctx.send({
                success: false,
                id: '6',
                message: 'Invalidate outlet permission.',
            });
        }
        //2 get detail user with qrcode
        var checkuser = await strapi.query('user', 'users-permissions').findOne({
            qrcode: qrcode
        });
        if (checkuser == null) {
            return ctx.badRequest({
                success: false,
                id: '7',
                message: 'Wrong qrcode.',
            });
        }

        // calculate kcoinamount
        var exchangerate = await strapi.query('exchangerate').findOne({
            currencycode: 'K',
            basecurrencycode: 'MYR',
        });
        if (exchangerate) {
            kcoinamount = parseFloat(debitamount * exchangerate.rate).toFixed(2);
        }

        //3. check valid balance
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
        if (mycoinaccount.balance < kcoinamount) {
            return {
                success: false,
                id: '8',
                message: 'Insufficient Kcoin debit amount.',
            };
        }

        // Insert CoinPaymentTransact
        let trx = {
            transactno: generateTransactNo(6),
            refno: refno,
            user: mobileuserid,
            outlet: outletid,
            customeremail: checkuser.email
        }
        var paymenttrx = await strapi.query('coinpaymenttransact').create(trx);

        var creditid = 0;
        var debitid = 0;
        var creditcoinamt = 0;
        var debitcoinamt = 0;

        if (debitamount && (debitamount > 0)) {
            // call debit coin            
            let cdb = await strapi.services.cointransactionservice.debitCoinInStore(outletid, transactionamount, taxno, qrcode, debitamount, kcoinamount);

            if (cdb && (cdb.id === "0")) {
                debitcoinamt = cdb.content_object.debitamount;
                //create coinpaymentdetail
                let trxdetail1 = {
                    transactno: paymenttrx.transactno,
                    transaction_history: cdb.content_object.id,
                    status: "C"
                }
                var detail2 = await strapi.query('coinpaymentdetail').create(trxdetail1);
                debitid = detail2.id;
            } else {
                return ctx.send({
                    success: false,
                    id: cdb.id,
                    message: cdb.message,
                });
            }
        }


        // check if user is company's staff      
        if (checkuser.is_kkstaff) {
            // call firsttime staff
            // call credit coin            
            let fst = await strapi.services.cointransactionservice.staffFirstScan(mobileuserid, outletid, transactionamount, qrcode, taxno);
            if (fst && (fst.id === "0")) {
                creditcoinamt = fst.content_object.creditamount;
                //create coinpaymentdetail
                let trxdetail = {
                    transactno: paymenttrx.transactno,
                    transaction_history: fst.content_object.id,
                    status: "C"
                }
                var detail1 = await strapi.query('coinpaymentdetail').create(trxdetail);
                creditid = detail1.id;
            } else {
                return ctx.send({
                    success: false,
                    id: fst.id,
                    message: fst.message
                });
            }

        } else {
            // call credit coin            
            let crd = await strapi.services.cointransactionservice.creditcoinInStore(mobileuserid, outletid, transactionamount, qrcode, taxno);

            if (crd && (crd.id == "success")) {
                creditcoinamt = crd.content_object.creditamount;
                //create coinpaymentdetail
                let trxdetail = {
                    transactno: paymenttrx.transactno,
                    transaction_history: crd.content_object.id,
                    status: "C"
                }
                var detail1 = await strapi.query('coinpaymentdetail').create(trxdetail);
                creditid = detail1.id;
            } else {
                return ctx.send({
                    success: false,
                    id: crd.id,
                    message: crd.message
                });
            }
        }

        // update coinpaymenttransact
        var detailids = [];
        if (creditid > 0) {
            detailids = [creditid];
            if (debitid > 0) {
                detailids = [creditid, debitid];
            }
        }

        paymenttrx.creditamt = transactionamount;
        paymenttrx.creditcoinamt = creditcoinamt;
        paymenttrx.debitamt = debitamount;
        paymenttrx.debitcoinamt = debitcoinamt;
        paymenttrx.coinpaymentdetails = detailids;

        let ptrx = await strapi.query('coinpaymenttransact').update({ id: paymenttrx.id },
            paymenttrx
        );

        let paymentType = await strapi.services.common.normalizationResponse(ptrx, ["created_at", "updated_at", "user", "merchantcode", "outlet", "coinpaymentdetails"]);

        ctx.send({
            id: '0',
            message: 'success',
            content_object: paymentType,
        });

    },

    //================> Collect Coin      
    collectCoin: async ctx => {
        //input: mobileuserid - this is seller action
        //input: qrcode
        //input: outletid
        //input: transactionamount        
        //input: taxno
        //input: refno
        const { mobileuserid } = ctx.request.body;
        const { outletid } = ctx.request.body;
        const { transactionamount } = ctx.request.body;
        //const { debitamount } = ctx.request.body;
        const { taxno } = ctx.request.body;
        const { qrcode } = ctx.request.body;
        const { refno } = ctx.request.body;

        let kcoinamount = 0;
        //check validate transaction amount
        if (!transactionamount || transactionamount < 0) {

            ctx.send({
                success: false,
                id: '1',
                message: "Please provide transaction amount."
            })
            return;
        }
        //check validate outletid
        if (!outletid || outletid < 0) {

            return ctx.send({
                success: false,
                id: '2',
                message: "Please provide transaction outletid."
            })

        }
        //check validate refno
        if (!refno) {
            return ctx.send({
                success: false,
                id: '3',
                message: 'Please provide referenceno.',
            });
        }
        //check validate qrcode
        if (!qrcode) {

            return ctx.send({
                success: false,
                id: '4',
                message: 'Please provide qrcode.'
            });
        }
        //check jwt token
        if (ctx.request && ctx.request.header && ctx.request.header.authorization) {
            try {
                const { id, isAdmin = false } = await strapi.plugins['users-permissions'].services.jwt.getToken(ctx);
                if (mobileuserid != id) {
                    return ctx.send({
                        success: false,
                        id: '5',
                        message: 'This login token is not match with Mobile User Id'
                    });
                }
            } catch (err) {
                return handleErrors(ctx, err, 'unauthorized');
            }
        }
        //1 check if outletid not belong user
        const checkoutlet = await strapi.query('outlet').findOne({
            id: outletid,
        });
        if (checkoutlet == null || (checkoutlet != null && checkoutlet.user.id != mobileuserid)) {
            return ctx.send({
                success: false,
                id: '6',
                message: 'Invalidate outlet permission.',
            });
        }
        //2 get detail user with qrcode
        var checkuser = await strapi.query('user', 'users-permissions').findOne({
            qrcode: qrcode
        });
        if (checkuser == null) {
            return ctx.badRequest({
                success: false,
                id: '7',
                message: 'Wrong qrcode.',
            });
        }


        //3. check valid balance
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

        // Insert CoinPaymentTransact
        let trx = {
            transactno: generateTransactNo(6),
            refno: refno,
            user: mobileuserid,
            outlet: outletid,
            customeremail: checkuser.email,
            customerqrcode: checkuser.qrcode
        }
        var paymenttrx = await strapi.query('coinpaymenttransact').create(trx);

        var creditid = 0;
        var creditcoinamt = 0;

        // check if user is company's staff      
        if (checkuser.is_kkstaff) {
            // call firsttime staff
            // call credit coin            
            let fst = await strapi.services.cointransactionservice.staffFirstScan(mobileuserid, outletid, transactionamount, qrcode, taxno);
            if (fst && (fst.id === "0")) {
                creditcoinamt = fst.content_object.creditamount;
                //create coinpaymentdetail
                let trxdetail = {
                    transactno: paymenttrx.transactno,
                    transaction_history: fst.content_object.id,
                    status: "C"
                }
                var detail1 = await strapi.query('coinpaymentdetail').create(trxdetail);
                creditid = detail1.id;
            } else {
                return ctx.send({
                    success: false,
                    id: fst.id,
                    message: fst.message
                });
            }

        } else {
            // call credit coin            
            let crd = await strapi.services.cointransactionservice.creditcoinInStore(mobileuserid, outletid, transactionamount, qrcode, taxno);

            if (crd && (crd.id === "0")) {
                creditcoinamt = crd.content_object.creditamount;
                //create coinpaymentdetail
                let trxdetail = {
                    transactno: paymenttrx.transactno,
                    transaction_history: crd.content_object.id,
                    status: "C"
                }
                var detail1 = await strapi.query('coinpaymentdetail').create(trxdetail);
                creditid = detail1.id;
            } else {
                return ctx.send({
                    success: false,
                    id: crd.id,
                    message: crd.message
                });
            }
        }

        // update coinpaymenttransact
        var detailids = [];
        if (creditid > 0) {
            detailids = [creditid];
        }

        paymenttrx.creditamt = transactionamount;
        paymenttrx.creditcoinamt = creditcoinamt;
        paymenttrx.coinpaymentdetails = detailids;

        let ptrx = await strapi.query('coinpaymenttransact').update({ id: paymenttrx.id },
            paymenttrx
        );

        let paymentType = await strapi.services.common.normalizationResponse(ptrx, ["created_at", "updated_at", "user", "merchantcode", "outlet", "coinpaymentdetails"]);

        ctx.send({
            id: '0',
            message: 'success',
            content_object: paymentType,
        });

    },

    //===========================> Redeem Coin      
    coinRedeem: async ctx => {
        //input: mobileuserid - this is seller action
        //input: qrcode
        //input: outletid
        //input: transactionamount        
        //input: taxno
        //input: refno
        const { mobileuserid } = ctx.request.body;
        const { outletid } = ctx.request.body;
        const { transactionamount } = ctx.request.body;
        //const { debitamount } = ctx.request.body;
        const { taxno } = ctx.request.body;
        const { qrcode } = ctx.request.body;
        const { refno } = ctx.request.body;

        let kcoinamount = 0;
        //check validate transaction amount
        if (!transactionamount || transactionamount < 0) {

            ctx.send({
                success: false,
                id: '1',
                message: "Please provide transaction amount."
            })
            return;
        }
        //check validate outletid
        if (!outletid || outletid < 0) {

            return ctx.send({
                success: false,
                id: '2',
                message: "Please provide transaction outletid."
            })

        }
        //check validate refno
        if (!refno) {
            return ctx.send({
                success: false,
                id: '3',
                message: 'Please provide referenceno.',
            });
        }
        //check validate qrcode
        if (!qrcode) {

            return ctx.send({
                success: false,
                id: '4',
                message: 'Please provide qrcode.'
            });
        }
        //check jwt token
        if (ctx.request && ctx.request.header && ctx.request.header.authorization) {
            try {
                const { id, isAdmin = false } = await strapi.plugins['users-permissions'].services.jwt.getToken(ctx);
                if (mobileuserid != id) {
                    return ctx.send({
                        success: false,
                        id: '5',
                        message: 'This login token is not match with Mobile User Id'
                    });
                }
            } catch (err) {
                return handleErrors(ctx, err, 'unauthorized');
            }
        }
        //1 check if outletid not belong user
        const checkoutlet = await strapi.query('outlet').findOne({
            id: outletid,
        });
        if (checkoutlet == null || (checkoutlet != null && checkoutlet.user.id != mobileuserid)) {
            return ctx.send({
                success: false,
                id: '6',
                message: 'Invalidate outlet permission.',
            });
        }
        //2 get detail user with qrcode
        var checkuser = await strapi.query('user', 'users-permissions').findOne({
            qrcode: qrcode
        });
        if (checkuser == null) {
            return ctx.badRequest({
                success: false,
                id: '7',
                message: 'Wrong qrcode.',
            });
        }

        // calculate kcoinamount
        var exchangerate = await strapi.query('exchangerate').findOne({
            currencycode: 'K',
            basecurrencycode: 'MYR',
        });
        if (exchangerate) {
            kcoinamount = parseFloat(transactionamount * exchangerate.rate).toFixed(2);
        }

        //3. check valid balance
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
        if (mycoinaccount.balance < kcoinamount) {
            return {
                success: false,
                id: '8',
                message: 'Insufficient Kcoin debit amount.',
            };
        }

        // Insert CoinPaymentTransact
        let trx = {
            transactno: generateTransactNo(6),
            refno: refno,
            user: mobileuserid,
            outlet: outletid,
            customeremail: checkuser.email
        }
        var paymenttrx = await strapi.query('coinpaymenttransact').create(trx);

        //var creditid = 0;
        var debitid = 0;
        //var creditcoinamt = 0;
        var debitcoinamt = 0;

        if (transactionamount && (transactionamount > 0)) {
            // call debit coin            
            let cdb = await strapi.services.cointransactionservice.debitCoinInStore(outletid, transactionamount, taxno, qrcode, transactionamount, kcoinamount);

            if (cdb && (cdb.id === "0")) {
                debitcoinamt = cdb.content_object.debitamount;
                //create coinpaymentdetail
                let trxdetail1 = {
                    transactno: paymenttrx.transactno,
                    transaction_history: cdb.content_object.id,
                    status: "C"
                }
                var detail2 = await strapi.query('coinpaymentdetail').create(trxdetail1);
                debitid = detail2.id;
            } else {
                return ctx.send({
                    success: false,
                    id: cdb.id,
                    message: cdb.message,
                });
            }
        }


        // update coinpaymenttransact
        var detailids = [];
        if (debitid > 0) {
            detailids = [debitid];
        }

        paymenttrx.debitamt = transactionamount;
        paymenttrx.debitcoinamt = debitcoinamt;
        paymenttrx.coinpaymentdetails = detailids;

        let ptrx = await strapi.query('coinpaymenttransact').update({ id: paymenttrx.id },
            paymenttrx
        );

        let paymentType = await strapi.services.common.normalizationResponse(ptrx, ["created_at", "updated_at", "user", "merchantcode", "outlet", "coinpaymentdetails"]);

        ctx.send({
            id: '0',
            message: 'success',
            content_object: paymentType,
        });

    }
};