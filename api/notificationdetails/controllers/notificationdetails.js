'use strict';
const { sanitizeEntity } = require('strapi-utils');
const _ = require('lodash');
const axios = require('axios');

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */
const removeAuthorFields = (entity) => {
    const sanitizedValue = _.omit(entity, ['created_by', 'updated_by', 'user', 'formats', ]);
    _.forEach(sanitizedValue, (value, key) => {
        if (_.isArray(value)) {
            sanitizedValue[key] = value.map(removeAuthorFields);
        } else if (_.isObject(value)) {
            if (key == 'created_at' || key == 'updated_at') {
                if (new Date(value) !== "Invalid Date" && !isNaN(new Date(value))) {
                    if (value == new Date(value).toISOString()) {
                        sanitizedValue[key] = value;
                    }
                }

            } else {
                sanitizedValue[key] = removeAuthorFields(value);
            }
        }
    });

    return sanitizedValue;
};


const formatError = error => [
    { messages: [{ id: error.id, message: error.message, field: error.field }] },
];

module.exports = {
    getnotificationtype: async ctx => {
        //get in table type
        //
        var dataresult = await strapi.query('notificationtypes').find({ systemstatu: 3 });
        let data = Object.values(removeAuthorFields(dataresult));
        ctx.send(data);
    },
    getnotificationbyuser: async ctx => {
        if (ctx.request && ctx.request.header && ctx.request.header.authorization) {
            const { id, isAdmin = false } = await strapi.plugins[
                'users-permissions'
            ].services.jwt.getToken(ctx);
            var user = await strapi.query('user', 'users-permissions').findOne({
                id: id
            });
            if (user == null) {
                return ctx.badRequest(
                    null,
                    formatError({
                        id: 'mobile_user.updatemypassword.error.jwt.invalidate',
                        message: 'User information is not validated.',
                    })
                );
            } else {
                //get in table logs
                var dataresult = await strapi.query('notificationlog').find({ user: user.id, _sort: 'created_at:desc' });
                var dataresultnew = await strapi.query('notificationlog').model.query(function(qb) {
                    qb.where(function() {
                        this.where('user', user.id);
                    });
                    qb.orderBy('created_at', 'DESC');
                }).fetchAll();

                dataresultnew = dataresultnew.toJSON();
                //console.log(dataresultnew);
                var data = Object.values(removeAuthorFields(dataresultnew));
                ctx.send(data);
            }
        }
    },
    getnotificationbytype: async ctx => {
        //get in table type
        //
        if (ctx.request && ctx.request.header && ctx.request.header.authorization) {
            const { id, isAdmin = false } = await strapi.plugins[
                'users-permissions'
            ].services.jwt.getToken(ctx);
            var user = await strapi.query('user', 'users-permissions').findOne({
                id: id
            });
            if (user == null) {
                return ctx.badRequest(
                    null,
                    formatError({
                        id: 'mobile_user.updatemypassword.error.jwt.invalidate',
                        message: 'User information is not validated.',
                    })
                );
            } else {
                //get in table logs
                const params = _.assign({}, ctx.request.body, ctx.params);
                let noticetypeid = params.noticetypeid;
                var dataresult = await strapi.query('notificationlog').find({ user: user.id, noticetypeid: noticetypeid, _sort: 'created_at:desc' });
                let data = Object.values(removeAuthorFields(dataresult));
                ctx.send(data);
            }
        }
    },
    deletenotificationbyuser: async ctx => {
        //get in table type
        //
        if (ctx.request && ctx.request.header && ctx.request.header.authorization) {
            const { id, isAdmin = false } = await strapi.plugins[
                'users-permissions'
            ].services.jwt.getToken(ctx);
            var user = await strapi.query('user', 'users-permissions').findOne({
                id: id
            });
            if (user == null) {
                return ctx.badRequest(
                    null,
                    formatError({
                        id: 'mobile_user.updatemypassword.error.jwt.invalidate',
                        message: 'User information is not validated.',
                    })
                );
            } else {
                //get in table logs
                const params = _.assign({}, ctx.request.body, ctx.params);
                let noticeid = params.noticeid;
                var dataresult = await strapi.query('notificationlog').findOne({ user: user.id, id: noticeid, _sort: 'created_at:desc' });
                if (dataresult != null) {
                    await strapi.query('notificationlog').delete({ id: noticeid });
                    ctx.send({
                        statusCode: 0,
                        error: 'success',
                        message: formatError({
                            id: 'success',
                            message: 'Delete notification success',
                            field: 'deletenotificationbyuser'
                        }),
                    });
                } else {
                    return ctx.badRequest(
                        null,
                        formatError({
                            id: 'deletenotificationbyuser.error',
                            message: 'Notification is not match.',
                        })
                    );
                }
            }
        }
    },
    pushnotificationtest: async ctx => {
        //get in table type
        //
        if (ctx.request && ctx.request.header && ctx.request.header.authorization) {
            const { id, isAdmin = false } = await strapi.plugins[
                'users-permissions'
            ].services.jwt.getToken(ctx);
            var user = await strapi.query('user', 'users-permissions').findOne({
                id: id
            });
            if (user == null) {
                return ctx.badRequest(
                    null,
                    formatError({
                        id: 'mobile_user.updatemypassword.error.jwt.invalidate',
                        message: 'User information is not validated.',
                    })
                );
            } else {
                //push notification test
                const params = _.assign({}, ctx.request.body, ctx.params);
                let deviveregid = params.deviveregid;
                let arraydevicereg = [];
                arraydevicereg.push(deviveregid);
                var dataReturn = "";
                let dataContent = {
                        "title": "hello. this is title demo",
                        "url": "",
                        "content": "this is content demo"
                    }
                    //send one device
                dataReturn = await strapi.services.firebasecontrol.sendtoonedevice(deviveregid, 'android', 'hello. this is title demo', 1001, dataContent);
                //send multi device
                //dataReturn = await strapi.services.firebasecontrol.sendtoarraydevice(arraydevicereg, 'android', 'hello. this is title demo', 1001, dataContent);
                //add to topic subscribetotopic
                //dataReturn = await strapi.services.firebasecontrol.subscribetotopic('/topics/alldevice', arraydevicereg);
                //Send to topic
                //dataReturn = await strapi.services.firebasecontrol.sendtotopic('/topics/alldevice', 'android', 'hello. this is title demo', 1001, dataContent);
                //send message to topic
                ctx.send(dataReturn);

            }
        }
    }
};