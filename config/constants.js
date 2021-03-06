module.exports = ({ env }) => ({
    order_status: {
        new: 1,
        toship: 2,
        toreceived: 3,
        completed: 4,
        canceled: 5,
        returned: 6
    },
    shipping_status: {
        new: 1,
        inProvider: 2,
        onDelivery: 3,
        completed: 4,
        cancelled: 5
    },
    order_payment_status: {
        new: 1,
        processing: 2,
        pendingpayment: 3,
        paymentsuccess: 4,
        paymentfail: 5,
        cancelled: 6,
        refunded: 7
    },
    shopping_cart_status: {
        new: 1,
        paid: 2,
        cancelled: 3
    },
    promotion_types_status: {
        discount_money: 1,
        discount_percent: 2,
        fix_money: 3
    },
    promotion_apply_types_status: {
        group_products: 1,
        products: 2,
        variants: 3
    },
    promotion_apply_for_status: {
        total_products: 1,
        total_money: 2,
    },
    flashsale_types_status: {
        discount_money: 1,
        discount_percent: 2,
        fix_money: 3
    },
    flashsale_apply_types_status: {
        group_products: 1,
        products: 2,
        variants: 3
    },
    flashsale_apply_for_status: {
        total_products: 1,
        total_money: 2,
    },
    voucher_type: {
        discount_fixed_money: 1,
        discount_percent: 2,
        same_price: 3,
        free_ship: 4
    },
    voucher_apply_condition: {
        min_product_qtty: 1,
        min_totalamount: 2
    },
    voucher_object_apply_type: {
        all_users: 1,
        group_users: 2,
        specific_users: 3
    },
    voucher_status: {
        activated: 1,
        closed: 2
    },
    coin_payment_transact_status: {
        new: 1,
        completed: 2,
        error: 3
    },
    outlet_status: {
        active: 1,
        relocated: 2
    },
    pushnotification_status: {
        new: 0,
        active: 1,
        closed: 2
    },
    pushnotification_customertype: {
        personal: 0,
        groupcustomer: 1,
        allcustomer: 2
    },
    trxconfig_credit_type: {
        fixed_money: 0,
        percent: 1
    }

});