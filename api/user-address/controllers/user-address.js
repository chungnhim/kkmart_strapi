'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

const _ = require("lodash");

module.exports = {
    addUserAddress: async(ctx) => {
        const params = _.assign({}, ctx.request.body, ctx.params);
        let userId = await strapi.services.common.getLoggedUserId(ctx);
        if (_.isNil(userId) || userId == 0) {
            ctx.send({
                success: false,
                message: "Please login to your account"
            });

            return;
        }

        var entity = {
            user: userId,
            country: params.country_id,
            state: params.state_id,
            address1: params.address1,
            address2: params.address2,
            city: params.city,
            postcode: params.postcode,
            phone_number: params.phone_number,
            email_address: params.email_address,
            is_default: params.is_default,
            is_default_billing: params.is_default_billing,
            full_name: params.full_name,
            home_office: params.home_office
        }

        if (params.is_default && params.is_default == true) {
            //set all to none
            var listaddress = await strapi.query("user-address").find({ user: userId });

            for (let index = 0; index < listaddress.length; index++) {
                let objectUpdate = listaddress[index];
                objectUpdate.is_default = false;
                objectUpdate.is_default_billing = false;
                await strapi.query("user-address").update({ id: objectUpdate.id }, objectUpdate);
            }
        }

        var userAddress;
        if (params.id) {
            entity.id = params.id;
            userAddress = await strapi.query("user-address").update({ id: entity.id }, entity);
        } else {
            userAddress = await strapi.query("user-address").create(entity);
        }

        ctx.send({
            success: true,
            message: "Add user address has been successfully",
            user_address_id: userAddress.id
        });
    },
    updateUserAddress: async(ctx) => {
        const params = _.assign({}, ctx.request.body, ctx.params);
        let userId = await strapi.services.common.getLoggedUserId(ctx);
        if (_.isNil(userId) || userId == 0) {
            ctx.send({
                success: false,
                message: "Please login to your account"
            });

            return;
        }

        var entity = {
            user: userId,
            country: params.country_id,
            state: params.state_id,
            address1: params.address1,
            address2: params.address2,
            city: params.city,
            postcode: params.postcode,
            phone_number: params.phone_number,
            email_address: params.email_address,
            is_default: params.is_default,
            is_default_billing: params.is_default_billing,
            full_name: params.full_name,
            home_office: params.home_office
        }

        //check and find user address of exist or not

        var checkUserAddress = await strapi.query('user-address').findOne({ user: userId, id: entity.id });
        if (_.isNil(checkUserAddress)) {
            ctx.send({
                success: false,
                message: "Address of user is not exist!"
            });
            return;
        }

        if (params.is_default && params.is_default == true) {
            //set all to none
            var listaddress = await strapi.query("user-address").find({ user: userId });

            for (let index = 0; index < listaddress.length; index++) {
                let objectUpdate = listaddress[index];
                objectUpdate.is_default = false;
                objectUpdate.is_default_billing = false;
                await strapi.query("user-address").update({ id: objectUpdate.id }, objectUpdate);
            }
        }

        var userAddress;
        if (params.id) {
            entity.id = params.id;
            userAddress = await strapi.query("user-address").update({ id: entity.id }, entity);
        } else {
            userAddress = await strapi.query("user-address").create(entity);
        }

        ctx.send({
            success: true,
            message: "Add user address has been successfully",
            user_address_id: userAddress.id
        });
    },
    getUserAddress: async(ctx) => {
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

        var dataQuery = {
            _start: (pageIndex - 1) * pageSize,
            _limit: pageSize,
            _sort: "created_at:desc",
            user: userId
        };

        var totalRows = await strapi.query('user-address').count(dataQuery);
        var entities = await strapi.query("user-address").find(dataQuery);

        let models = await strapi.services.common.normalizationResponse(
            entities, ["user", "created_at", "updated_at"]
        );

        ctx.send({
            success: true,
            totalRows: totalRows,
            address: _.values(models)
        });
    },
    setDefaultUserAddress: async(ctx) => {
        let userId = await strapi.services.common.getLoggedUserId(ctx);
        if (_.isNil(userId) || userId == 0) {
            ctx.send({
                success: false,
                message: "Please login to your account"
            });

            return;
        }

        const params = _.assign({}, ctx.request.body, ctx.params);

        var dataQuery = {
            id: params.address_id,
            user: userId
        };

        var address = await strapi.query("user-address").findOne(dataQuery);
        if (_.isNil(address)) {
            ctx.send({
                success: false,
                message: "Address does not exists"
            });
            return;
        }

        //set all to none
        var listaddress = await strapi.query("user-address").find({ user: userId });

        for (let index = 0; index < listaddress.length; index++) {
            let objectUpdate = listaddress[index];
            objectUpdate.is_default = false;
            objectUpdate.is_default_billing = false;
            await strapi.query("user-address").update({ id: objectUpdate.id }, objectUpdate);
        }

        address.is_default = true;
        address.is_default_billing = true;
        var res = await strapi.query("user-address").update({ id: params.address_id }, address);

        ctx.send({
            success: true,
            message: "Set default address has been successfully"
        });
    },
    deleteOfUser: async(ctx) => {
        let userId = await strapi.services.common.getLoggedUserId(ctx);
        if (_.isNil(userId) || userId == 0) {
            ctx.send({
                success: false,
                message: "Please login to your account"
            });
            return;
        }

        const params = _.assign({}, ctx.request.params, ctx.params);
        let addressid = params.id;
        var res = await strapi.query("user-address").delete({
            id: addressid,
            user: userId
        });

        ctx.send({
            success: true,
            message: "Address has been remove successfully"
        });

    }
};