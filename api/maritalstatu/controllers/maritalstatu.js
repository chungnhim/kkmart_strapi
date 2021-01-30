'use strict';
const { sanitizeEntity } = require('strapi-utils');
const _ = require('lodash');
/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */
const removeAuthorFields = (entity) => {
  const sanitizedValue = _.omit(entity, ['created_by', 'updated_by', 'created_at','updated_at','formats']);
  _.forEach(sanitizedValue, (value, key) => {
    if (_.isArray(value)) {
      sanitizedValue[key] = value.map(removeAuthorFields);
    } else if (_.isObject(value)) {
      sanitizedValue[key] = removeAuthorFields(value);
    }
  });

  return sanitizedValue;
};

module.exports = {
	async findOne(ctx) {
    const { id } = ctx.params;

    const entity = await strapi.services.maritalstatu.findOne({ id });
    const sanitizedEntity = sanitizeEntity(entity, { model: strapi.models.maritalstatu });
    return removeAuthorFields(sanitizedEntity);
  },
  async find(ctx) {
    let entities;
    if (ctx.query._q) {
      entities = await strapi.services.maritalstatu.search(ctx.query);
    } else {
      entities = await strapi.services.maritalstatu.find(ctx.query);
    }
    return entities.map(entity => {
      const maritalstatu = sanitizeEntity(entity, {
        model: strapi.models.maritalstatu,
      });
      return removeAuthorFields(maritalstatu);
    });
  },
};
