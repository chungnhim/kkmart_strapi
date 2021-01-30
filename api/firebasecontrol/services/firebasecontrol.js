'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/services.html#core-services)
 * to customize this service
 */

const crypto = require('crypto');
const uuid = require('uuid');
const _ = require('lodash');
const grant = require('grant-koa');
const { sanitizeEntity } = require('strapi-utils');

const FireBaseServerkey = "AAAAAkF2Qsc:APA91bFHW0FIsJa-BJTC6_8KaBh31c-vniUCEMpa7AOFWTYF9kgB7ZFwtYbCHEhGWWm1C0lRCgOLkd1U4hKdbOKPgU5PQeNUC82Ra6cWJe-U4SPL91PUF7LoZ7dOkabkRbWrJ9-ajHJr";
const FireBaseSenderID = "9688203975";
const axios = require('axios');

const removeAuthorFields = (entity) => {
    const sanitizedValue = _.omit(entity, ['created_by', 'updated_by', 'created_at', 'updated_at', 'formats', 'deviceinfos',
        'transaction_histories', 'outlets', 'role', 'provider', 'confirmed', 'user', 'status', 'pushstatus', 'id'
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
    sendtoonedevice: async(devicereg, platform, title, type, content) => {
        content = removeAuthorFields(content);
        var dataFCM = {
            "to": devicereg,
            "content_available": true,
            "mutable_content": true,
            "priority": "high",
            "notification": {
                "title": title,
                "body": content.noticecontent
            },
            "data": { content }
        }
        var config = {
            method: 'post',
            url: 'https://fcm.googleapis.com/fcm/send',
            headers: {
                'Authorization': "key=" + FireBaseServerkey,
                'Sender': "id=" + FireBaseSenderID,
                'Cache-Control': 'no-cache',
                'Content-Type': 'application/json'
            },
            data: dataFCM
        };
        var dataReturn = "";
        await axios(config)
            .then(function(response) {
                dataReturn = response.data;
            })
            .catch(function(error) {
                dataReturn = 'Error call server SMS';
            });
        return dataReturn;
    },
    sendtoarraydevice: async(arraydevicereg, platform, title, type, content) => {
        content = removeAuthorFields(content);
        var dataFCM = {
            "registration_ids": arraydevicereg,
            "content_available": true,
            "mutable_content": true,
            "priority": "high",
            "notification": {
                "title": title,
                "body": content.noticecontent,
                "image": "https://static.pexels.com/photos/4825/red-love-romantic-flowers.jpg",
                "style": "picture",
                "picture": "https://appsolzone.com/wp-content/uploads/2018/07/Scholar-Wings-2-480x336.jpg"
            },
            "data": { content }
        }

        var config = {
            method: 'post',
            url: 'https://fcm.googleapis.com/fcm/send',
            headers: {
                'Authorization': "key=" + FireBaseServerkey,
                'Sender': "id=" + FireBaseSenderID,
                'Cache-Control': 'no-cache',
                'Content-Type': 'application/json'
            },
            data: dataFCM
        };
        var dataReturn = "";
        await axios(config)
            .then(function(response) {
                dataReturn = response.data;
            })
            .catch(function(error) {
                dataReturn = 'Error call server SMS';
            });
        return dataReturn;
    },
    sendtoarraydeviceandroid: async(arraydevicereg, title, content) => {
        content = removeAuthorFields(content);
        var dataFCM = {
            "registration_ids": arraydevicereg,
            "content_available": true,
            "mutable_content": true,
            "priority": "high",
            "notification": {
                "title": title,
                "body": content.noticecontent,
                "sound": "kk_amanda",
                "android_channel_id": "channel_1"
            },
            "data": { content }
        }

        var config = {
            method: 'post',
            url: 'https://fcm.googleapis.com/fcm/send',
            headers: {
                'Authorization': "key=" + FireBaseServerkey,
                'Sender': "id=" + FireBaseSenderID,
                'Cache-Control': 'no-cache',
                'Content-Type': 'application/json'
            },
            data: dataFCM
        };
        var dataReturn = "";
        await axios(config)
            .then(function(response) {
                dataReturn = response.data;
            })
            .catch(function(error) {
                dataReturn = 'Error call server SMS';
            });
        return dataReturn;
    },
    sendtoarraydeviceios: async(arraydevicereg, title, content) => {
        content = removeAuthorFields(content);
        var dataFCM = {
            "registration_ids": arraydevicereg,
            "content_available": true,
            "mutable_content": true,
            "priority": "high",
            "notification": {
                "title": title,
                "body": content.noticecontent,
                "sound": "KK_amanda.caf",
                "badge": 1
            },
            "data": { content }
        }

        var config = {
            method: 'post',
            url: 'https://fcm.googleapis.com/fcm/send',
            headers: {
                'Authorization': "key=" + FireBaseServerkey,
                'Sender': "id=" + FireBaseSenderID,
                'Cache-Control': 'no-cache',
                'Content-Type': 'application/json'
            },
            data: dataFCM
        };
        var dataReturn = "";
        await axios(config)
            .then(function(response) {
                dataReturn = response.data;
            })
            .catch(function(error) {
                dataReturn = 'Error call server SMS';
            });
        return dataReturn;
    },
    sendtotopic: async(topicname, platform, title, type, content) => {
        content = removeAuthorFields(content);
        var dataFCM = {
            "to": topicname,
            "content_available": true,
            "mutable_content": true,
            "priority": "high",
            "notification": {
                "title": title,
                "body": content.noticecontent
            },
            "data": { content }
        }
        var config = {
            method: 'post',
            url: 'https://fcm.googleapis.com/fcm/send',
            headers: {
                'Authorization': "key=" + FireBaseServerkey,
                'Sender': "id=" + FireBaseSenderID,
                'Cache-Control': 'no-cache',
                'Content-Type': 'application/json'
            },
            data: dataFCM
        };
        var dataReturn = "";
        await axios(config)
            .then(function(response) {
                dataReturn = response.data;
            })
            .catch(function(error) {
                dataReturn = 'Error call server SMS';
            });
        return dataReturn;
    },
    sendtotopicandroid: async(topicname, title, content) => {
        content = removeAuthorFields(content);
        var dataFCM = {
            "to": topicname,
            "content_available": true,
            "mutable_content": true,
            "priority": "high",
            "notification": {
                "title": title,
                "body": content.noticecontent,
                "sound": "kk_amanda",
                "android_channel_id": "channel_1"
            },
            "data": { content }
        }
        var config = {
            method: 'post',
            url: 'https://fcm.googleapis.com/fcm/send',
            headers: {
                'Authorization': "key=" + FireBaseServerkey,
                'Sender': "id=" + FireBaseSenderID,
                'Cache-Control': 'no-cache',
                'Content-Type': 'application/json'
            },
            data: dataFCM
        };
        var dataReturn = "";
        await axios(config)
            .then(function(response) {
                dataReturn = response.data;
            })
            .catch(function(error) {
                dataReturn = 'Error call server SMS';
            });
        return dataReturn;
    },
    sendtotopicios: async(topicname, title, content) => {
        content = removeAuthorFields(content);
        var dataFCM = {
            "to": topicname,
            "content_available": true,
            "mutable_content": true,
            "priority": "high",
            "notification": {
                "title": title,
                "body": content.noticecontent,
                "sound": "KK_amanda.caf",
                "badge": 1
            },
            "data": { content }
        }
        var config = {
            method: 'post',
            url: 'https://fcm.googleapis.com/fcm/send',
            headers: {
                'Authorization': "key=" + FireBaseServerkey,
                'Sender': "id=" + FireBaseSenderID,
                'Cache-Control': 'no-cache',
                'Content-Type': 'application/json'
            },
            data: dataFCM
        };
        var dataReturn = "";
        await axios(config)
            .then(function(response) {
                dataReturn = response.data;
            })
            .catch(function(error) {
                dataReturn = 'Error call server SMS';
            });
        return dataReturn;
    },
    subscribetotopic: async(topicname, arraydevicereg) => {

        content = removeAuthorFields(content);
        // {
        //     "to": "/topics/movies",
        //     "registration_tokens": ["nKctODamlM4:CKrh_PC8kIb7O...", "1uoasi24:9jsjwuw...", "798aywu:cba420..."],
        //  }

        var dataFCM = {
            "to": topicname,
            "registration_tokens": arraydevicereg,
        }

        var config = {
            method: 'post',
            url: 'https://iid.googleapis.com/iid/v1:batchAdd',
            headers: {
                'Authorization': "key=" + FireBaseServerkey,
                'Sender': "id=" + FireBaseSenderID,
                'Cache-Control': 'no-cache',
                'Content-Type': 'application/json'
            },
            data: dataFCM
        };
        var dataReturn = "";
        await axios(config)
            .then(function(response) {
                dataReturn = response.data;
            })
            .catch(function(error) {
                dataReturn = 'Error call server SMS';
            });
        return dataReturn;
    },
    unsubscribetotopic: async(topicname, arraydevicereg) => {
        content = removeAuthorFields(content);
        var dataFCM = {
            "to": topicname,
            "registration_tokens": arraydevicereg,
        }
        var config = {
            method: 'post',
            url: 'https://iid.googleapis.com/iid/v1:batchRemove',
            headers: {
                'Authorization': "key=" + FireBaseServerkey,
                'Sender': "id=" + FireBaseSenderID,
                'Cache-Control': 'no-cache',
                'Content-Type': 'application/json'
            },
            data: dataFCM
        };
        var dataReturn = "";
        await axios(config)
            .then(function(response) {
                dataReturn = response.data;
            })
            .catch(function(error) {
                dataReturn = 'Error call server SMS';
            });
        return dataReturn;
    }
};