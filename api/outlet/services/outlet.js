'use strict';
const _ = require('lodash');

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/services.html#core-services)
 * to customize this service
 */

function getDistance(lat1, lon1, lat2, lon2, unit) {
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

module.exports = {
  getNearMe: async (longitude, latitude, distance) => {
    var longitude = parseFloat(longitude);
    var latitude = parseFloat(latitude);
    var distance = parseFloat(distance);
    var distanceLimit = distance / 10000;
    var arraydata = [];

    var dataresulttest = await strapi.query('outlet').find();
    if (_.isNil(dataresulttest)) {
      return [];
    }

    // var dataxxx = Object.values(removeAuthorFields(dataresulttest));
    let dataxxx = Object.values(await strapi.services.common.normalizationResponse(dataresulttest, []));

    dataxxx.forEach((item) => {
      var distanceResultdata = getDistance(latitude, longitude, item.latitude, item.longitude, 'K');
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

    return arraydata;
  }
};
