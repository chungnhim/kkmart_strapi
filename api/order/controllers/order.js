'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

const moment = require('moment');
const _ = require("lodash");

const generateOrderCode = (length = 6) => {
    let text = ''
    let possible = '0123456789'
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length))
    }

    return moment.utc(new Date).format("YYYYMMDD") + text;
}

const getByOrderCode = async(orderCode) => {
    var order = await strapi.query("order").findOne({
        order_code: orderCode,
    });

    return order;
}

const getByOrdersUserId = async(pageIndex, pageSize, userId) => {
    var dataQuery = {
        _start: (pageIndex - 1) * pageSize,
        _limit: pageSize,
        _sort: "created_at:desc",
    };

    var totalRows = await strapi.query('order').count(dataQuery);
    var entities = await strapi.query("order").find(dataQuery);

    return {
        totalRows,
        entities
    };
}

module.exports = {
    checkOut: async (ctx) => {
        // {
        //     "billing": {
        //         "address": "",
        //         "district_id": "",
        //         "full_name": "",
        //         "note": "",
        //         "phone_number": "",
        //         "province_id": ""
        //     },
        //     "cart_items_id": [],
        //     "currency": "MYR",
        //     "order_via": "Web",
        //     "payment_method": "",
        //     "shipping": {
        //         "address": "HN",
        //         "district_id": "",
        //         "full_name": "Test",
        //         "note": "TEST",
        //         "phone_number": "Test 1111",
        //         "province_id": ""
        //     }
        // }

        const params = _.assign({}, ctx.request.body, ctx.params);
        let userId = await strapi.services.common.getLoggedUserId(ctx);
        if (userId == 0) {
            return ctx.badRequest(
                null,
                formatError({
                    id: 'Invalid Token',
                    message: 'Invalid Token',
                })
            );
        }

        if (_.isNil(params.cart_items_id) || params.cart_items_id.length == 0) {
            ctx.send({
                success: false,
                message: "No product for checkout"
            });

            return;
        }

        var shoppingCart = await strapi.query("shopping-cart").findOne({
            user: userId
        });

        if (_.isNil(shoppingCart)) {
            ctx.send({
                success: false,
                message: "Shopping cart does not exists"
            });

            return;
        }

        if (_.isNil(shoppingCart.shopping_cart_products)) {
            ctx.send({
                success: false,
                message: "Shopping cart is empty"
            });

            return;
        }

        let checkOutProducts = shoppingCart.shopping_cart_products.filter(s => params.cart_items_id.includes(s.id));

        let totalAmount = 0;
        let discountAmount = 0;
        let hasError = false;
        let orderProductEntities = [];

        for (let index = 0; index < checkOutProducts.length; index++) {
            const cartItem = checkOutProducts[index];
            console.log(`cartItem`, cartItem);
            let product = await strapi.services.product.getProductById(cartItem.product);
            if (_.isNil(product)) {
                hasError = true;

                return;
            }

            let variant = product.product_variants.find(s => s.product_variant == product.product_variant);
            if (_.isNil(variant)) {
                hasError = true;

                return;
            }

            totalAmount += variant.selling_price * cartItem.qtty;
            orderProductEntities.push({
                products: product.id,
                product_variants: variant.id,
                qtty: cartItem.qtty,
                origin_price: 0,
                selling_price: variant.selling_price,
                currency: params.currency,
                discount_amount: 0,
                note: null
            });
        }

        if (hasError) {
            ctx.send({
                success: false,
                message: "Product does not exists"
            });

            return;
        }

        let orderEntity = {
            order_code: generateOrderCode(5),
            order_via: params.order_via,
            order_status: 1,
            payment_status: 1,
            shipping_status: 1,
            total_amount: totalAmount,
            currency: params.currency,
            discount_amount: discountAmount,
            order_note: "",
            user: userId
        };

        var order = await strapi.query("order").create(orderEntity);

        if (_.isNil(order)) {
            ctx.send({
                success: false,
                message: "Pre checkout failed"
            });

            return;
        }

        await strapi.query("shopping-cart").update({
            id: shoppingCart.id
        }, {
            status: strapi.config.constants.shopping_cart_status.paid,
            user: !_.isNil(shoppingCart.user) ? shoppingCart.user.id : null
        });

        for (let i = 0; i < orderProductEntities.length; i++) {
            const product = orderProductEntities[i];
            product.order = order.id;

            await strapi.query("order-product").create(product);
        }

        // Add shipping information
        var shipping = {
            order: order.id,
            full_name: params.shipping.full_name,
            phone_number: params.shipping.phone_number,
            province: params.shipping.province_id,
            district: params.shipping.district_id,
            address: params.shipping.address,
            note: params.shipping.note,
            status: 1,
            deliver_date: null,
            actual_deliver_date: null,
            deliver_note: null,
            shipping_provider: null
        };

        await strapi.query("order-shipping").create(shipping);

        // Add billing address
        var billingAddress = {
            order: order.id,
            full_name: params.billing.full_name,
            phone_number: params.billing.phone_number,
            province: params.billing.province_id,
            district: params.billing.district_id,
            address: params.billing.address,
            note: params.billing.note,
            status: 1,
            billing_date: null
        };

        console.log(`billingAddress`, billingAddress);
        await strapi.query("order-billing").create(billingAddress);
        await strapi.query("shopping-cart-product").delete({
            shopping_cart: shoppingCart.id
        });

        ctx.send({
            success: true,
            message: "Checkout has been successfully",
            order_id: order.id,
            total_amount: totalAmount,
            discount_amount: discountAmount,
            order_code: orderEntity.order_code
        });
    },
    getByOrderCode: async(ctx) => {
        const params = _.assign({}, ctx.request.params, ctx.params);
        var orderCode = params.orderCode;

        if (_.isNil(orderCode)) {
            ctx.send({
                success: false,
                message: "Please input order code"
            });

            return;
        }

        var order = await getByOrderCode(orderCode);
        if (_.isNil(order)) {
            ctx.send({
                success: false,
                message: "Order not found"
            });

            return;
        }

        console.log(`order`, order);

        var res = await strapi.services.common.normalizationResponse(
            order, ["user"]
        );

        ctx.send({
            success: true,
            order: res
        });
    },
    getOrdersByUserId: async(ctx) => {
        let userId = await strapi.services.common.getLoggedUserId(ctx);
        if (_.isNil(userId) || userId == 0) {
            ctx.send({
                success: false,
                message: "Please login to your account"
            });

            return;
        }

        const params = _.assign({}, ctx.request.params, ctx.params);
        let pageIndex = 1,
            pageSize = 10;

        if (!_.isNil(params.page_index) && !_.isNil(params.page_size)) {
            pageIndex = parseInt(params.page_index);
            pageSize = parseInt(params.page_size);
        }

        var res = await getByOrdersUserId(pageIndex, pageSize, userId);
        if (_.isNil(res)) {
            ctx.send({
                success: false,
                message: "No data found"
            });

            return;
        }

        let models = await strapi.services.common.normalizationResponse(
            res.entities, ["user"]
        );

        ctx.send({
            success: true,
            totalRows: res.totalRows,
            orders: _.values(models)
        });
    }
};