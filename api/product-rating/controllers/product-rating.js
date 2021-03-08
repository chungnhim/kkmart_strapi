'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */
const _ = require("lodash");

module.exports = {
    productRating: async(ctx) => {
        var userId = 0;
        if (ctx.request && ctx.request.header && ctx.request.header.authorization) {
            try {
                const { id, isAdmin = false } = await strapi.plugins[
                    "users-permissions"
                ].services.jwt.getToken(ctx);
                userId = id;

                console.log(`userId`, userId);
            } catch (err) {}
        }

        if (userId == 0) {
            ctx.unauthorized(`You're not logged in!`);

            return;
        }

        const body = _.assign({}, ctx.request.body, ctx.params);
        var entity = {
            rating_point: parseFloat(body.rating_point),
            comment: body.comment,
            user: userId,
            product: parseFloat(body.product_id),
            status: 1
        };

        var res = await strapi.query('product-rating').create(entity);
        if (_.isNil(res) && _.isNil(res.id)) {
            ctx.send({
                message: "Rating has been failed",
                success: false
            });

            return;
        }

        var productRatings = await strapi.query('product-rating').find({
            product: parseFloat(body.product_id)
        });

        var totalRating = _.sumBy(productRatings, "rating_point")
        var avgRating = Number(parseFloat(totalRating / productRatings.length).toFixed(1));

        await strapi.query('product').update({ id: parseFloat(body.product_id) }, { rating_point: avgRating });

        ctx.send({
            message: "Rating has been saved",
            success: true
        });
    },
    getRatingsByProductId: async(ctx) => {
        const queryString = _.assign({}, ctx.request.query, ctx.params);
        const params = _.assign({}, ctx.request.params, ctx.params);

        let pageIndex = 1,
            pageSize = 10;

        if (!_.isNil(params.page_index) && !_.isNil(params.page_size)) {
            pageIndex = parseInt(params.page_index);
            pageSize = parseInt(params.page_size);
        }

        var productId = queryString.product_id;
        if (_.isNil(productId)) {
            var res = {
                totalRows: 0,
                source: []
            };
        }

        var dataQuery = {
            product: productId,
            _start: (pageIndex - 1) * pageSize,
            _limit: pageSize,
            _sort: "created_at:desc",
        };

        var totalRows = await strapi.query('product-rating').count(dataQuery);
        var entities = await strapi.query("product-rating").find(dataQuery);

        //console.log(entities);

        let models = await strapi.services.common.normalizationResponse(
            entities, ["product", "password", "provider", "resetPasswordToken", "confirmed", "blocked", "role", "created_at", "updated_at", "phone", "dateofbirth", "gender", "kcoin", "maritalstatus", "referralcode", "companyname", "promotionrewardpoint", "nonpromotionalrewardpoint", "membershiptype", "Address1", "Address2", "country", "state", "city", "postcode", "ethnicgroup", "qrcode", "maritalstatuother", "personalinterestother", "employmentstatuother", "socialmediaactivestatuother", "address1", "address2", "iscompleteinformation", "preferredname", "friendcode"]
        );

        var res = {
            totalRows,
            source: _.values(models)
        };

        ctx.send(res);
    }
};