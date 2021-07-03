"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */
const { sanitizeEntity } = require("strapi-utils");
const _ = require("lodash");
const axios = require("axios");
const moment = require('moment');

module.exports = {

    createloganđataforpush: async(elementUsers, element, notificationtype) => {
        var arrayImageNoti = []
        if (element.contentimage) {
            //console.log(element.contentimage);
            arrayImageNoti.push(element.contentimage.id);
        }
        //Create log notification to user
        let dataNotificationlog = {
            noticetypeid: notificationtype.id,
            noticetypename: element.titlenotification,
            noticetitle: element.titlenotification,
            pushstatus: 'Y',
            status: 'A',
            noticecontent: element.notificationcontent,
            notificationcode: notificationtype.notificationcode,
            noticedata: '',
            user: elementUsers,
            noticeurl: element.linkurl,
            image: arrayImageNoti
        }
        var newNotificationlogs = await strapi.query('notificationlog').create(dataNotificationlog);
        //console.log(newNotificationlogs);
        //Get device reg of user
        //Create log push notification firebase
        var listdeviceidreg = await strapi.query('deviceinfo').model.query(qb => {
            qb.select('devicereg', 'platform')
                .where('user', elementUsers.id);
        }).fetchAll();
        listdeviceidreg = listdeviceidreg.toJSON();
        if (listdeviceidreg) {
            for (let k = 0; k < listdeviceidreg.length; k++) {
                const elementDeviceReg = listdeviceidreg[k];
                if (elementDeviceReg.devicereg.length > 4) {
                    let dataPushnotificationfirebaselog = {
                        mobileuserid: elementUsers.id,
                        statusoffirebase: 0,
                        datasend: '',
                        resultoffirebase: '',
                        deviceregid: elementDeviceReg.devicereg,
                        platform: elementDeviceReg.platform,
                        isrunjob: false,
                        notititle: element.titlenotification,
                        noticontent: element.notificationcontent,
                        notificationlogid: newNotificationlogs.id
                    }
                    var newPushnotificationfirebaselog = await strapi.query('pushnotificationfirebaselog').create(dataPushnotificationfirebaselog);
                }
            }
        }
    },

};