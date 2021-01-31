"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */
const { sanitizeEntity } = require("strapi-utils");
const _ = require("lodash");
const axios = require("axios");

const removeAuthorFields = (entity) => {
    let API_ENPOINT = "http://128.199.86.59:1337";
    if (!_.isNil(process.env.API_ENPOINT)) {
        API_ENPOINT = process.env.API_ENPOINT.trim();
    }

    const sanitizedValue = _.omit(entity, [
        "created_by",
        "updated_by",
        "user",
        "formats",
    ]);

    _.forEach(sanitizedValue, (value, key) => {
        if (_.isArray(value)) {
            sanitizedValue[key] = value.map(removeAuthorFields);
        } else if (_.isObject(value)) {
            sanitizedValue[key] = removeAuthorFields(value);
        }

        if (key == 'url') {
            if (value[0] == '/') {
                sanitizedValue[key] = `${API_ENPOINT}${value}`;
            }
        }
    });

    return sanitizedValue;
};

module.exports = {
    normalizationResponse: async(entity) => {
        return removeAuthorFields(entity);
    },
};