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
        "user",
        "formats",
        "created_at",
        "updated_at"
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
            sanitizedValue[key] = removeAuthorFields(value, fields);
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
    normalizationResponse: async (entity, fields) => {
        return removeAuthorFields(entity, fields);
    },
};