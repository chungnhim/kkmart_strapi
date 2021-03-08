"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */
const { sanitizeEntity } = require("strapi-utils");
const _ = require("lodash");
const axios = require("axios");

const removeAuthorFields = (entity, fields) => {
    let API_ENPOINT = "http://128.199.86.59:1337";
    if (!_.isNil(process.env.API_ENPOINT)) {
        API_ENPOINT = process.env.API_ENPOINT.trim();
    }

    var defaultFields = [
        "created_by",
        "updated_by",
        //"user",
        "formats"
    ];

    if (!_.isNil(fields)) {
        for (let i = 0; i < fields.length; i++) {
            const element = fields[i];
            defaultFields.push(element);
        }
    }

    const sanitizedValue = _.omit(entity, defaultFields);

    _.forEach(sanitizedValue, (value, key) => {
        if (_.isArray(value)) {
            sanitizedValue[key] = value.map(removeAuthorFields);
        } else if (_.isObject(value)) {
            if (key == 'created_at' || key == 'updated_at') {
                if (new Date(value) !== "Invalid Date" && !isNaN(new Date(value))) {
                    if (value == new Date(value).toISOString()) {
                        sanitizedValue[key] = value;
                    }
                }
            } else {
                sanitizedValue[key] = removeAuthorFields(value, fields);
            }
        }

        if (key == 'url') {
            if (value != null && value[0] == '/') {
                sanitizedValue[key] = `${API_ENPOINT}${value}`;
            }
        }
    });

    return sanitizedValue;
};

const getLoggedUserId = async(ctx) => {
    var userId = 0;
    if (ctx.request && ctx.request.header && ctx.request.header.authorization) {
        try {
            const { id, isAdmin = false } = await strapi.plugins[
                "users-permissions"
            ].services.jwt.getToken(ctx);
            userId = id;
        } catch (err) {
            //return handleErrors(ctx, err, 'unauthorized');
        }
    }

    return userId;
}

module.exports = {
    normalizationResponse: async(entity, fields) => {
        //console.log(`fields`, fields);
        return removeAuthorFields(entity, fields);
    },
    getLoggedUserId: async(ctx) => {
        return await getLoggedUserId(ctx);
    }
};