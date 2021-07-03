'use strict';
const crypto = require('crypto');
const uuid = require('uuid');
const _ = require('lodash');
const grant = require('grant-koa');
const { sanitizeEntity } = require('strapi-utils');

/**
 * Cron config that gives you an opportunity
 * to run scheduled jobs.
 *
 * The cron format consists of:
 * [SECOND (optional)] [MINUTE] [HOUR] [DAY OF MONTH] [MONTH OF YEAR] [DAY OF WEEK]
 *
 * See more details here: https://strapi.io/documentation/v3.x/concepts/configurations.html#cron-tasks
 */

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
    /**
     * Simple example.
     * Every monday at 1am.
     */
    '*/1 * * * *': async() => {
        //1 minute run
        ////console.log("Job credit balance" + new Date());
        var moment = require('moment');
        var startDate = new Date;
        var startDateUTC = moment.utc(startDate);
        var checkCreditAmount = await strapi.query('transaction-history').model.query(qb => {
            qb.select('creditamount', 'mobileuserid', 'id')
                .where('isprocessed', false)
                .where('creditamount', '>', 0)
                .where('availabledate', '<=', startDateUTC.toISOString())
        }).fetchAll();
        checkCreditAmount = checkCreditAmount.toJSON();
        if (checkCreditAmount) {
            var index;
            for (index = 0; index < checkCreditAmount.length; ++index) {
                var mycoinaccount = await strapi.query('mobileusercoinaccount').findOne({
                    mobileuserid: checkCreditAmount[index].mobileuserid
                });
                if (mycoinaccount) {
                    mycoinaccount.balance = mycoinaccount.balance + checkCreditAmount[index].creditamount;
                    mycoinaccount.totalcredit = mycoinaccount.totalcredit + checkCreditAmount[index].creditamount;
                    await strapi.query('mobileusercoinaccount').update({ mobileuserid: checkCreditAmount[index].mobileuserid },
                        mycoinaccount
                    );
                    //update 
                    await strapi.query('transaction-history').update({ id: checkCreditAmount[index].id }, {
                        isprocessed: true
                    });
                }
            }
        }
    },
    '*/59 * * * * *': async() => {
        //1 minute
        //read table pushnotificationmanage (active and check date)
        //and process 
        var moment = require('moment');
        var startDate = new Date;
        var startDateUTC = moment.utc(startDate);

        var checkNotificationActive = await strapi.query('pushnotificationmanage').model.query(qb => {
            qb.where('status', strapi.config.constants.pushnotification_status.active)
                .where('starttime', '<=', startDateUTC.toISOString())
                .where('endtime', '>=', startDateUTC.toISOString())
                .where('isrunjob', '<>', true)
        }).fetchAll();

        if (checkNotificationActive) {
            checkNotificationActive = checkNotificationActive.toJSON();
            //console.log(checkNotificationActive);
            for (let index = 0; index < checkNotificationActive.length; index++) {
                const element = checkNotificationActive[index];

                await strapi.query('pushnotificationmanage').update({ id: element.id }, { isrunjob: true });
                //0. create notificationlog for user
                //1. flow group
                //2. flow user
                var notificationtype = await strapi.query('notificationtypes').findOne({
                    notificationcode: '3001'
                });

                if (element.customertype === strapi.config.constants.pushnotification_customertype.personal) {
                    for (let j = 0; index < element.users.length; j++) {
                        const elementUsers = element.users[j];
                        await strapi.services.pushnotificationmanage.createloganđataforpush(elementUsers, element, notificationtype);
                    }
                }

                if (element.customertype === strapi.config.constants.pushnotification_customertype.groupcustomer) {
                    for (let index = 0; index < element.groupcustomers.length; index++) {
                        const elementGroup = element.groupcustomers[index];
                        //groupcustomer
                        var arrayUserPush = [];
                        var objGroupCustomer = await strapi.query('groupcustomer').findOne({ id: elementGroup.id });

                        for (let i = 0; i < objGroupCustomer.users.length; i++) {
                            const elementUsers = objGroupCustomer.users[i];
                            let checkUserOfData = arrayUserPush.filter(s => s.id == elementUsers.id);
                            if (checkUserOfData.length == 0) {
                                arrayUserPush.push(elementUsers);
                            }
                        }


                        for (let i = 0; i < arrayUserPush.length; i++) {
                            const elementUsers = arrayUserPush[i];
                            await strapi.services.pushnotificationmanage.createloganđataforpush(elementUsers, element, notificationtype);
                        }
                    }
                }

                if (element.customertype === strapi.config.constants.pushnotification_customertype.allcustomer) {
                    var allUser = await strapi.query('user', 'users-permissions').find()
                    for (let index = 0; index < allUser.length; index++) {
                        const elementUsers = allUser[index];
                        await strapi.services.pushnotificationmanage.createloganđataforpush(elementUsers, element, notificationtype);
                    }
                }

            }
        }


    },
    '*/10 * * * * *': async() => {
        //send notification firebase
        //10s run
        //for notification
        var dataQuery = {
            isrunjob: false,
            _limit: 2,
            _sort: "id:asc",
        };

        var cointransaction = await strapi.query('pushnotificationfirebaselog').find(dataQuery);

        //
        if (cointransaction && cointransaction.length > 0) {
            for (let index = 0; index < cointransaction.length; index++) {
                const elementNotiLog = cointransaction[index];
                await strapi.query('pushnotificationfirebaselog').update({ id: elementNotiLog.id }, { isrunjob: true });
                //Lay thong tin cua bang notificationLog 
                var dataNotiticationLog = await strapi.query('notificationlog').findOne({ id: elementNotiLog.notificationlogid });
                var newcontentforPushFirebase = removeAuthorFields(dataNotiticationLog);
                var arraydeviceregios = [];
                arraydeviceregios.push(elementNotiLog.deviceregid);
                var dataReturn = '';
                if (elementNotiLog.platform == 'ios') {
                    dataReturn = await strapi.services.firebasecontrol.sendtoarraydeviceios(arraydeviceregios, elementNotiLog.notititle, newcontentforPushFirebase);
                }
                if (elementNotiLog.platform == 'android') {

                    dataReturn = await strapi.services.firebasecontrol.sendtoarraydeviceandroid(arraydeviceregios, elementNotiLog.notititle, newcontentforPushFirebase);
                }

                if (!_.isNil(dataReturn) && dataReturn != '') {
                    //console.log(dataReturn);
                    var status = 0;
                    if (dataReturn.responsefilebase.success && dataReturn.responsefilebase.success == 1) {
                        status = 5;
                    } else {
                        status = 6;
                    }
                    await strapi.query('pushnotificationfirebaselog').update({ id: elementNotiLog.id }, { datasend: JSON.stringify(dataReturn.data), resultoffirebase: JSON.stringify(dataReturn.responsefilebase), statusoffirebase: status });

                    if (status == 6) {
                        //delete in 
                        await strapi.query("deviceinfo").delete({
                            devicereg: elementNotiLog.deviceregid
                        });
                    }
                }
            }
        }

    }
};