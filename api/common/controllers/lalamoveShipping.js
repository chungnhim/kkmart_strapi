'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

const _ = require('lodash');

module.exports = {
  async getConfiguration(ctx) {
    var res = await strapi.services.lalamoveshippingservice.getConfiguration();
    ctx.send(res);
  },
  async getQuotations(ctx) {
    const params = _.assign({}, ctx.request.body, ctx.params);
    var res = await strapi.services.lalamoveshippingservice.getQuotations(
      params
    );

    ctx.send(res);
  }
};