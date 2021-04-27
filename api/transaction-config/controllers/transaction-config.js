'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

module.exports = {

    getFullInfoCoinValue: async(ctx) => {
        console.log(`come on`);
        let pmType = await strapi.query("transaction-config").findOne({
            trxconfigid: "002"
        });
        let paymentType = await strapi.services.common.normalizationResponse(pmType, ["created_at", "updated_at", "trxconfigid", "dayeffective", "dayexpired", "isexpired", "monthexpired"]);

        let myramount = 0;
        // calculate to MYR
        var exchangerate = await strapi.query('exchangerate').findOne({
            currencycode: 'K',
            basecurrencycode: 'MYR',
        });
        if (exchangerate) {
            myramount = parseFloat(paymentType.amount / exchangerate.rate).toFixed(2);
        }
        paymentType.myramount = myramount;
        ctx.send(paymentType);
    },
    generateQRCode: async(ctx) => {

        // select all user
        let entities = await strapi.query('user', 'users-permissions').find({
            _sort: "id"
        });

        entities.forEach(async(usr) => {
            console.log(usr)
                // 04 for normal
            let usrQr = await strapi.services.common.generateUserQrCode("04");
            usr.qrcode = usrQr;
            let udp = await strapi.query('user', 'users-permissions').update({ id: usr.id }, usr);
        });


        ctx.send({
            success: true,
            value: "Update successfull"
        });
    }
};