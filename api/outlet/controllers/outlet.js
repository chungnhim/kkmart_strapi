'use strict';
const { sanitizeEntity } = require('strapi-utils');
const _ = require('lodash');
/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */
const removeAuthorFields = (entity) => {
    const sanitizedValue = _.omit(entity, ['created_by', 'updated_by', 'created_at', 'updated_at', 'formats', 'user']);
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
    getnearme: async ctx => {

        // var u = req.body.username;
        // var p = req.body.password;

        var longitude = parseFloat(ctx.request.body.longitude);
        var latitude = parseFloat(ctx.request.body.latitude);
        var distance = parseFloat(ctx.request.body.distance);
        var distanceLimit = distance / 10000;
        // var longitudefrom = longitude - distanceLimit;
        // var longitudeto = longitude + distanceLimit;

        // var latitudefrom = latitude - distanceLimit;
        // var latitudeto = latitude + distanceLimit;

        //var dataresult = await strapi.query('outlet').find({ latitude_gte: latitudefrom, latitude_lte: latitudeto, longitude_gte: longitudefrom, longitude_lte: longitudeto });
        var arraydata = [];

        var dataresulttest = await strapi.query('outlet').find();
        var dataxxx = Object.values(removeAuthorFields(dataresulttest));
        dataxxx.forEach((item) => {
            var distanceResultdata = getdistance(latitude, longitude, item.latitude, item.longitude, 'K');
            if (distanceResultdata < parseFloat(distance / 1000)) {
                item.distancemeters = distanceResultdata * 1000;
                arraydata.push(item);
            }
        });
        if (arraydata.length > 0) {
            arraydata = arraydata.sort((a, b) =>
                a.distancemeters > b.distancemeters ? 1 : -1
            );
        }
        //console.log(arraydata);
        ctx.send(arraydata);
    },
    getbystate: async ctx => {
        //===get outlet by state		
        var stateid = parseFloat(ctx.request.body.stateid);
        var dataresult = await strapi.query('outlet').find({ state_eq: stateid });
        let data = Object.values(removeAuthorFields(dataresult));
        ctx.send(data);
    },
};

function getdistance(lat1, lon1, lat2, lon2, unit) {
    if ((lat1 == lat2) && (lon1 == lon2)) {
        return 0;
    } else {
        var radlat1 = Math.PI * lat1 / 180;
        var radlat2 = Math.PI * lat2 / 180;
        var theta = lon1 - lon2;
        var radtheta = Math.PI * theta / 180;
        var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
        if (dist > 1) {
            dist = 1;
        }
        dist = Math.acos(dist);
        dist = dist * 180 / Math.PI;
        dist = dist * 60 * 1.1515;
        if (unit == "K") { dist = dist * 1.609344 } //is kilometers   
        if (unit == "N") { dist = dist * 0.8684 } //is nautical miles
        return dist;
    }
}