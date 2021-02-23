module.exports = ({ env }) => ({
    order_status: {
        new: 1
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
    }
});