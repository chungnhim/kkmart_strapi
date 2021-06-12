'use strict';
const { sanitizeEntity } = require('strapi-utils');
const _ = require('lodash');
const NodeGeocoder = require('node-geocoder');
/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */
const removeAuthorFields = (entity) => {
    const sanitizedValue = _.omit(entity, ['created_by', 'updated_by', 'created_at', 'updated_at', 'formats', 'user', 'users', 'coinpaymenttransacts']);
    _.forEach(sanitizedValue, (value, key) => {
        if (_.isArray(value)) {
            sanitizedValue[key] = value.map(removeAuthorFields);
        } else if (_.isObject(value)) {
            sanitizedValue[key] = removeAuthorFields(value);
        }
    });

    return sanitizedValue;
};
const getLngLat = async(address) => {
    const options = {
        provider: 'here',
        apiKey: process.env.HERE_API_KEY || 'b_tw_a6m371Kris1qsOWLzhA2jerXM2A8BP8eNwiK4o', // for Mapquest, OpenCage, Google Premier, Here
        formatter: null // 'gpx', 'string', ...
    };

    const geocoder = NodeGeocoder(options);

    const mapForPickup = await geocoder.geocode(address);
    if (_.isNil(mapForPickup) || mapForPickup.length == 0) {
        return {
            latitude: 0,
            longitude: 0
        };
    }

    return {
        latitude: mapForPickup[0].latitude,
        longitude: mapForPickup[0].longitude
    };
};
module.exports = {
    getnearme: async ctx => {
        var res = await strapi.services.outlet.getNearMe(ctx.request.body.longitude,
            ctx.request.body.latitude,
            ctx.request.body.distance);

        ctx.send(res);
    },
    getbystate: async ctx => {
        //===get outlet by state		
        var stateid = parseFloat(ctx.request.body.stateid);
        var dataresult = await strapi.query('outlet').find({ state_eq: stateid });
        let data = Object.values(removeAuthorFields(dataresult));
        ctx.send(data);
    },
    searchoutlet: async ctx => {
        //ctx.request.body.query
        //console.log(ctx.request.body.query);
        var querystring = `select * from searchoutlets('${ctx.request.body.query}')`
        const result = await strapi.connections.default.raw(querystring);
        const rows = result.rows;
        //var dataresult = await strapi.query('outlet').find({ address_contains: ctx.request.body.query });

        //let data = Object.values(removeAuthorFields(dataresult));
        ctx.send(rows);
    },
    addNewOutlet: async(ctx) => {

        const params = _.assign({}, ctx.request.body, ctx.params);

        var mobileuserid = params.mobileuserid;
        if (ctx.request && ctx.request.header && ctx.request.header.authorization) {
            try {
                const { id, isAdmin = false } = await strapi.plugins['users-permissions'].services.jwt.getToken(ctx);
                if (mobileuserid != id) {
                    return ctx.send({
                        success: false,
                        id: '5',
                        message: 'This login token is not match with Mobile User Id'
                    });
                }
                var usercheck = await strapi.query('user', 'users-permissions').findOne({ id: mobileuserid });
                if (usercheck.role.id !== 1) {
                    return ctx.badRequest(
                        null,
                        formatError({
                            id: '5.1',
                            message: 'You have not administrator permission.',
                        })
                    );
                }

            } catch (err) {
                return strapi.services.common.handleErrors(ctx, err, 'unauthorized');
            }
        }

        if (_.isNil(params.name)) {
            return ctx.send({
                success: false,
                id: '100',
                message: 'Outlet name can not be null'
            });
        };

        if (_.isNil(params.telephone) || (params.telephone === "")) {
            return ctx.send({
                success: false,
                id: '101',
                message: 'Outlet telephone can not be null'
            });
        }

        if (_.isNil(params.address)) {
            return ctx.send({
                success: false,
                id: '102',
                message: 'Outlet address can not be null'
            });
        }

        // get long lat
        let lngLat = await getLngLat(params.address);
        let lng = lngLat.longitude;
        let latt = lngLat.latitude;

        // check duplicate outletno
        let outlets = await strapi.query("outlet").findOne({
            name: params.name,
            address: params.address
        });

        if (!_.isNil(outlets)) {
            return ctx.send({
                success: false,
                id: '103',
                message: "Duplicate outlets"
            });
        }
        /*
        // get state
        let state = await strapi.query("state").findOne({
            name_contains: params.state
        });
        // get country        
        let country = await strapi.query("country").findOne({
            name_contains: params.country
        });
        */
        let entity = {
            name: params.name,
            street1: params.address,
            street2: params.address,
            address: params.address,
            longitude: lng,
            latitude: latt,
            country: params.country,
            state: params.state,
            telephone: params.telephone,
            digi: params.mobilephone,
            outletno: params.outletno,
            postcode: params.postcode,
            city: params.city,
            status: params.status
        }

        let outlet = await strapi.query("outlet").create(entity);

        ctx.send({
            success: true,
            message: outlet
        });
    }
};