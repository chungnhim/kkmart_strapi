'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

const _ = require("lodash");
const formatError = error => [
    { messages: [{ id: error.id, message: error.message, field: error.field }] },
];

const calculateKkoin = async(shoppingCartProducts) => {
    var totalCoin = 0;
    if (shoppingCartProducts) {
        shoppingCartProducts.forEach(item => {
            let product = item.product;
            if (!_.isNil(product.product_variants) && product.product_variants.length > 0) {
                totalCoin += product.product_variants[0].coin_use * item.qtty;
            } else {
                if (!_.isNil(product.can_use_coin) && product.can_use_coin == true) {
                    totalCoin += product.coin_use * item.qtty;
                }
            }
        });
    }

    return totalCoin;
}

module.exports = {
    getByUserId: async(ctx) => {
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
        const queryString = _.assign({}, ctx.request.query, ctx.params);
        //const params = _.assign({}, ctx.request.body, ctx.params);
        var isexpress = false;

        if (!_.isNil(queryString.isexpress) && queryString.isexpress == 'true') {
            isexpress = true;
        }

        ////console.log(params.isexpress);      

        var shoppingCart = await strapi.query("shopping-cart").findOne({
            user: userId,
            status: strapi.config.constants.shopping_cart_status.new,
            isexpress: isexpress,
            _sort: "id:desc"
        });

        //Bổ sung thêm tham số isexpress
        if (!_.isNil(shoppingCart)) {
            shoppingCart = await strapi.services.product.getProductOfShoppingCartOne(shoppingCart);

            let cartModel = await strapi.services.common.normalizationResponse(shoppingCart, ["user"]);

            let kkoin = await calculateKkoin(cartModel.shopping_cart_products);

            ctx.send({
                success: true,
                cart: cartModel,
                kkoin_can_use: kkoin,
                shipping_fee: 0
            });
        } else {

            ctx.send({
                success: true,
                cart: null,
                kkoin_can_use: 0,
                shipping_fee: 0
            });
        }

    },
    addProductToCart: async(ctx) => {
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

        var isexpress = false;

        const params = _.assign({}, ctx.request.body, ctx.params);

        let productId = params.product_id;
        let productVariantId = params.product_variant_id;
        let qtty = params.qtty;
        let shoppingCartId = params.shopping_cart_id == null ? 0 : params.shopping_cart_id;
        //Get info of product and check isexpress of product
        var productInfo = await strapi.query("product").findOne({ id: productId });
        if (!_.isNil(productInfo)) {
            ////console.log(productInfo);
            if (!_.isNil(productInfo.isexpress)) {
                isexpress = productInfo.isexpress;
            }
        }
        ////console.log(productInfo);
        var shoppingCart = await strapi.query("shopping-cart").findOne({
            id: shoppingCartId,
            user: userId,
            isexpress: isexpress
        });

        //Get cart newest of user
        if (_.isNil(shoppingCart)) {
            shoppingCart = await strapi.query("shopping-cart").findOne({
                user: userId,
                status: strapi.config.constants.shopping_cart_status.new,
                isexpress: isexpress,
                _sort: "id:desc"
            });
        }

        if (_.isNil(shoppingCart)) {
            var cartEntity = {
                status: strapi.config.constants.shopping_cart_status.new,
                isexpress: isexpress
            };

            if (userId != 0) {
                cartEntity.user = userId;
            }

            shoppingCart = await strapi.query("shopping-cart").create(cartEntity);
        } else {
            if (userId != 0) {
                shoppingCart.user = userId;
            }

            shoppingCart = await strapi.query("shopping-cart").update({ id: shoppingCart.id }, shoppingCart);
        }

        if (_.isNil(shoppingCart)) {
            ctx.send({
                success: false,
                message: "Cannot add the item to shopping cart"
            });

            return;
        }

        let product = await strapi.services.product.getProductById(productId);
        if (_.isNil(product)) {
            ctx.send({
                success: false,
                message: "Product does not exists"
            });

            return;
        }

        var shoppingCartProduct = null;
        var variant = product.product_variants.find(s => s.id == productVariantId);
        if (_.isNil(variant)) {
            ctx.send({
                success: false,
                message: "variant of Product does not exists"
            });

            return;
        }

        var existsProduct = shoppingCart.shopping_cart_products.find(s => s.product == productId && s.product_variant == productVariantId);
        ////console.log(`existsProduct`, existsProduct);

        if (_.isNil(existsProduct)) {
            // Case add new item to cart            
            shoppingCartProduct = await strapi.query("shopping-cart-product").create({
                shopping_cart: shoppingCart.id,
                product: productId,
                product_variant: productVariantId,
                qtty: qtty,
                origin_price: variant.price,
                selling_price: variant.selling_price
            });
        } else {
            // Case update qtty of an existing item
            existsProduct.qtty = existsProduct.qtty + qtty;
            shoppingCartProduct = await strapi.query("shopping-cart-product").update({ id: existsProduct.id },
                existsProduct
            );
        }

        if (_.isNil(shoppingCartProduct)) {
            ctx.send({
                success: false,
                message: "Cannot add the item to shopping cart"
            });

            return;
        }

        ctx.send({
            success: true,
            message: "Add the item to shopping cart successfully",
            cart_id: shoppingCart.id
        });
    },
    updateProductToCart: async(ctx) => {
        // {
        //     "cart_items": [
        //         {
        //             "cart_item_id": 2,
        //             "checkout": true,
        //             "qtty": 2
        //         }
        //     ],        
        //     "vouchercode": "YTGTUI"
        // }

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

        const params = _.assign({}, ctx.request.body, ctx.params);
        var isexpress = false;

        if (!_.isNil(params.isexpress) && params.isexpress == true) {
            isexpress = true;
        }
        var shoppingCart = await strapi.query("shopping-cart").findOne({
            user: userId,
            status: strapi.config.constants.shopping_cart_status.new,
            isexpress: isexpress,
            _sort: "id:desc"
        });

        //Get info of shopping cart item id

        if (_.isNil(shoppingCart)) {
            var cartEntity = {
                status: strapi.config.constants.shopping_cart_status.new
            };

            if (userId != 0) {
                cartEntity.user = userId;
            }

            shoppingCart = await strapi.query("shopping-cart").create(cartEntity);
        } else {
            if (userId != 0) {
                shoppingCart.user = userId;
            }

            shoppingCart = await strapi.query("shopping-cart").update({ id: shoppingCart.id }, shoppingCart);
        }

        if (_.isNil(shoppingCart)) {
            ctx.send({
                success: false,
                message: "Cannot add the item to shopping cart"
            });

            return;
        }

        let kkoin = 0;
        let totalamount = 0;
        for (let index = 0; index < params.cart_items.length; index++) {
            const element = params.cart_items[index];
            var cartItem = shoppingCart.
            shopping_cart_products.find(s => s.id == element.cart_item_id);
            if (_.isNil(cartItem)) {
                ctx.send({
                    success: false,
                    message: "Cart item does not exists"
                });

                return;
            }
            let product = await strapi.services.product.getProductById(cartItem.product);
            if (_.isNil(product)) {
                ctx.send({
                    success: false,
                    message: "Product does not exists"
                });

                return;
            }

            var shoppingCartProduct = null;
            var variant = product.product_variants.find(s => s.id == cartItem.product_variant);
            if (_.isNil(variant)) {
                ctx.send({
                    success: false,
                    message: "variant of Product does not exists"
                });

                return;
            }

            if (element.checkout && product.can_use_coin == true) {
                if (!_.isNil(product.coin_use) && product.coin_use != 0) {
                    kkoin += product.coin_use * element.qtty;
                } else {
                    kkoin += variant.coin_use * element.qtty;
                }
            }
            let sellingprice = 0;
            ////console.log(product);
            //let sellingproduct = await strapi.services.promotionproduct.priceRecalculationOfProduct(product);
            if (product.ishave_discount_flashsale) {
                sellingprice = product.flashsale_price
            } else if (product.ishave_discount_promotion) {
                sellingprice = product.promotion_price
            } else {
                sellingprice = variant.selling_price
            }

            if (element.checkout) {
                totalamount += sellingprice * element.qtty;
            }
            totalamount = Math.round(totalamount * 100) / 100;
            var existsProduct = shoppingCart.shopping_cart_products.find(s => s.product == cartItem.product && s.product_variant == cartItem.product_variant);
            if (_.isNil(existsProduct)) {
                // Case add new item to cart            
                shoppingCartProduct = await strapi.query("shopping-cart-product").create({
                    shopping_cart: shoppingCart.id,
                    product: cartItem.product,
                    product_variant: cartItem.product_variant,
                    qtty: qtty,
                    origin_price: variant.price,
                    selling_price: variant.selling_price
                });
            } else {
                // Case update qtty of an existing item
                existsProduct.qtty = element.qtty;
                shoppingCartProduct = await strapi.query("shopping-cart-product").update({ id: existsProduct.id },
                    existsProduct
                );
            }

            if (_.isNil(shoppingCartProduct)) {
                ctx.send({
                    success: false,
                    message: "Cannot add the item to shopping cart"
                });

                return;
            }
        };

        ctx.send({
            success: true,
            message: "Update the item to shopping cart successfully",
            cart_id: shoppingCart.id,
            kkoin_can_use: kkoin,
            shipping_fee: 0,
            discount_amount: 0,
            totalamount: totalamount
        });
    },
    getCartById: async(ctx) => {
        const params = _.assign({}, ctx.request.params, ctx.params);

        var shoppingCartId = params.shopping_cart_id;
        var shoppingCart = await strapi.query("shopping-cart").findOne({
            id: shoppingCartId,
        });

        shoppingCart = await strapi.services.product.getProductOfShoppingCartOne(shoppingCart);
        let cartModel = await strapi.services.common.normalizationResponse(shoppingCart, ["user"]);
        let kkoin = await calculateKkoin(cartModel.shopping_cart_products);

        ctx.send({
            success: true,
            cart: cartModel,
            kkoin_can_use: kkoin,
            shipping_fee: 0
        });
    },
    removeCartItem: async(ctx) => {
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

        const params = _.assign({}, ctx.request.params, ctx.params);
        const queryString = _.assign({}, ctx.request.query, ctx.params);
        let cartItemId = params.cart_item_id;

        var isexpress = false;

        if (!_.isNil(queryString.isexpress) && queryString.isexpress == 'true') {
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

        var existsProduct = shoppingCart.shopping_cart_products.find(s => s.id == cartItemId);
        if (_.isNil(existsProduct)) {
            ctx.send({
                success: false,
                message: "Product does not exists in shopping cart"
            });

            return;
        }

        var res = await strapi.query("shopping-cart-product").delete({
            id: cartItemId,
            shopping_cart: shoppingCart.id
        });

        shoppingCart = await strapi.query("shopping-cart").findOne({
            user: userId,
            status: strapi.config.constants.shopping_cart_status.new,
            _sort: "id:desc"
        });

        ctx.send({
            success: true,
            message: "Cart item has been remove successfully"
        });

        return;
    }
};