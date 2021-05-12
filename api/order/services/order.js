'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/services.html#core-services)
 * to customize this service
 */
const _ = require("lodash");

module.exports = {
    getOrdersByStatus: async(pageIndex, pageSize, ordstatus, searchObject) => {
        var dataQuery = {
            order_status_in: ordstatus && ordstatus.split(","),
            _start: (pageIndex - 1) * pageSize,
            _limit: pageSize,
            _sort: "created_at:desc",
        };
        if (searchObject) {
          const { customer_name, order_code, phone_number, delivery_type } = searchObject;
          if (customer_name) {
            dataQuery['order_shipping.full_name_contains'] = customer_name;
          }
          if (phone_number) {
            dataQuery['order_shipping.phone_number_contains'] = phone_number;
          }
          if (order_code) {
            dataQuery['order_code_contains'] = order_code;
          }
          if (delivery_type === 'EXPRESS') {
            dataQuery['is_express_delivery_eq'] = true;
          }
          if (delivery_type === 'NORMAL') {
            dataQuery['is_express_delivery_eq'] = false;
          }
        }

        var totalRows = await strapi.query('order').count(dataQuery);
        var entities = await strapi.query("order").find(dataQuery);
        /*
        let productIds = [];
        entities.forEach(order => {
            order.order_products.forEach(product => {
                productIds.push(product.product);
            });
        });

        let products = await strapi.query("product").find({
            id_in: productIds
        });

        entities.forEach(order => {
            order.order_products.forEach(product => {
                product.product_info = products.find(s => s.id == product.product);
                console.log(`============================ product.product_info`, product.product_info.product_variants);

                if (!_.isNil(product.product_info.product_variants) && product.product_info.product_variants.length > 0) {
                    product.product_info.product_variants = product.product_info.product_variants.find(s => s.id == product.product_variant);
                }
            });
        });
        */
        return {
            totalRows,
            entities
        };
    }
};
