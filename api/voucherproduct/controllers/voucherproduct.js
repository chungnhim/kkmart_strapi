'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

module.exports = {
    getvouchers: async ctx => {
        var res = await strapi.query('voucherproduct').find({ voucherstatus_eq: strapi.config.constants.voucher_status.activated });
        let rsl = await strapi.services.common.normalizationResponse(res, ["created_at", "updated_at", "vouchertype", "isusewithpromotion", "voucherapplyfor", "groupcustomers", "users"]);
        ctx.send(Object.values(rsl));
    }
};