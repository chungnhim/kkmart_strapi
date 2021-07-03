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

    let productIds = [];
    order.order_products.forEach(product => {
        productIds.push(product.product);
    });

    let products = await strapi.query("product").find({
        id_in: productIds
    });

    order.order_products.forEach(product => {
        product.product_info = products.find(s => s.id == product.product);
        product.product_info.product_variants = product.product_info.product_variants.find(s => s.id == product.product_variant);
    });

    return order;
}

const getByOrdersUserId = async(pageIndex, pageSize, userId) => {
    var dataQuery = {
        user: userId,
        _start: (pageIndex - 1) * pageSize,
        _limit: pageSize,
        _sort: "created_at:desc",
    };

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

const processCheckout = async(userId, products, is_expressmart, shipping_prodiver_code, order_via, vouchercode, is_use_coin, currency, shopping_cart_id) => {
    // [
    //     {
    //         "product_id": 1,
    //         "product_variant_id": 1,
    //         "qtty": 1
    //     },
    //     {
    //         "product_id": 1,
    //         "product_variant_id": 1,
    //         "qtty": 1
    //     }
    // ]

    let totalAmount = 0;
    let discountAmount = 0;

    let kcoin_used = 0;
    let kcoin_earned = 0;
    let voucher_discount_amt = 0;

    for (let index = 0; index < products.length; index++) {
        const cartItem = products[index];

        let product = await strapi.services.product.getProductById(cartItem.product_id);
        if (_.isNil(product)) {
            return {
                success: false,
                message: "Product does not exists"
            };
        }

        let variant = product.product_variants.find(s => s.id == cartItem.product_variant_id);
        if (_.isNil(variant)) {
            return {
                success: false,
                message: "Product variant does not exists"
            };
        }

        totalAmount += variant.selling_price * cartItem.qtty;
        let coin_can_use = 0;
        // calculate kcoin used if is_use_coin = true
        if (is_use_coin) {

            if ((variant.can_use_coin === true) && (variant.coin_can_use > 0)) {
                coin_can_use = variant.coin_can_use;
            } else {
                if (!_.isNil(product.can_use_coin) && product.can_use_coin == true) {
                    coin_can_use = product.coin_can_use;
                }
            }

            kcoin_used += coin_can_use;
        }
        let kcoin_each_earn = 0;
        // calculate kcoin earn
        if (variant.coin_earn > 0) {
            kcoin_each_earn = variant.coin_earn;
        } else {
            kcoin_each_earn = product.coin_earn | 0;
        }
        kcoin_earned += kcoin_each_earn;

    }

    // check existing to delete
    // get current checkoutId
    let ordcheckout = await strapi.query("order-checkout").findOne({
        user: userId,
        checkoutstatus: strapi.config.constants.shopping_cart_status.new,
        _sort: "id:desc"
    });
    if (!_.isNil(ordcheckout)) {
        await strapi.query("order-checkout").delete({
            id: ordcheckout.id
        });
    }

    let ckoutEntity = {
        order_via: order_via,
        checkoutstatus: 1,
        total_amount: totalAmount,
        currency: currency,
        discount_amount: discountAmount,
        user: userId,
        coin_earned: kcoin_earned,
        coin_used: kcoin_used,
        vouchercode: vouchercode,
        is_expressmart: is_expressmart,
        shipping_prodiver_code: shipping_prodiver_code,
        shopping_cart: shopping_cart_id,
        is_use_coin: is_use_coin,
        voucher_discount_amt: voucher_discount_amt
    };

    var order = await strapi.query("order-checkout").create(ckoutEntity);
    if (_.isNil(order)) {
        return {
            success: false,
            message: "Can not create checkout"
        };
    }

    return {
        success: true,
        message: "Checkout has been successfully",
        checkout_id: order.id,
        total_amount: totalAmount,
        discount_amount: discountAmount
    };
}

const processCreateOrder = async(userId,
    products,
    is_expressmart,
    user_address_id,
    order_via,
    vouchercode,
    is_use_coin,
    shipping_note,
    currency, paymentmethodId) => {
    // [
    //     {
    //         "product_id": 1,
    //         "product_variant_id": 1,
    //         "qtty": 1
    //     },
    //     {
    //         "product_id": 1,
    //         "product_variant_id": 1,
    //         "qtty": 1
    //     }
    // ]

    let totalAmount = 0;
    let discountAmount = 0;
    let orderProductEntities = [];
    let kcoin_used = 0;
    let kcoin_earned = 0;
    let shipping_fee = 0;
    // get Shipping Info
    let userAddressInf = await strapi.query("user-address").findOne({
        id: user_address_id
    });

    if (_.isNil(userAddressInf)) {
        return {
            success: false,
            message: "Please choose the shipping address"
        };
    }

    for (let index = 0; index < products.length; index++) {
        const cartItem = products[index];

        let product = await strapi.services.product.getProductById(cartItem.product_id);
        if (_.isNil(product)) {
            return {
                success: false,
                message: "Product does not exists"
            };
        }

        let variant = product.product_variants.find(s => s.id == cartItem.product_variant_id);
        if (_.isNil(variant)) {
            return {
                success: false,
                message: "Product variant does not exists"
            };
        }

        totalAmount += variant.selling_price * cartItem.qtty;
        let coin_can_use = 0;
        // calculate kcoin used if is_use_coin = true
        if (is_use_coin) {

            if ((variant.can_use_coin === true) && (variant.coin_can_use > 0)) {
                coin_can_use = variant.coin_can_use;
            } else {
                if (!_.isNil(product.can_use_coin) && product.can_use_coin == true) {
                    coin_can_use = product.coin_can_use;
                }
            }

            kcoin_used += coin_can_use;
        }
        let kcoin_each_earn = 0;
        // calculate kcoin earn
        if (variant.coin_earn > 0) {
            kcoin_each_earn = variant.coin_earn;
        } else {
            kcoin_each_earn = product.coin_earn | 0;
        }
        kcoin_earned += kcoin_each_earn;

        orderProductEntities.push({
            product: product.id,
            product_variant: variant.id,
            qtty: cartItem.qtty,
            origin_price: product.price,
            selling_price: variant.selling_price,
            currency: currency,
            discount_amount: 0,
            note: null,
            coin_earned: kcoin_each_earn,
            coin_used: coin_can_use,
            productname: product.name,
            productimage: product.productimgs[0].url
        });
    }

    let orderEntity = {
        order_code: generateOrderCode(5),
        order_via: order_via,
        order_status: 1,
        payment_status: 1,
        shipping_status: 1,
        total_amount: totalAmount,
        currency: currency,
        discount_amount: discountAmount,
        order_note: "",
        user: userId,
        coin_earned: kcoin_earned,
        coin_used: kcoin_used,
        vouchercode: vouchercode,
        is_express_delivery: is_expressmart,
        paymentmethod: paymentmethodId
    };

    var order = await strapi.query("order").create(orderEntity);
    if (_.isNil(order)) {
        return {
            success: false,
            message: "Can not create order"
        };
    }

    for (let i = 0; i < orderProductEntities.length; i++) {
        const product = orderProductEntities[i];
        product.order = order.id;

        await strapi.query("order-product").create(product);
    }

    // Add shipping information
    var shipping = {
        order: order.id,
        full_name: userAddressInf.full_name,
        phone_number: userAddressInf.phone_number,
        state: userAddressInf.state,
        city: userAddressInf.city,
        country: userAddressInf.country,
        address: userAddressInf.address1,
        note: shipping_note,
        status: strapi.config.constants.shipping_status.new,
        deliver_date: null,
        actual_deliver_date: null,
        deliver_note: shipping_note,
        shipping_provider: null,
        postcode: userAddressInf.postcode,
        shippingfee: shipping_fee,
        user_address: user_address_id
    };

    var shipping = await strapi.query("order-shipping").create(shipping);

    if (is_expressmart == true) {
        var quotationRes = await strapi.services.lalamoveshippingservice.placeOrder(
            user_address_id,
            products,
            shipping_note,
            null
        );

        if (quotationRes.success) {
            shipping.shipping_provider = quotationRes.data.shippingProvider;
            shipping.shipping_ref_number = quotationRes.data.orderRef;

            await strapi.query("order-shipping").update({ id: shipping.id }, {
                shipping_provider: quotationRes.data.shippingProvider,
                shipping_ref_number: quotationRes.data.orderRef,
                shipping_fee: quotationRes.data.orderRef,
                status: strapi.config.constants.shipping_status.inProvider
            });
            // get order detail
            let shipinfo = await strapi.services.lalamoveshippingservice.getOrderDetails(quotationRes.data.orderRef);

            if (!_.isNil(shipinfo) && shipinfo.success) {
                var tracking = {
                    trackingstatus: shipinfo.data.status,
                    description: shipinfo.data.status,
                    sharelink: shipinfo.data.shareLink,
                    amount: shipinfo.data.price.amount,
                    currency: shipinfo.data.price.currency,
                    order_shipping: shipping.id
                };
                var shippingtrack = await strapi.query("shipping-tracking").create(tracking);
            }
            // update order status to ToShip
            await strapi.query("order").update({ id: order.id }, {
                order_status: strapi.config.constants.order_status.toship
            });
        }
    }

    // Add billing address
    /*
    var billingAddress = {
        order: order.id,
        full_name: billing.full_name,
        phone_number: billing.phone_number,
        province: billing.province_id,
        district: billing.district_id,
        address: billing.address,
        note: billing.note,
        status: 1,
        billing_date: null
    };

    await strapi.query("order-billing").create(billingAddress);
    */

    return {
        success: true,
        message: "Checkout has been successfully",
        order_id: order.id,
        total_amount: totalAmount,
        discount_amount: discountAmount,
        order_code: orderEntity.order_code
    };
}

const getShippingStatusLabel = (status) => {
    switch (status) {
        case 1:
            return "New"
        case 2:
            return "In Provider"
        case 3:
            return "On Delivery"
        case 4:
            return "Completed"
        case 5:
            return "Cancelled"
        default:
            return "N/A";
    };
}

module.exports = {
    checkOut: async(ctx) => {
        //{
        //   "is_expressmart": false,
        //    "shipping_prodiver_code": "LALAMOVE",
        //    "cart_items_id": [
        //      101,
        //      103
        //    ],
        //    "currency": "MYR",
        //    "order_via": "Web",
        //    "vouchercode": "",
        //    "is_use_coin": true
        //  }

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

        var isexpress = false;
        if (params.is_expressmart && params.is_expressmart == true) {
            isexpress = true;
        }
        var shoppingCart = await strapi.query("shopping-cart").findOne({
            user: userId,
            status: strapi.config.constants.shopping_cart_status.new,
            isexpress: isexpress,
            _sort: "id:desc"
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
        if (_.isNil(checkOutProducts) || checkOutProducts.length == 0) {
            ctx.send({
                success: false,
                message: "The checkout product does not have in shopping cart"
            });

            return;
        }

        var products = [];

        for (let index = 0; index < checkOutProducts.length; index++) {
            const cartItem = checkOutProducts[index];
            products.push({
                product_id: cartItem.product,
                product_variant_id: cartItem.product_variant,
                qtty: cartItem.qtty
            });
        }

        var createOrderRes = await processCheckout(userId,
            products,
            params.is_expressmart,
            params.shipping_prodiver_code,
            params.order_via,
            params.vouchercode,
            params.is_use_coin,
            params.currency,
            shoppingCart.id
        );

        // update checkout
        if (createOrderRes.success) {
            for (let index = 0; index < checkOutProducts.length; index++) {
                const cartItem = checkOutProducts[index];
                cartItem.checkoutid = createOrderRes.checkout_id;
                await strapi.query("shopping-cart-product").update({ id: cartItem.id },
                    cartItem
                );
            }
        }

        ctx.send(createOrderRes);
    },
    createOrder: async(ctx) => {
        // {
        //     "user_address_id": "",
        //     "shipping_note": "",
        //     "checkout_id": 4,
        //     "paymentmethod_id": 4,
        //     "vouchercode": "",
        //     "is_use_coin": true
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

        // get order checkedout
        let ordcheckout = await strapi.query("order-checkout").findOne({
            id: params.checkout_id,
            checkoutstatus: strapi.config.constants.shopping_cart_status.new
        });

        if (_.isNil(ordcheckout)) {
            ctx.send({
                success: false,
                message: "No product for checkout"
            });
            return;
        }
        // get Shoping cartitem
        /*
        var shoppingCart = await strapi.query("shopping-cart").findOne({
            id : ordcheckout.shopping_cart,
            user: userId,
            status: strapi.config.constants.shopping_cart_status.new,
            isexpress: ordcheckout.isexpress,
            _sort: "id:desc"
        }); */
        //console.log("ordercheckout: " + ordcheckout);
        var shoppingCart = await strapi.query("shopping-cart").findOne({
            id: ordcheckout.shopping_cart.id
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

        // get checkout products
        let checkOutProducts = shoppingCart.shopping_cart_products.filter(s => s.checkoutid == params.checkout_id);
        if (_.isNil(checkOutProducts) || checkOutProducts.length == 0) {
            ctx.send({
                success: false,
                message: "The checkout product does not have in shopping cart"
            });

            return;
        }

        var products = [];
        //console.log(`checkOutProducts`, checkOutProducts);
        for (let index = 0; index < checkOutProducts.length; index++) {
            const cartItem = checkOutProducts[index];
            products.push({
                product_id: cartItem.product,
                product_variant_id: cartItem.product_variant,
                qtty: cartItem.qtty
            });
        }

        var createOrderRes = await processCreateOrder(userId,
            products,
            ordcheckout.is_expressmart,
            params.user_address_id,
            ordcheckout.order_via,
            params.vouchercode,
            params.is_use_coin,
            params.shipping_note,
            ordcheckout.currency,
            params.paymentmethod_id
        );

        if (createOrderRes.success) {
            for (let index = 0; index < checkOutProducts.length; index++) {
                const cartItem = checkOutProducts[index];
                strapi.query("shopping-cart-product").delete({ id: cartItem.id });
            }
            // delete ordercheckout
            await strapi.query("order-checkout").delete({ id: params.checkout_id });
        }

        ctx.send(createOrderRes);
    },
    getCheckout: async(ctx) => {

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

        // get current checkoutId
        let ordcheckout = await strapi.query("order-checkout").findOne({
            user: userId,
            checkoutstatus: strapi.config.constants.shopping_cart_status.new,
            _sort: "id:desc"
        });


        if (_.isNil(ordcheckout)) {
            ctx.send({
                success: false,
                message: "Not have any checkout"
            });
            return;
        }

        // get shopping cart
        let shoppingCart = await strapi.query("shopping-cart").findOne({
            id: ordcheckout.shopping_cart.id
        });
        if (_.isNil(shoppingCart.shopping_cart_products)) {
            ctx.send({
                success: false,
                message: "Shopping cart is empty"
            });

            return;
        }

        let cartItemsCk = await strapi.services.product.getProductOfShoppingCartOneCheckOut(shoppingCart, ordcheckout.id);
        // get shoppingcart item checked
        //let cartItemsCk = shoppingCart.shopping_cart_products.filter(s => s.checkoutid== ordcheckout.id);
        if (_.isNil(cartItemsCk) || cartItemsCk.length == 0) {
            ctx.send({
                success: false,
                message: "The checkout product does not have in shopping cart"
            });

            return;
        }
        /*
        let cartItems = await strapi.query("shopping-cart-product").find({
            shopping_cart: shoppingCart.id,
            _sort: "id:desc"
        });

        var cartItemsCk = [];
        for (let index = 0; index < cartItems.length; index++) {
            const element = cartItems[index];
            if (element.checkoutid == ordcheckout.id)
            {
                cartItemsCk.push(cartItems[index]);
            }
        }

        if (cartItemsCk.length==0) {
            ctx.send({
                success: false,
                message: "Not have any cartitem has checked out"
            });
            return;
        }
       */
        let cartModel = await strapi.services.common.normalizationResponse(cartItemsCk, ["user"]);
        ctx.send({
            checkout_id: ordcheckout.id,
            currency: ordcheckout.currency,
            vouchercode: ordcheckout.vouchercode,
            is_use_coin: ordcheckout.is_use_coin,
            kkoin_can_use: ordcheckout.coin_used,
            kkoin_earned: ordcheckout.coin_earned,
            shipping_fee: 0,
            totalamount: ordcheckout.total_amount,
            voucher_discount_amt: ordcheckout.voucher_discount_amt,
            cart: Object.values(cartModel)
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

        if (!_.isNil(order.order_shipping)) {
            order.order_shipping.status_label = getShippingStatusLabel(order.order_shipping.status);
        }

        if (!_.isNil(order.order_shipping)) {
            var state = await strapi.query("state").findOne({
                id: order.order_shipping.state
            });

            if (!_.isNil(state)) {
                order.receiver = {
                    full_name: order.order_shipping.full_name,
                    address: order.order_shipping.address,
                    city: order.order_shipping.city,
                    state: !_.isNil(state) ? state.name : '',
                    country: !_.isNil(state) && !_.isNil(state.country) ? state.country.name : '',
                    phone_number: order.order_shipping.phone_number,
                    deliver_note: order.order_shipping.deliver_note,
                    shipping_provider: order.order_shipping.shipping_provider
                }
            }
        }

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

        for (let i = 0; i < res.entities.length; i++) {
            const element = res.entities[i];
            if (!_.isNil(element.order_shipping)) {
                element.order_shipping.status_label = getShippingStatusLabel(element.order_shipping.status);
            }

            let shippintracking = await strapi.query("shipping-tracking").find({
                order_shipping: element.order_shipping.id
            });

            if (!_.isNil(shippintracking)) {
                let modelstrack = await strapi.services.common.normalizationResponse(
                    shippintracking, ["order_shipping"]
                );
                element.order_shipping.tracking = Object.values(modelstrack);
            }
            var state_id = 0;
            if (element.order_shipping && element.order_shipping.state && !_.isNil(element.order_shipping.state)) {
                state_id = element.order_shipping.state;
            }
            var state = await strapi.query("state").findOne({
                id: state_id
            });

            if (!_.isNil(state)) {
                element.receiver = {
                    full_name: element.order_shipping.full_name,
                    address: element.order_shipping.address,
                    city: element.order_shipping.city,
                    state: !_.isNil(state) ? state.name : '',
                    country: !_.isNil(state) && !_.isNil(state.country) ? state.country.name : '',
                    phone_number: element.order_shipping.phone_number,
                    deliver_note: element.order_shipping.deliver_note,
                    shipping_provider: element.order_shipping.shipping_provider
                }
            }
        }

        let models = await strapi.services.common.normalizationResponse(
            res.entities, ["user"]
        );

        ctx.send({
            success: true,
            totalRows: res.totalRows,
            orders: _.values(models)
        });
    },
    getOrderShippingTracking: async(ctx) => {
        let userId = await strapi.services.common.getLoggedUserId(ctx);
        if (_.isNil(userId) || userId == 0) {
            ctx.send({
                success: false,
                message: "Please login to your account"
            });

            return;
        }

        const params = _.assign({}, ctx.request.params, ctx.params);
        var shippingId = params.orderShippingid;

        var entities = await strapi.query("order-shipping").findOne({
            id: shippingId
        });

        if (_.isNil(entities)) {
            ctx.send({
                success: false,
                message: "No data found"
            });
            return;
        }
        /*
        // get shipping tracking
        let shippintracking = await strapi.query("shipping-tracking").find({
            order_shipping: shippingId
        });

        if (!_.isNil(shippintracking)) {
            let modelstrack = await strapi.services.common.normalizationResponse(
                shippintracking, ["order_shipping"]
            );
            entities.tracking = Object.values(modelstrack);
        }
        */
        entities.status_label = getShippingStatusLabel(entities.status);

        var state = await strapi.query("state").findOne({
            id: entities.state.id
        })
        if (!_.isNil(state)) {
            entities.receiver = {
                full_name: entities.full_name,
                address: entities.address,
                city: entities.city,
                state: !_.isNil(state) ? state.name : '',
                country: !_.isNil(state) && !_.isNil(state.country) ? state.country.name : '',
                phone_number: entities.phone_number,
                deliver_note: entities.deliver_note,
                shipping_provider: entities.shipping_provider
            }
        }

        let models = await strapi.services.common.normalizationResponse(
            entities, ["user"]
        );
        ctx.send({
            success: true,
            orders: models
        });
    },

    /// These function using for CMS
    getOrdersByStatus: async(ctx) => {

        let userId = await strapi.services.common.getLoggedUserId(ctx);
        if (_.isNil(userId) || userId == 0) {
            ctx.send({
                success: false,
                message: "Please login to your account"
            });

            return;
        }

        const params = _.assign({}, ctx.request.params, ctx.params);
        const bodyparams = _.assign({}, ctx.request.query, ctx.params);
        let pageIndex = 1,
            pageSize = 10;

        if (!_.isNil(params.page_index) && !_.isNil(params.page_size)) {
            pageIndex = parseInt(params.page_index);
            pageSize = parseInt(params.page_size);
        }
        var orderstatus = bodyparams.orderstatus;

        const searchObject = ctx.request.query;
        var res = await strapi.services.order.getOrdersByStatus(pageIndex, pageSize, orderstatus, searchObject);
        if (_.isNil(res)) {
            ctx.send({
                success: false,
                message: "No data found"
            });

            return;
        }

        for (let i = 0; i < res.entities.length; i++) {
            const element = res.entities[i];
            if (!_.isNil(element.order_shipping)) {
                element.order_shipping.status_label = getShippingStatusLabel(element.order_shipping.status);
            }

            let shippintracking = await strapi.query("shipping-tracking").find({
                order_shipping: element.order_shipping.id
            });

            element.userInfo = {
                userId: element.user.id,
                userName: element.user.username,
                userEmail: element.user.email,
                userContact: element.user.phone
            };
            if (!_.isNil(shippintracking)) {
                let modelstrack = await strapi.services.common.normalizationResponse(
                    shippintracking, ["order_shipping"]
                );
                element.order_shipping.tracking = Object.values(modelstrack);
            }
            var state_id = 0;
            if (element.order_shipping && element.order_shipping.state && !_.isNil(element.order_shipping.state)) {
                state_id = element.order_shipping.state;
            }
            var state = await strapi.query("state").findOne({
                id: state_id
            });

            if (!_.isNil(state)) {
                element.receiver = {
                    full_name: element.order_shipping.full_name,
                    address: element.order_shipping.address,
                    city: element.order_shipping.city,
                    state: !_.isNil(state) ? state.name : '',
                    country: !_.isNil(state) && !_.isNil(state.country) ? state.country.name : '',
                    phone_number: element.order_shipping.phone_number,
                    deliver_note: element.order_shipping.deliver_note,
                    shipping_provider: element.order_shipping.shipping_provider
                }
            }
        }

        let models = await strapi.services.common.normalizationResponse(
            res.entities, ["user"]
        );

        ctx.send({
            success: true,
            totalRows: res.totalRows,
            orders: _.values(models)
        });
    },
    // =========================>
    // Confirm Order
    orderConfirm: async(ctx) => {
        // body params
        // scheduleAt UTC time, not local time
        //{
        // "providerId":"",
        // "orderId":1
        // "scheduleAt":"2020-07-10T07:00:00.000Z"
        //}
        const params = _.assign({}, ctx.request.body, ctx.params);
        // check scheduleAt must greater than current date

        var isafter = moment.utc().isAfter(params.scheduleAt);

        if (isafter) {
            ctx.send({
                success: false,
                message: "Schedule must greater than current date time"
            });
            return;
        }

        // check order status
        var order = await strapi.query("order").findOne({
            id: params.orderId
        });
        if (_.isNil(order)) {
            return ctx.send({
                success: false,
                message: "Can not find order"
            });
        }

        if (order.order_status !== strapi.config.constants.order_status.new) {
            return ctx.send({
                success: false,
                message: "Not allow for this order status"
            });
        }
        // call shipping default Lalamove
        var quotationRes = await strapi.services.lalamoveshippingservice.placeOrder(
            order.order_shipping.user_address,
            order.order_products,
            order.order_shipping.note,
            params.scheduleAt
        );
        if (quotationRes.success) {
            order.order_shipping.shipping_provider = quotationRes.data.shippingProvider;
            order.order_shipping.shipping_ref_number = quotationRes.data.orderRef;

            await strapi.query("order-shipping").update({ id: order.order_shipping.id }, {
                shipping_provider: quotationRes.data.shippingProvider,
                shipping_ref_number: quotationRes.data.orderRef,
                shipping_fee: quotationRes.data.orderRef,
                status: strapi.config.constants.shipping_status.inProvider,
                schedule_at: params.scheduleAt
            });
            // get order detail

            let shipinfo = await strapi.services.lalamoveshippingservice.getOrderDetails(quotationRes.data.orderRef);

            if (!_.isNil(shipinfo) && shipinfo.success) {
                var tracking = {
                    trackingstatus: shipinfo.data.status,
                    description: shipinfo.data.status,
                    sharelink: shipinfo.data.shareLink,
                    amount: shipinfo.data.price.amount,
                    currency: shipinfo.data.price.currency,
                    order_shipping: order.order_shipping.id
                };
                var shippingtrack = await strapi.query("shipping-tracking").create(tracking);
            }

            // update order status to ToShip
            await strapi.query("order").update({ id: order.id }, {
                order_status: strapi.config.constants.order_status.toship
            });
            ctx.send({
                success: true,
                message: "order confirmed"
            });
        } else {
            console.log(quotationRes);
            ctx.send({
                success: false,
                message: quotationRes.message
            });
        }
    }
};