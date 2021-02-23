'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

const _ = require('lodash');

module.exports = {
  async getServiceType(ctx) {
    var res = await strapi.services.lalamoveshippingservice.getServiceType();
    ctx.send(res);
  },
  async getQuotations(ctx) {
    const params = _.assign({}, ctx.request.body, ctx.params);
    console.log(`params.body`, params);

    var res = await strapi.services.lalamoveshippingservice.getQuotations(
      params
    );

    ctx.send(res);
  }
};