'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

module.exports = {
    // ==============> This function using for get all user and fill to dropdownlist
    async cmsGetAllGroup(ctx) {
        //ctx.request.body.query
        //console.log(ctx.request.body.query);
        var querystring = `SELECT id, groupname FROM groupcustomers`
        const result = await strapi.connections.default.raw(querystring);
        const rows = result.rows;
        //var dataresult = await strapi.query('outlet').find({ address_contains: ctx.request.body.query });

        //let data = Object.values(removeAuthorFields(dataresult));
        ctx.send(Object.values(rows));

    }
};