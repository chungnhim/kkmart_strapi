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
  async shippingProvider(ctx) {
    var res = [
      {
        key: "LALAMOVE",
        name: "Lalamove shipping provider"
      }
    ];

    ctx.send(res);
  },
  async getQuotations(ctx) {
    const params = _.assign({}, ctx.request.body, ctx.params);
    if (params.provider == "LALAMOVE") {
      var res = await strapi.services.lalamoveshippingservice.getQuotations(
        params
      );

      ctx.send(res);

      return;
    }

    ctx.send({
      success: false,
      message: "No shipping provider supported"
    });
  },
  async placeOrder(ctx) {
    const params = _.assign({}, ctx.request.body, ctx.params);
    if (params.provider == "LALAMOVE") {
      var res = await strapi.services.lalamoveshippingservice.placeOrder(
        params
      );

      ctx.send(res);

      return;
    }

    ctx.send({
      success: false,
      message: "No shipping provider supported"
    });
  },
  async getOrderDetails(ctx) {
    const params = _.assign({}, ctx.request.params, ctx.params);
    if (params.provider == "LALAMOVE") {
      var res = await strapi.services.lalamoveshippingservice.getOrderDetails(
        params.orderRef
      );

      ctx.send(res);

      return;
    }

    ctx.send({
      success: false,
      message: "No shipping provider supported"
    });
  }
};