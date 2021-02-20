'use strict';

/**
 * mobile-user.js controller
 *
 * @description: A set of functions called "actions" for managing Mobile User.
 */
const uuid = require('uuid');
/* eslint-disable no-useless-escape */
const crypto = require('crypto');
const _ = require('lodash');
const grant = require('grant-koa');
const { sanitizeEntity } = require('strapi-utils');
const sgMail = require('@sendgrid/mail');

const emailRegExp = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
const formatError = error => [
    { messages: [{ id: error.id, message: error.message, field: error.field }] },
];

const removeAuthorFields = (entity) => {
    const sanitizedValue = _.omit(entity, ['created_by', 'updated_by', 'created_at', 'updated_at', 'formats',
        'deviceinfos', 'transaction_histories', 'outlets', 'role', 'provider', 'confirmed',
        'product_ratings'
    ]);
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
    //Test
    test: async ctx => {
        ctx.send('Hello World!');
    },
    getnearme: async ctx => {
        /*
        const { name } = ctx.request.body; 
        const { address } = ctx.request.body; 
        console.log(name);
        console.log(address);
          ctx.send(name);
        */
        const { id } = ctx.params;
        const { name } = ctx.params;
        ctx.send(name);
    },
    //Demo Function
    demo: async ctx => {
        //https://stackoverflow.com/questions/62631528/how-to-update-user-in-strapi
        //query with model containt '-' 
        const entity = await strapi.query('test-display').create(ctx.request.body);
        return sanitizeEntity(entity, { model: strapi.query('test-display').model });
    },
    //CheckPhoneNo
    checkPhoneNo: async ctx => {
        //input: phone
        //check if this phone is exit
        //or is block 24h
        const { phone } = ctx.request.body;
        var phone_fix = phone.replace("+", "");
        const checkphoneno = await strapi.query('phone-block').find({ phone: phone_fix, _sort: 'endtime:desc' });
        if (!_.isEmpty(checkphoneno) && checkphoneno[0].phone === phone_fix) {
            const now = new Date;
            var utc_timestamp_block = Date.parse(checkphoneno[0].endtime);

            //check if in valid in 24h 
            var utc_timestamp = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(),
                now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
            if (utc_timestamp_block > utc_timestamp) {
                return ctx.badRequest(
                    null,
                    formatError({
                        id: 'mobile_user.register.check-phone-no-blocked',
                        message: 'This phone number is blocked. Please wait 24h to register with this Phone number',
                    })
                );
            }
        }

        const checkuser = await strapi.query('user', 'users-permissions').findOne({
            phone: phone_fix
        });
        if (!_.isEmpty(checkuser) && checkuser.phone === phone_fix) {

            return ctx.badRequest(
                null,
                formatError({
                    id: 'mobile_user.register.check-phone-no',
                    message: 'This Phone number is used. Please user another Phone Number.',
                })
            );
        }
        ctx.send({
            statusCode: 0,
            error: 'none',
            message: formatError({
                id: 'success',
                message: 'success',
            }),
        });
    },
    //CheckEmailAdress
    checkEmailAdrress: async ctx => {
        //input: email
        //check if this email is exit
        var { email } = ctx.request.body;
        if (!email) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'mobile_user.register.error.email.provide',
                    message: 'Please provide your email.',
                })
            );
        }
        // Check if the provided email is valid or not.
        const isEmail = emailRegExp.test(email);

        if (isEmail) {
            email = email.toLowerCase();
        } else {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'mobile_user.register.error.email.format',
                    message: 'Please provide valid email address.',
                })
            );
        }

        const checkuser = await strapi.query('user', 'users-permissions').findOne({
            email: email
        });
        if (!_.isEmpty(checkuser) && checkuser.email === email) {

            return ctx.badRequest(
                null,
                formatError({
                    id: 'mobile_user.register.check-email-address',
                    message: 'This Email is used. Please user another Email.',
                })
            );
        }
        ctx.send({
            statusCode: 0,
            error: 'none',
            message: formatError({
                id: 'success',
                message: 'success',
            }),
        });
    },
    //addPhoneNoBlock
    addPhoneNoBlock: async ctx => {
        //input: phone
        //add phone to block list
        const { phone } = ctx.request.body;
        var phone_fix = phone.replace("+", "");
        const checkphoneno = await strapi.query('phone-block').find({ phone: phone_fix, _sort: 'endtime:desc' });

        if (!_.isEmpty(checkphoneno) && checkphoneno[0].phone === phone_fix) {
            const now = new Date;
            var utc_timestamp_block = Date.parse(checkphoneno[0].endtime);

            //check if in valid in 24h 
            var utc_timestamp = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(),
                now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
            if (utc_timestamp_block > utc_timestamp) {
                return ctx.badRequest(
                    null,
                    formatError({
                        id: 'mobile_user.register.check-phone-no-blocked',
                        message: 'This phone number is blocked. Please wait 24h to register with this Phone number',
                    })
                );
            }
        }

        const checkuser = await strapi.query('user', 'users-permissions').findOne({
            phone: phone_fix
        });
        if (!_.isEmpty(checkuser) && checkuser.phone === phone_fix) {

            return ctx.badRequest(
                null,
                formatError({
                    id: 'mobile_user.register.check-phone-no',
                    message: 'This Phone number is used. Please user another Phone Number.',
                })
            );
        }
        //insert new phone block here
        var startDate = new Date;
        var endDate = new Date(startDate.getTime() + 86400000);
        var utc_timestamp_block_start = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate(),
            startDate.getUTCHours(), startDate.getUTCMinutes(), startDate.getUTCSeconds(), startDate.getUTCMilliseconds());

        var utc_timestamp_block_end = Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate(),
            endDate.getUTCHours(), endDate.getUTCMinutes(), endDate.getUTCSeconds(), endDate.getUTCMilliseconds());

        const newblockphone = await strapi.query('phone-block').create({
            phone: phone_fix,
            starttime: utc_timestamp_block_start,
            endtime: utc_timestamp_block_end
        });
        ctx.send({
            statusCode: 0,
            error: 'none',
            message: formatError({
                id: 'success',
                message: 'success',
            }),
            content_object: newblockphone,
        });
    },


    //register new user
    async register(ctx) {
        //input: username
        //input: email
        //input: password
        //input: phone
        //input: firstname
        //input: lastname
        //input: gender
        //input: dateofbirth
        //input: ethnicgroup
        //input: deviceid ; optional
        const pluginStore = await strapi.store({
            environment: '',
            type: 'plugin',
            name: 'users-permissions',
        });

        const settings = await pluginStore.get({
            key: 'advanced',
        });

        if (!settings.allow_register) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'mobile_user.advanced.allow_register',
                    message: 'Register action is currently disabled.',
                })
            );
        }

        const params = {
            ..._.omit(ctx.request.body, ['confirmed', 'resetPasswordToken']),
            provider: 'local',
        };
        //fix and validate input data here
        const { phone } = ctx.request.body;
        var phone_fix = phone.replace("+", "");
        params.phone = phone_fix;

        const { username } = ctx.request.body;
        if (username == null || username == '') {
            params.username = params.email;
        }
        // Password is required.
        if (!params.password) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'mobile_user.register.error.password.provide',
                    message: 'Please provide your password.',
                })
            );
        }

        // Email is required.
        if (!params.email) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'mobile_user.register.error.email.provide',
                    message: 'Please provide your email.',
                })
            );
        }
        // Throw an error if the password selected by the user
        // contains more than two times the symbol '$'.
        if (strapi.plugins['users-permissions'].services.user.isHashed(params.password)) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'mobile_user.register.error.password.format',
                    message: 'Your password cannot contain more than three times the symbol `$`.',
                })
            );
        }

        const role = await strapi
            .query('role', 'users-permissions')
            .findOne({ type: settings.default_role }, []);

        if (!role) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'mobile_user.register.error.role.notFound',
                    message: 'Impossible to find the default role.',
                })
            );
        }

        // Check if the provided email is valid or not.
        const isEmail = emailRegExp.test(params.email);

        if (isEmail) {
            params.email = params.email.toLowerCase();
        } else {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'mobile_user.register.error.email.format',
                    message: 'Please provide valid email address.',
                })
            );
        }


        const options = { length: 12 };
        const { default: ShortUniqueId } = require('short-unique-id');
        var uid = new ShortUniqueId(options);
        params.referralcode = uid();

        //fix for role id
        params.role = 3;
        params.password = await strapi.plugins['users-permissions'].services.user.hashPassword(params);

        const user = await strapi.query('user', 'users-permissions').findOne({
            email: params.email,
        });

        if (user && user.provider === params.provider) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'mobile_user.register.error.email.taken',
                    message: 'Email is already taken.',
                })
            );
        }

        if (user && user.provider !== params.provider && settings.unique_email) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'mobile_user.register.error.email.taken',
                    message: 'Email is already taken 2.',
                })
            );
        }

        try {

            if (!settings.email_confirmation) {
                params.confirmed = true;
            }
            params.qrcode = uuid();

            //friend code
            var userfriend = null;
            if (params.friendcode != null && params.friendcode.length > 0) {
                userfriend = await strapi.query('user', 'users-permissions').findOne({
                    referralcode: params.friendcode
                });
                if (userfriend === null) {
                    params.friendcode = null;
                }
            }

            const user = await strapi.query('user', 'users-permissions').create(params);

            //Add coin for friend
            if (userfriend != null) {
                //1. get transaction config
                var transactionconfig = await strapi.query('transaction-config').findOne({
                    trxconfigid: '005'
                });
                if (transactionconfig == null) {
                    return ctx.badRequest(
                        null,
                        formatError({
                            id: 'mobile_user.change-information.error.transaction-config.invalidate',
                            message: 'Transaction config is not exit.',
                        })
                    );
                }
                var transactionhistorycheck = await strapi.query('transaction-history').findOne({
                    trxconfigid: transactionconfig.trxconfigid,
                    mobileuserid: userfriend.id,
                    transactionamount: 0
                });

                //check if had add then do not add anymore
                if (transactionhistorycheck == null) {
                    //2. insert transaction config
                    var startDate = new Date;
                    var endDate = new Date(startDate.getTime() + 86400000);
                    if (transactionconfig.isexpired == true) {
                        var expiredDate = new Date(startDate.getTime() + transactionconfig.dayeffective * 86400000);
                    }
                    var utc_timestamp_end = Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate(),
                        endDate.getUTCHours(), endDate.getUTCMinutes(), endDate.getUTCSeconds(), endDate.getUTCMilliseconds());

                    var newlog = await strapi.query('transaction-history').create({
                        trxconfigid: transactionconfig.trxconfigid,
                        createddate: startDate,
                        //expireddate: expiredDate,
                        availabledate: utc_timestamp_end,
                        creditamount: transactionconfig.amount,
                        debitamount: 0,
                        user: userfriend,
                        transactionamount: 0,
                        taxno: '',
                        transactionno: uuid(),
                        outletid: 0,
                        status: 'complete',
                        mobileuserid: userfriend.id,
                        remark: transactionconfig.trxdescription
                    });
                    //3. update mobileusercoinaccount
                    var mycoinaccount = await strapi.query('mobileusercoinaccount').findOne({
                        mobileuserid: userfriend.id
                    });
                    if (mycoinaccount) {
                        mycoinaccount.balance = mycoinaccount.balance + transactionconfig.amount;
                        strapi.query('mobileusercoinaccount').update({ mobileuserid: userfriend.id },
                            mycoinaccount
                        );
                    } else {
                        var createddatedfull = new Date;
                        //create mobileusercoinaccount if not exit
                        var newmycoinaccount = await strapi.query('mobileusercoinaccount').create({
                            mobileuserid: userfriend.id,
                            balance: transactionconfig.amount,
                            totalcredit: 0,
                            totaldebit: 0,
                            totalexpried: 0,
                            modifieddate: createddatedfull
                        });
                    }
                }
            }

            const jwt = strapi.plugins['users-permissions'].services.jwt.issue(
                _.pick(user.toJSON ? user.toJSON() : user, ['id'])
            );
            //disable email confirm
            if (settings.email_confirmation) {
                const settings = await pluginStore.get({ key: 'email' }).then(storeEmail => {
                    try {
                        return storeEmail['email_confirmation'].options;
                    } catch (error) {
                        return {};
                    }
                });

                settings.message = await strapi.plugins[
                    'users-permissions'
                ].services.userspermissions.template(settings.message, {
                    URL: `${strapi.config.server.url}/mobile_user/email-confirmation`,
                    USER: _.omit(user.toJSON ? user.toJSON() : user, [
                        'password',
                        'resetPasswordToken',
                        'role',
                        'provider',
                    ]),
                    CODE: jwt,
                });

                settings.object = await strapi.plugins[
                    'users-permissions'
                ].services.userspermissions.template(settings.object, {
                    USER: _.omit(user.toJSON ? user.toJSON() : user, [
                        'password',
                        'resetPasswordToken',
                        'role',
                        'provider',
                    ]),
                });

                try {
                    // Send an email to the user.
                    await strapi.plugins['email'].services.email.send({
                        to: (user.toJSON ? user.toJSON() : user).email,
                        from: settings.from.email && settings.from.name ?
                            `${settings.from.name} <${settings.from.email}>` : undefined,
                        replyTo: settings.response_email,
                        subject: settings.object,
                        text: settings.message,
                        html: settings.message,
                    });
                } catch (err) {
                    return ctx.badRequest(null, err);
                }
            }

            const sanitizedUser = sanitizeEntity(user.toJSON ? user.toJSON() : user, {
                model: strapi.query('user', 'users-permissions').model,
            });

            var checkDeviceReg = params.devicereg;
            if (checkDeviceReg != null && checkDeviceReg != '') {
                //check and update deviceinfo
                var checkDeviceinfo = await strapi
                    .query('deviceinfo')
                    .findOne({ devicereg: params.devicereg });
                if (checkDeviceinfo == null) {
                    const newDeviceinfo = await strapi.query('deviceinfo').create({
                        devicename: params.devicename,
                        serial: params.serial,
                        devicerid: params.devicerid,
                        devicereg: params.devicereg,
                        imei: params.imei,
                        platform: params.platform,
                        user: user
                    });
                } else {
                    if (checkDeviceinfo.devicename !== params.devicename) {
                        checkDeviceinfo.devicename = params.devicename;
                    }
                    if (checkDeviceinfo.serial !== params.serial) {
                        checkDeviceinfo.serial = params.serial;
                    }
                    if (checkDeviceinfo.devicerid !== params.devicerid) {
                        checkDeviceinfo.devicerid = params.devicerid;
                    }
                    if (checkDeviceinfo.imei !== params.imei) {
                        checkDeviceinfo.imei = params.imei;
                    }
                    const updateDeviceinfo = await strapi.query('deviceinfo').update({ id: checkDeviceinfo.id }, {
                        devicename: checkDeviceinfo.devicename,
                        serial: checkDeviceinfo.serial,
                        devicerid: checkDeviceinfo.devicerid,
                        imei: checkDeviceinfo.imei,
                        platform: params.platform,
                        user: user
                    });
                }
            }

            if (settings.email_confirmation) {
                ctx.send({
                    user: sanitizedUser,
                });
            } else {
                ctx.send({
                    jwt,
                    user: sanitizedUser,
                });
            }
        } catch (err) {
            const adminError = _.includes(err.message, 'username') ? {
                id: 'mobile_user.form.error.username.taken',
                message: 'Username already taken',
            } : { id: 'mobile_user.register.error.email.taken', message: 'Email already taken 3.' };

            ctx.badRequest(null, formatError(adminError));
        }
    },
    //login
    async login(ctx) {
        //input: identifier(phone, email, username)
        //input: password
        //input: devicename;  optional
        //input: serial;      optional
        //input: devicerid;   optional
        //input: devicereg(generate from firebase)
        const provider = ctx.params.provider || 'local';
        const params = ctx.request.body;
        console.log(params);
        const store = await strapi.store({
            environment: '',
            type: 'plugin',
            name: 'users-permissions',
        });

        if (provider === 'local') {
            if (!_.get(await store.get({ key: 'grant' }), 'email.enabled')) {
                return ctx.badRequest(null, 'This provider is disabled.');
            }

            // The identifier is required.
            if (!params.identifier) {
                return ctx.badRequest(
                    null,
                    formatError({
                        id: 'mobile_user.login.error.email.provide',
                        message: 'Please provide your username or your e-mail.',
                    })
                );
            }

            // The password is required.
            if (!params.password) {
                return ctx.badRequest(
                    null,
                    formatError({
                        id: 'mobile_user.login.error.password.provide',
                        message: 'Please provide your password.',
                    })
                );
            }

            if (!params.devicereg) {
                return ctx.badRequest(
                    null,
                    formatError({
                        id: 'mobile_user.login.error.devicereg.provide',
                        message: 'Please provide devicereg from firebase.',
                    })
                );
            }

            const query = { provider };
            const querybyphone = { provider };
            querybyphone.phone = params.identifier.replace("+", "");
            // Check if the provided identifier is an email or not.
            const isEmail = emailRegExp.test(params.identifier);

            // Set the identifier to the appropriate query field.
            if (isEmail) {
                query.email = params.identifier.toLowerCase();
            } else {
                query.username = params.identifier;
            }

            // Check if the user exists.
            var user = await strapi.query('user', 'users-permissions').findOne(query);
            var userbyphone = await strapi.query('user', 'users-permissions').findOne(querybyphone);
            if (user == null && userbyphone != null) {
                user = userbyphone;
            } else {
                if (!user) {
                    return ctx.badRequest(
                        null,
                        formatError({
                            id: 'mobile_user.login.error.invalid',
                            message: 'Identifier or password invalid.',
                        })
                    );
                }
            }


            if (
                _.get(await store.get({ key: 'advanced' }), 'email_confirmation') &&
                user.confirmed !== true
            ) {
                return ctx.badRequest(
                    null,
                    formatError({
                        id: 'mobile_user.login.error.confirmed',
                        message: 'Your account email is not confirmed',
                    })
                );
            }

            if (user.blocked === true) {
                return ctx.badRequest(
                    null,
                    formatError({
                        id: 'mobile_user.login.error.blocked',
                        message: 'Your account has been blocked by an administrator',
                    })
                );
            }

            // The user never authenticated with the `local` provider.
            if (!user.password) {
                return ctx.badRequest(
                    null,
                    formatError({
                        id: 'mobile_user.login.error.password.local',
                        message: 'This user never set a local password, please login with the provider used during account creation.',
                    })
                );
            }

            const validPassword = strapi.plugins['users-permissions'].services.user.validatePassword(
                params.password,
                user.password
            );

            if (!validPassword) {
                return ctx.badRequest(
                    null,
                    formatError({
                        id: 'mobile_user.login.error.invalid',
                        message: 'Identifier or password invalid.',
                    })
                );
            } else {
                //add field to Deviceinfo
                var checkDeviceReg = params.devicereg;
                if (checkDeviceReg != null && checkDeviceReg != '') {
                    //check and update deviceinfo
                    var checkDeviceinfo = await strapi
                        .query('deviceinfo')
                        .findOne({ devicereg: params.devicereg });
                    if (checkDeviceinfo == null) {
                        const newDeviceinfo = await strapi.query('deviceinfo').create({
                            devicename: params.devicename,
                            serial: params.serial,
                            devicerid: params.devicerid,
                            devicereg: params.devicereg,
                            imei: params.imei,
                            platform: params.platform,
                            user: user
                        });
                    } else {
                        if (checkDeviceinfo.devicename !== params.devicename) {
                            checkDeviceinfo.devicename = params.devicename;
                        }
                        if (checkDeviceinfo.serial !== params.serial) {
                            checkDeviceinfo.serial = params.serial;
                        }
                        if (checkDeviceinfo.devicerid !== params.devicerid) {
                            checkDeviceinfo.devicerid = params.devicerid;
                        }
                        if (checkDeviceinfo.imei !== params.imei) {
                            checkDeviceinfo.imei = params.imei;
                        }
                        const updateDeviceinfo = await strapi.query('deviceinfo').update({ id: checkDeviceinfo.id }, {
                            devicename: checkDeviceinfo.devicename,
                            serial: checkDeviceinfo.serial,
                            devicerid: checkDeviceinfo.devicerid,
                            imei: checkDeviceinfo.imei,
                            platform: params.platform,
                            user: user
                        });
                    }
                }
                ctx.send({
                    jwt: strapi.plugins['users-permissions'].services.jwt.issue({
                        id: user.id,
                    }),
                    user: removeAuthorFields(sanitizeEntity(user.toJSON ? user.toJSON() : user, {
                        model: strapi.query('user', 'users-permissions').model,
                    })),
                });
            }
        } else {
            if (!_.get(await store.get({ key: 'grant' }), [provider, 'enabled'])) {
                return ctx.badRequest(
                    null,
                    formatError({
                        id: 'provider.disabled',
                        message: 'This provider is disabled.',
                    })
                );
            }

            // Connect the user with the third-party provider.
            let user, error;
            try {
                [user, error] = await strapi.plugins['users-permissions'].services.providers.connect(
                    provider,
                    ctx.query
                );
            } catch ([user, error]) {
                return ctx.badRequest(null, error === 'array' ? error[0] : error);
            }

            if (!user) {
                return ctx.badRequest(null, error === 'array' ? error[0] : error);
            }


            ctx.send({
                jwt: strapi.plugins['users-permissions'].services.jwt.issue({
                    id: user.id,
                }),
                user: removeAuthorFields(sanitizeEntity(user.toJSON ? user.toJSON() : user, {
                    model: strapi.query('user', 'users-permissions').model,
                })),
            });
        }
    },
    //================>Forgot password
    async forgotPassword(ctx) {
        //input: email
        let { email } = ctx.request.body;
        // Check if the provided email is valid or not.
        const isEmail = emailRegExp.test(email);
        if (isEmail) {
            email = email.toLowerCase();
        } else {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'mobile_user.forgot_password.error.email.format',
                    message: 'Please provide valid email address.',
                })
            );
        }

        const pluginStore = await strapi.store({
            environment: '',
            type: 'plugin',
            name: 'users-permissions',
        });

        // Find the user by email.
        const user = await strapi.query('user', 'users-permissions').findOne({ email });
        // User not found.
        if (!user || user == null) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'mobile_user.forgot_password.error.user.not-exist',
                    message: 'This email does not exist.',
                })
            );
        }

        // Generate random token.
        //const resetPasswordToken = crypto.randomBytes(64).toString('hex');
        const resetPasswordToken = Math.floor(100000 + Math.random() * 900000);

        let dataquery = { name_eq: 'SMSFORGOTPASSWORD', _sort: 'id:desc' };
        let smstypeData = await strapi.services.smstype.find(dataquery);
        let contentSendEmail = smstypeData[0].template.replace('{CODE}', resetPasswordToken);

        const settings = await pluginStore.get({ key: 'email' }).then(storeEmail => {
            try {
                return storeEmail['reset_password'].options;
            } catch (error) {
                return {};
            }
        });

        const advanced = await pluginStore.get({
            key: 'advanced',
        });

        const userInfo = _.omit(user, ['password', 'resetPasswordToken', 'role', 'provider']);

        settings.message = await strapi.plugins['users-permissions'].services.userspermissions.template(
            settings.message, {
                URL: advanced.email_reset_password,
                USER: userInfo,
                TOKEN: resetPasswordToken,
            }
        );

        settings.object = await strapi.plugins['users-permissions'].services.userspermissions.template(
            settings.object, {
                USER: userInfo,
            }
        );

        try {
            // Send an email to the user.
            sgMail.setApiKey('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');
            const msg = {
                to: user.email,
                from: 'kkmart02@gmail.com',
                subject: settings.object,
                text: contentSendEmail,
                html: contentSendEmail,
            };
            sgMail.send(msg);
        } catch (err) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'mobile_user.forgot_password.error.email.can-not-send',
                    message: 'Can not send email.',
                })
            );
        }
        // Update the user.
        await strapi.query('user', 'users-permissions').update({ id: user.id }, { resetPasswordToken });
        ctx.send({
            statusCode: 0,
            error: 'none',
            message: formatError({
                id: 'success',
                message: 'success',
            }),
        });
    },
    //<================Forgot password
    //================>Reset password
    async resetPassword(ctx) {
        //input: email
        //input: password
        //input: passwordconfirmation
        //input: code
        const params = _.assign({}, ctx.request.body, ctx.params);

        if (
            params.email &&
            params.password &&
            params.passwordconfirmation &&
            params.password === params.passwordconfirmation &&
            params.code
        ) {
            const user = await strapi
                .query('user', 'users-permissions')
                .findOne({ resetPasswordToken: `${params.code}` });

            if (!user) {
                return ctx.badRequest(
                    null,
                    formatError({
                        id: 'mobile-user.reset-password.error.code.provide',
                        message: 'Incorrect code provided.',
                    })
                );
            }

            const password = await strapi.plugins['users-permissions'].services.user.hashPassword({
                password: params.password,
            });

            // Update the user.
            await strapi
                .query('user', 'users-permissions')
                .update({ id: user.id }, { resetPasswordToken: null, password });

            ctx.send({
                statusCode: 0,
                error: 'success',
                message: formatError({
                    id: 'success',
                    message: 'Update new password success',
                    field: 'mobile-user.updatenewpassword'
                }),
            });

        } else if (
            params.email &&
            params.password &&
            params.passwordconfirmation &&
            params.password !== params.passwordconfirmation
        ) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'mobile-user.reset-password.error.password.matching',
                    message: 'Passwords do not match.',
                })
            );
        } else {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'mobile-user.reset-password.error.params.provide',
                    message: 'Incorrect params provided.',
                })
            );
        }
    },
    //<================Reset password
    //================>Change Information
    async changeInformation(ctx) {
        //input: user information
        //input: iscompleteinformation
        const params = _.assign({}, ctx.request.body, ctx.params);
        var user = await strapi.query('user', 'users-permissions').findOne({
            email: params.email
        });
        if (user == null) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'mobile_user.change-information.error.email.invalidate',
                    message: 'User information is not validated.',
                })
            );
        }
        if (user.firstname !== params.firstname) {
            user.firstname = params.firstname;
        }
        if (user.lastname !== params.lastname) {
            user.lastname = params.lastname;
        }
        //format from data input dd-MMM-yyyy to iso type
        if (user.dateofbirth !== params.dateofbirth && params.dateofbirth != null) {
            var fortmateddate = new Date(params.dateofbirth).toISOString();
            user.dateofbirth = fortmateddate;
        }
        if (user.gender !== params.gender) {
            user.gender = params.gender;
        }
        if (user.maritalstatus !== params.maritalstatus) {
            user.maritalstatus = params.maritalstatus;
        }
        if (user.referralcode !== params.referralcode) {
            user.referralcode = params.referralcode;
        }
        if (user.companyname !== params.companyname) {
            user.companyname = params.companyname;
        }
        if (user.address1 !== params.address1) {
            user.address1 = params.address1;
        }
        if (user.address2 !== params.address2) {
            user.address2 = params.address2;
        }
        if (user.country !== params.country) {
            user.country = params.country;
        }
        if (user.state !== params.state) {
            user.state = params.state;
        }
        if (user.city !== params.city) {
            user.city = params.city;
        }
        if (user.postcode !== params.postcode) {
            user.postcode = params.postcode;
        }
        if (user.ethnicgroup !== params.ethnicgroup) {
            user.ethnicgroup = params.ethnicgroup;
        }
        if (user.personalinterests !== params.personalinterests) {
            user.personalinterests = params.personalinterests;
        }
        if (user.maritalstatuother !== params.maritalstatuother) {
            user.maritalstatuother = params.maritalstatuother;
        }
        if (user.personalinterestother !== params.personalinterestother) {
            user.personalinterestother = params.personalinterestother;
        }
        if (user.employmentstatuother !== params.employmentstatuother) {
            user.employmentstatuother = params.employmentstatuother;
        }
        if (user.socialmediaactivestatuother !== params.socialmediaactivestatuother) {
            user.socialmediaactivestatuother = params.socialmediaactivestatuother;
        }
        if (user.membershiptype !== params.membershiptype) {
            user.membershiptype = params.membershiptype;
        }
        if (user.membershiptype !== params.membershiptype) {
            user.membershiptype = params.membershiptype;
        }
        if (user.maritalstatus !== params.maritalstatus) {
            user.maritalstatus = params.maritalstatus;
        }
        if (user.personalinterests !== params.personalinterests) {
            user.personalinterests = params.personalinterests;
        }
        if (user.personalinterests !== params.personalinterests) {
            user.personalinterests = params.personalinterests;
        }
        if (user.employmentstatus !== params.employmentstatus) {
            user.employmentstatus = params.employmentstatus;
        }
        if (user.socialmediaactivestatus !== params.socialmediaactivestatus) {
            user.socialmediaactivestatus = params.socialmediaactivestatus;
        }
        if (user.photo !== params.photo) {
            user.photo = params.photo;
        }
        if (user.friendcode === null && user.friendcode !== params.friendcode) {

            var userfriend = await strapi.query('user', 'users-permissions').findOne({
                referralcode: params.friendcode
            });
            //add coin friend in here
            //0. get user by friend code

            if (userfriend != null) {

                user.friendcode = params.friendcode;
                //1. get transaction config
                var transactionconfig = await strapi.query('transaction-config').findOne({
                    trxconfigid: '005'
                });
                if (transactionconfig == null) {
                    return ctx.badRequest(
                        null,
                        formatError({
                            id: 'mobile_user.change-information.error.transaction-config.invalidate',
                            message: 'Transaction config is not exit.',
                        })
                    );
                }
                var transactionhistorycheck = await strapi.query('transaction-history').findOne({
                    trxconfigid: transactionconfig.trxconfigid,
                    mobileuserid: userfriend.id,
                    transactionamount: 0
                });

                //check if had add then do not add anymore
                if (transactionhistorycheck == null) {
                    //2. insert transaction config
                    var startDate = new Date;
                    var endDate = new Date(startDate.getTime() + 86400000);
                    if (transactionconfig.isexpired == true) {
                        var expiredDate = new Date(startDate.getTime() + transactionconfig.dayeffective * 86400000);
                    }
                    var utc_timestamp_end = Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate(),
                        endDate.getUTCHours(), endDate.getUTCMinutes(), endDate.getUTCSeconds(), endDate.getUTCMilliseconds());

                    var newlog = await strapi.query('transaction-history').create({
                        trxconfigid: transactionconfig.trxconfigid,
                        createddate: startDate,
                        //expireddate: expiredDate,
                        availabledate: utc_timestamp_end,
                        creditamount: transactionconfig.amount,
                        debitamount: 0,
                        user: userfriend,
                        transactionamount: 0,
                        taxno: '',
                        transactionno: uuid(),
                        outletid: 0,
                        status: 'complete',
                        mobileuserid: userfriend.id,
                        remark: transactionconfig.trxdescription
                    });
                    //3. update mobileusercoinaccount
                    var mycoinaccount = await strapi.query('mobileusercoinaccount').findOne({
                        mobileuserid: userfriend.id
                    });
                    if (mycoinaccount) {
                        mycoinaccount.balance = mycoinaccount.balance + transactionconfig.amount;
                        strapi.query('mobileusercoinaccount').update({ mobileuserid: userfriend.id },
                            mycoinaccount
                        );
                    } else {
                        var createddatedfull = new Date;
                        //create mobileusercoinaccount if not exit
                        var newmycoinaccount = await strapi.query('mobileusercoinaccount').create({
                            mobileuserid: userfriend.id,
                            balance: transactionconfig.amount,
                            totalcredit: 0,
                            totaldebit: 0,
                            totalexpried: 0,
                            modifieddate: createddatedfull
                        });
                    }
                }
            }


        }

        if (user.preferredname !== params.preferredname) {
            user.preferredname = params.preferredname;
        }

        if (user.referralcode === null) {

            const options = { length: 12 };
            const { default: ShortUniqueId } = require('short-unique-id');
            var uid = new ShortUniqueId(options);
            user.referralcode = uid();

        }

        if (params.iscompleteinformation != null && params.iscompleteinformation == true && (user.iscompleteinformation == false || user.iscompleteinformation == null)) {
            //add transaction to transaction history


            //1. get transaction config
            var transactionconfig = await strapi.query('transaction-config').findOne({
                trxconfigid: '002'
            });
            if (transactionconfig == null) {
                return ctx.badRequest(
                    null,
                    formatError({
                        id: 'mobile_user.change-information.error.transaction-config.invalidate',
                        message: 'Transaction config is not exit.',
                    })
                );
            }
            var transactionhistorycheck = await strapi.query('transaction-history').findOne({
                trxconfigid: transactionconfig.trxconfigid,
                mobileuserid: user.id,
                transactionamount: 0
            });
            //check if had add then do not add anymore
            if (transactionhistorycheck == null) {
                //2. insert transaction config
                var startDate = new Date;
                var endDate = new Date(startDate.getTime() + 86400000);
                if (transactionconfig.isexpired == true) {
                    var expiredDate = new Date(startDate.getTime() + transactionconfig.dayeffective * 86400000);
                }
                var utc_timestamp_end = Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate(),
                    endDate.getUTCHours(), endDate.getUTCMinutes(), endDate.getUTCSeconds(), endDate.getUTCMilliseconds());

                var newlog = await strapi.query('transaction-history').create({
                    trxconfigid: transactionconfig.trxconfigid,
                    createddate: startDate,
                    //expireddate: expiredDate,
                    availabledate: utc_timestamp_end,
                    creditamount: transactionconfig.amount,
                    debitamount: 0,
                    user: user,
                    transactionamount: 0,
                    taxno: '',
                    transactionno: uuid(),
                    outletid: 0,
                    status: 'complete',
                    mobileuserid: user.id,
                    remark: transactionconfig.trxdescription
                });
                //3. update mobileusercoinaccount
                var mycoinaccount = await strapi.query('mobileusercoinaccount').findOne({
                    mobileuserid: user.id
                });
                if (mycoinaccount) {
                    mycoinaccount.balance = mycoinaccount.balance + transactionconfig.amount;
                    strapi.query('mobileusercoinaccount').update({ mobileuserid: user.id },
                        mycoinaccount
                    );
                } else {
                    var createddatedfull = new Date;
                    //create mobileusercoinaccount if not exit
                    var newmycoinaccount = await strapi.query('mobileusercoinaccount').create({
                        mobileuserid: user.id,
                        balance: transactionconfig.amount,
                        totalcredit: 0,
                        totaldebit: 0,
                        totalexpried: 0,
                        modifieddate: createddatedfull
                    });
                }
            }
            user.iscompleteinformation = params.iscompleteinformation;
        }
        //update user information
        await strapi.query('user', 'users-permissions').update({ id: user.id }, user);
        let iduser = user.id;
        user = null;
        user = await strapi.query('user', 'users-permissions').findOne({
            id: iduser
        });

        ctx.send({
            jwt: strapi.plugins['users-permissions'].services.jwt.issue({
                id: user.id,
            }),
            user: removeAuthorFields(sanitizeEntity(user.toJSON ? user.toJSON() : user, {
                model: strapi.query('user', 'users-permissions').model,
            })),
        });
    },
    //<================Change Information
    //================>Get My Information
    async myInformation(ctx) {
        //input: user information
        //input: iscompleteinformation
        if (ctx.request && ctx.request.header && ctx.request.header.authorization) {
            try {
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
                            id: 'mobile_user.change-information.error.jwt.invalidate',
                            message: 'User information is not validated.',
                        })
                    );
                }
                ctx.send({
                    jwt: strapi.plugins['users-permissions'].services.jwt.issue({
                        id: user.id,
                    }),
                    user: removeAuthorFields(sanitizeEntity(user.toJSON ? user.toJSON() : user, {
                        model: strapi.query('user', 'users-permissions').model,
                    })),
                });
            } catch (err) {
                return handleErrors(ctx, err, 'unauthorized');
            }
        }

    },
    //=================>Update new password
    async updatenewpassword(ctx) {
        //input: email
        //input: password
        //input: passwordconfirmation
        //input: code
        const params = _.assign({}, ctx.request.body, ctx.params);

        if (
            params.phone &&
            params.password &&
            params.passwordconfirmation &&
            params.password === params.passwordconfirmation &&
            params.code
        ) {

            var { phone } = ctx.request.body;
            var { code } = ctx.request.body;
            let phoneCheck = phone.replace('+', '');

            const user = await strapi
                .query('user', 'users-permissions')
                .findOne({ phone: phoneCheck });

            if (!user) {
                return ctx.badRequest(
                    null,
                    formatError({
                        id: 'mobile-user.reset-password.error.code.provide',
                        message: 'Incorrect phone provided.',
                    })
                );
            }

            let checkCodeSuccess = false;
            //check code in table smshistories
            let dataquery = { name_eq: 'SMSFORGOTPASSWORD', _sort: 'id:desc' };
            let smstypeData = await strapi.services.smstype.find(dataquery);
            if (smstypeData != null && smstypeData.length > 0) {
                dataquery = {
                    phone_eq: phoneCheck,
                    smstype_eq: smstypeData[0].id,
                    _sort: "id:desc",
                    _limit: 1
                };
                let smshistoriesData = await strapi.services.smshistory.find(dataquery);
                console.log(smshistoriesData);
                if (smshistoriesData != null && smshistoriesData.length > 0) {
                    if (smshistoriesData[0].code === code) {
                        //Check success and expire
                        let datenow = new Date(new Date().toUTCString());
                        let millis = datenow - smshistoriesData[0].created_at;
                        let minutesData = Math.floor(millis / (1000 * 60));
                        if (minutesData <= (smshistoriesData[0].smstype.minuteexpire + 3)) {
                            checkCodeSuccess = true;
                        }
                    }
                }
            }
            if (checkCodeSuccess) {
                const password = await strapi.plugins['users-permissions'].services.user.hashPassword({
                    password: params.password,
                });

                // Update the user.
                await strapi
                    .query('user', 'users-permissions')
                    .update({ id: user.id }, { resetPasswordToken: null, password });

                // ctx.send({
                //     jwt: strapi.plugins['users-permissions'].services.jwt.issue({
                //         id: user.id,
                //     }),
                //     user: removeAuthorFields(sanitizeEntity(user.toJSON ? user.toJSON() : user, {
                //         model: strapi.query('user', 'users-permissions').model,
                //     })),
                // });

                ctx.send({
                    statusCode: 0,
                    error: 'success',
                    message: formatError({
                        id: 'success',
                        message: 'Update new password success',
                        field: 'mobile-user.updatenewpassword'
                    }),
                });

            } else {
                return ctx.badRequest(
                    null,
                    formatError({
                        id: 'mobile-user.reset-password.error.password.matching',
                        message: 'Code is wrong or expire.',
                    })
                );
            }

        } else if (
            params.phone &&
            params.password &&
            params.passwordconfirmation &&
            params.password !== params.passwordconfirmation
        ) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'mobile-user.reset-password.error.password.matching',
                    message: 'Passwords do not match.',
                })
            );
        } else {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'mobile-user.reset-password.error.params.provide',
                    message: 'Incorrect params provided.',
                })
            );
        }
    },
    //<==============End update new password

    async changemypassword(ctx) {
        if (ctx.request && ctx.request.header && ctx.request.header.authorization) {
            try {
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
                    //Update new password
                    const params = _.assign({}, ctx.request.body, ctx.params);
                    let oldPassword = params.oldpassword;
                    let newPassword = params.newpassword;
                    let newPasswordConfirm = params.newpasswordconfirm;

                    const validPassword = strapi.plugins['users-permissions'].services.user.validatePassword(
                        oldPassword,
                        user.password
                    );

                    if (validPassword && newPassword === newPasswordConfirm) {
                        //Update password
                        const password = await strapi.plugins['users-permissions'].services.user.hashPassword({
                            password: newPasswordConfirm,
                        });

                        // Update the user.
                        await strapi
                            .query('user', 'users-permissions')
                            .update({ id: user.id }, { resetPasswordToken: null, password });

                        ctx.send({
                            statusCode: 0,
                            error: 'success',
                            message: formatError({
                                id: 'success',
                                message: 'Update new password success',
                                field: 'mobile-user.updatenewpassword'
                            }),
                        });

                    } else {
                        return ctx.badRequest(
                            null,
                            formatError({
                                id: 'mobile_user.updatemypassword.error.jwt.invalidate',
                                message: 'Old password is wrong.',
                            })
                        );
                    }
                    // ctx.send({
                    //     jwt: strapi.plugins['users-permissions'].services.jwt.issue({
                    //         id: user.id,
                    //     }),
                    //     user: removeAuthorFields(sanitizeEntity(user.toJSON ? user.toJSON() : user, {
                    //         model: strapi.query('user', 'users-permissions').model,
                    //     })),
                    // });

                }


            } catch (err) {
                return handleErrors(ctx, err, 'unauthorized');
            }
        }
    },
    async getreferralcode(ctx) {
        if (ctx.request && ctx.request.header && ctx.request.header.authorization) {

            try {
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
                    //get referralcode
                    if (user.referralcode === null) {
                        const options = { length: 12 };
                        const { default: ShortUniqueId } = require('short-unique-id');
                        var uid = new ShortUniqueId(options);
                        user.referralcode = uid();
                        await strapi.query('user', 'users-permissions').update({ id: user.id }, user);
                    }
                    ctx.send({ referralcode: user.referralcode });
                }

            } catch (err) {
                return handleErrors(ctx, err, 'unauthorized');
            }

        } else {
            return handleErrors(ctx, err, 'unauthorized');
        }
    },
    async verifypassword(ctx) {
        if (ctx.request && ctx.request.header && ctx.request.header.authorization) {

            try {
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
                    //check password
                    const params = _.assign({}, ctx.request.body, ctx.params);
                    let oldPassword = params.password;
                    if (oldPassword !== null) {
                        const validPassword = strapi.plugins['users-permissions'].services.user.validatePassword(
                            oldPassword,
                            user.password
                        );
                        if (validPassword) {
                            ctx.send({
                                statusCode: 0,
                                error: 'success',
                                message: formatError({
                                    id: 'success',
                                    message: 'Password is true',
                                    field: 'mobile-user.updatenewpassword'
                                }),
                            });
                        } else {
                            return ctx.badRequest(
                                null,
                                formatError({
                                    id: 'mobile-user.verify-password.error.password.requied',
                                    message: 'Password is not match.',
                                })
                            );
                        }

                    } else {
                        return ctx.badRequest(
                            null,
                            formatError({
                                id: 'mobile-user.verify-password.error.password.requied',
                                message: 'Password is requied.',
                            })
                        );
                    }

                }

            } catch (err) {
                return handleErrors(ctx, err, 'unauthorized');
            }

        } else {
            return handleErrors(ctx, err, 'unauthorized');
        }
    }
};