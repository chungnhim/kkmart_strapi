'use strict';

/**
 * mobile-user.js controller
 *
 * @description: A set of functions called "actions" for managing Mobile User.
 */
const uuid = require('uuid');
/* eslint-disable no-useless-escape */
const crypto = require('crypto');
const _ = require('lodash');
const grant = require('grant-koa');
const { sanitizeEntity } = require('strapi-utils');
const sgMail = require('@sendgrid/mail');

const emailRegExp = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
const formatError = error => [
  { messages: [{ id: error.id, message: error.message, field: error.field }] },
];

const removeAuthorFields = (entity) => {
  const sanitizedValue = _.omit(entity, ['created_by', 'updated_by', 'created_at', 'updated_at', 'formats', 'deviceinfos', 'transaction_histories', 'outlets', 'role', 'provider', 'confirmed',]);
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
  home: async ctx => {
    //1.promotion list
    var promotionlist = new Array();
    const dailypromotiontypromotioncouponimage = await strapi.query('dailypromotiontype').findOne({
      code: '1010'
    });
    if (dailypromotiontypromotioncouponimage) {
      var dailypromotiontypromotioncouponimagelist = await strapi.query('dailypromotion').model.query(function (qb) {
        qb.where(function () {
          this.where('dailypromotiontype', dailypromotiontypromotioncouponimage.id);
          //this.where('status', 5);
        });
        qb.orderBy('endtime', 'ASC');
      }).fetchAll();
      dailypromotiontypromotioncouponimagelist = dailypromotiontypromotioncouponimagelist.toJSON();

      for (const oneprocess of dailypromotiontypromotioncouponimagelist) {
        var dailypromotionimage = await strapi.query('dailypromotionimage').model.query(function (qb) {
          qb.where(function () {
            this.where('dailypromotionid', oneprocess.id);
          });
        }).fetchAll();
        dailypromotionimage = dailypromotionimage.toJSON();

        var dailypromotiondetailcouponimagelist = await strapi.query('dailypromotiondetail').model.query(function (qb) {
          qb.where(function () {
            this.where('dailypromotion', oneprocess.id);
          });
        }).fetchAll();
        dailypromotiondetailcouponimagelist = dailypromotiondetailcouponimagelist.toJSON();

        if (dailypromotionimage) {
          promotionlist.push(
            {
              id: oneprocess.id,
              name: oneprocess.name,
              description: oneprocess.description,
              introduction: oneprocess.introduction,
              starttime: oneprocess.starttime,
              endtime: oneprocess.endtime,
              dailypromotiontypeid: oneprocess.dailypromotiontype.id,
              dailypromotiontypecode: oneprocess.dailypromotiontype.code,
              imagelist: Object.values(removeAuthorFields(dailypromotionimage)),
              dailypromotiondetail: Object.values(removeAuthorFields(dailypromotiondetailcouponimagelist))
            });
        }
      }
    }
    else {
      return ctx.badRequest(
        null,
        formatError({
          id: 'mobile_home.home.memberexclusive',
          message: 'Can not get daily promotion type.',
        })
      );
    }
    //2.member exclusive
    var memberexclusive = new Array();
    const dailypromotiontypememberexclusive = await strapi.query('dailypromotiontype').findOne({
      code: '5000'
    });
    if (memberexclusive) {
      var dailypromotiontypememberexclusivelist = await strapi.query('dailypromotion').model.query(function (qb) {
        qb.where(function () {
          this.where('dailypromotiontype', dailypromotiontypememberexclusive.id);
          //this.where('status', 5);
        });
        qb.orderBy('endtime', 'ASC');
      }).fetchAll();
      dailypromotiontypememberexclusivelist = dailypromotiontypememberexclusivelist.toJSON();

      for (const oneprocess of dailypromotiontypememberexclusivelist) {
        var dailypromotionimage = await strapi.query('dailypromotionimage').model.query(function (qb) {
          qb.where(function () {
            this.where('dailypromotionid', oneprocess.id);
          });
        }).fetchAll();
        dailypromotionimage = dailypromotionimage.toJSON();
        if (dailypromotionimage) {
          memberexclusive.push(
            {
              id: oneprocess.id,
              name: oneprocess.name,
              description: oneprocess.description,
              introduction: oneprocess.introduction,
              starttime: oneprocess.starttime,
              endtime: oneprocess.endtime,
              dailypromotiontypeid: oneprocess.dailypromotiontype.id,
              dailypromotiontypecode: oneprocess.dailypromotiontype.code,
              imagelist: Object.values(removeAuthorFields(dailypromotionimage))
            });
        }
      }
    }
    else {
      return ctx.badRequest(
        null,
        formatError({
          id: 'mobile_home.home.memberexclusive',
          message: 'Can not get daily promotion type.',
        })
      );
    }
    //3.new launch  product
    var newlaunchproduct = new Array();
    const dailypromotiontypenewlaunch = await strapi.query('dailypromotiontype').findOne({
      code: '2000'
    });
    if (dailypromotiontypenewlaunch) {
      var dailypromotiontypenewlaunchlist = await strapi.query('dailypromotion').model.query(function (qb) {
        qb.where(function () {
          this.where('dailypromotiontype', dailypromotiontypenewlaunch.id);
          //this.where('status', 5);
        });
        qb.orderBy('endtime', 'ASC');
      }).fetchAll();
      dailypromotiontypenewlaunchlist = dailypromotiontypenewlaunchlist.toJSON();

      for (const oneprocess of dailypromotiontypenewlaunchlist) {
        var dailypromotionimage = await strapi.query('dailypromotionimage').model.query(function (qb) {
          qb.where(function () {
            this.where('dailypromotionid', oneprocess.id);
          });
        }).fetchAll();
        dailypromotionimage = dailypromotionimage.toJSON();

        var dailypromotiondetailnewlaunch = await strapi.query('dailypromotiondetailnewlaunch').model.query(function (qb) {
          qb.where(function () {
            this.where('dailypromotionid', oneprocess.id);
          });
        }).fetchAll();
        dailypromotiondetailnewlaunch = dailypromotiondetailnewlaunch.toJSON();
        if (dailypromotionimage) {
          newlaunchproduct.push(
            {
              id: oneprocess.id,
              name: oneprocess.name,
              description: oneprocess.description,
              introduction: oneprocess.introduction,
              starttime: oneprocess.starttime,
              endtime: oneprocess.endtime,
              dailypromotiontypeid: oneprocess.dailypromotiontype.id,
              dailypromotiontypecode: oneprocess.dailypromotiontype.code,
              imagelist: Object.values(removeAuthorFields(dailypromotionimage)),
              productlist: Object.values(removeAuthorFields(dailypromotiondetailnewlaunch))
            });
        }
      }
    }
    else {
      return ctx.badRequest(
        null,
        formatError({
          id: 'mobile_home.home.newlaunchproduct',
          message: 'Can not get daily promotion type.',
        })
      );
    }
    //4.new outlet
    const dailypromotiontypenewoutlet = await strapi.query('dailypromotiontype').findOne({
      code: '3000'
    });
    if (dailypromotiontypenewoutlet) {
      var newoutlet = await strapi.query('dailypromotion').model.query(function (qb) {
        qb.where(function () {
          this.where('dailypromotiontype', dailypromotiontypenewoutlet.id);
          //this.where('status', 5);
        });
        qb.orderBy('endtime', 'ASC');
      }).fetchAll();
      newoutlet = newoutlet.toJSON();
      var newoutletlist = new Array();
      for (const oneoutlet of newoutlet) {
        var dailypromotionimage = await strapi.query('dailypromotionimage').model.query(function (qb) {
          qb.where(function () {
            this.where('dailypromotionid', oneoutlet.id);
          });
        }).fetchAll();
        dailypromotionimage = dailypromotionimage.toJSON();

        var dailypromotiondetailoulet = await strapi.query('dailypromotiondetailoulet').model.query(function (qb) {
          qb.where(function () {
            this.where('dailypromotionid', oneoutlet.id);
          });
        }).fetchAll();
        dailypromotiondetailoulet = dailypromotiondetailoulet.toJSON();
        if (dailypromotionimage) {
          newoutletlist.push(
            {
              id: oneoutlet.id,
              name: oneoutlet.name,
              description: oneoutlet.description,
              introduction: oneoutlet.introduction,
              starttime: oneoutlet.starttime,
              endtime: oneoutlet.endtime,
              dailypromotiontypeid: oneoutlet.dailypromotiontype.id,
              dailypromotiontypecode: oneoutlet.dailypromotiontype.code,
              imagelist: Object.values(removeAuthorFields(dailypromotionimage)),
              productlist: Object.values(removeAuthorFields(dailypromotiondetailoulet))
            });
        }
      }

    }
    else {
      return ctx.badRequest(
        null,
        formatError({
          id: 'mobile_home.home.outlet',
          message: 'Can not get daily promotion type.',
        })
      );
    }
    var objectresult =
    {
      promotion: Object.values(removeAuthorFields(promotionlist)),
      memberexclusive: Object.values(removeAuthorFields(memberexclusive)),
      newoutlet: Object.values(removeAuthorFields(newoutletlist)),
      newlaunchproduct: Object.values(removeAuthorFields(newlaunchproduct))
    };
    ctx.send({
      id: 'success',
      message: 'success',
      promotiondetail: objectresult,
    });
  },
  promotionList: async ctx => {
    //1.promotion list
    var promotionlist = new Array();
    const dailypromotiontypromotioncouponimage = await strapi.query('dailypromotiontype').findOne({
      code: '1010'
    });
    if (dailypromotiontypromotioncouponimage) {
      var dailypromotiontypromotioncouponimagelist = await strapi.query('dailypromotion').model.query(function (qb) {
        qb.where(function () {
          this.where('dailypromotiontype', dailypromotiontypromotioncouponimage.id);
          //this.where('status', 5);
        });
        qb.orderBy('endtime', 'ASC');
      }).fetchAll();
      dailypromotiontypromotioncouponimagelist = dailypromotiontypromotioncouponimagelist.toJSON();

      for (const oneprocess of dailypromotiontypromotioncouponimagelist) {
        var dailypromotionimage = await strapi.query('dailypromotionimage').model.query(function (qb) {
          qb.where(function () {
            this.where('dailypromotionid', oneprocess.id);
          });
        }).fetchAll();
        dailypromotionimage = dailypromotionimage.toJSON();

        var dailypromotiondetailcouponimagelist = await strapi.query('dailypromotiondetail').model.query(function (qb) {
          qb.where(function () {
            this.where('dailypromotion', oneprocess.id);
          });
        }).fetchAll();
        dailypromotiondetailcouponimagelist = dailypromotiondetailcouponimagelist.toJSON();

        if (dailypromotionimage) {
          promotionlist.push(
            {
              id: oneprocess.id,
              name: oneprocess.name,
              description: oneprocess.description,
              introduction: oneprocess.introduction,
              starttime: oneprocess.starttime,
              endtime: oneprocess.endtime,
              dailypromotiontypeid: oneprocess.dailypromotiontype.id,
              dailypromotiontypecode: oneprocess.dailypromotiontype.code,
              imagelist: Object.values(removeAuthorFields(dailypromotionimage)),
              dailypromotiondetail: Object.values(removeAuthorFields(dailypromotiondetailcouponimagelist))
            });
        }
      }
    }
    else {
      return ctx.badRequest(
        null,
        formatError({
          id: 'mobile_home.home.memberexclusive',
          message: 'Can not get daily promotion type.',
        })
      );
    }
    ctx.send({
      id: 'success',
      message: 'success',
      promotiondetail: Object.values(removeAuthorFields(promotionlist)),
    });
  },
  newMemberExclusiveList: async ctx => {
    var memberexclusive = new Array();
    const dailypromotiontypememberexclusive = await strapi.query('dailypromotiontype').findOne({
      code: '5000'
    });
    if (memberexclusive) {
      var dailypromotiontypememberexclusivelist = await strapi.query('dailypromotion').model.query(function (qb) {
        qb.where(function () {
          this.where('dailypromotiontype', dailypromotiontypememberexclusive.id);
          //this.where('status', 5);
        });
        qb.orderBy('endtime', 'ASC');
      }).fetchAll();
      dailypromotiontypememberexclusivelist = dailypromotiontypememberexclusivelist.toJSON();

      for (const oneprocess of dailypromotiontypememberexclusivelist) {
        var dailypromotionimage = await strapi.query('dailypromotionimage').model.query(function (qb) {
          qb.where(function () {
            this.where('dailypromotionid', oneprocess.id);
          });
        }).fetchAll();
        dailypromotionimage = dailypromotionimage.toJSON();
        if (dailypromotionimage) {
          memberexclusive.push(
            {
              id: oneprocess.id,
              name: oneprocess.name,
              description: oneprocess.description,
              introduction: oneprocess.introduction,
              starttime: oneprocess.starttime,
              endtime: oneprocess.endtime,
              dailypromotiontypeid: oneprocess.dailypromotiontype.id,
              dailypromotiontypecode: oneprocess.dailypromotiontype.code,
              imagelist: Object.values(removeAuthorFields(dailypromotionimage))
            });
        }
      }
    }
    else {
      return ctx.badRequest(
        null,
        formatError({
          id: 'mobile_home.home.memberexclusive',
          message: 'Can not get daily promotion type.',
        })
      );
    }
    ctx.send({
      id: 'success',
      message: 'success',
      promotiondetail: Object.values(removeAuthorFields(memberexclusive)),
    });
  },
  newLaunchProductList: async ctx => {
    //3.new launch  product
    const dailypromotiontypenewlaunch = await strapi.query('dailypromotiontype').findOne({
      code: '2000'
    });
    var newlaunchproduct = new Array();
    if (dailypromotiontypenewlaunch) {
      var dailypromotiontypenewlaunchlist = await strapi.query('dailypromotion').model.query(function (qb) {
        qb.where(function () {
          this.where('dailypromotiontype', dailypromotiontypenewlaunch.id);
          //this.where('status', 5);
        });
        qb.orderBy('endtime', 'ASC');
      }).fetchAll();
      dailypromotiontypenewlaunchlist = dailypromotiontypenewlaunchlist.toJSON();

      for (const oneprocess of dailypromotiontypenewlaunchlist) {
        var dailypromotionimage = await strapi.query('dailypromotionimage').model.query(function (qb) {
          qb.where(function () {
            this.where('dailypromotionid', oneprocess.id);
          });
        }).fetchAll();
        dailypromotionimage = dailypromotionimage.toJSON();

        var dailypromotiondetailnewlaunch = await strapi.query('dailypromotiondetailnewlaunch').model.query(function (qb) {
          qb.where(function () {
            this.where('dailypromotionid', oneprocess.id);
          });
        }).fetchAll();
        dailypromotiondetailnewlaunch = dailypromotiondetailnewlaunch.toJSON();
        if (dailypromotionimage) {
          newlaunchproduct.push(
            {
              id: oneprocess.id,
              name: oneprocess.name,
              description: oneprocess.description,
              introduction: oneprocess.introduction,
              starttime: oneprocess.starttime,
              endtime: oneprocess.endtime,
              dailypromotiontypeid: oneprocess.dailypromotiontype.id,
              dailypromotiontypecode: oneprocess.dailypromotiontype.code,
              imagelist: Object.values(removeAuthorFields(dailypromotionimage)),
              productlist: Object.values(removeAuthorFields(dailypromotiondetailnewlaunch))
            });
        }
      }
    }
    else {
      return ctx.badRequest(
        null,
        formatError({
          id: 'mobile_home.home.newlaunchproduct',
          message: 'Can not get daily promotion type.',
        })
      );
    }
    ctx.send({
      id: 'success',
      message: 'success',
      promotiondetail: Object.values(removeAuthorFields(newlaunchproduct)),
    });
  },
  newOutletList: async ctx => {
    //4.new outlet
    const dailypromotiontypenewoutlet = await strapi.query('dailypromotiontype').findOne({
      code: '3000'
    });
    var newoutletlist = new Array();
    if (dailypromotiontypenewoutlet) {
      var newoutlet = await strapi.query('dailypromotion').model.query(function (qb) {
        qb.where(function () {
          this.where('dailypromotiontype', dailypromotiontypenewoutlet.id);
          //this.where('status', 5);
        });
        qb.orderBy('endtime', 'ASC');
      }).fetchAll();
      newoutlet = newoutlet.toJSON();
      for (const oneoutlet of newoutlet) {
        var dailypromotionimage = await strapi.query('dailypromotionimage').model.query(function (qb) {
          qb.where(function () {
            this.where('dailypromotionid', oneoutlet.id);
          });
        }).fetchAll();
        dailypromotionimage = dailypromotionimage.toJSON();

        var dailypromotiondetailoulet = await strapi.query('dailypromotiondetailoulet').model.query(function (qb) {
          qb.where(function () {
            this.where('dailypromotionid', oneoutlet.id);
          });
        }).fetchAll();
        dailypromotiondetailoulet = dailypromotiondetailoulet.toJSON();
        if (dailypromotionimage) {
          newoutletlist.push(
            {
              id: oneoutlet.id,
              name: oneoutlet.name,
              description: oneoutlet.description,
              introduction: oneoutlet.introduction,
              starttime: oneoutlet.starttime,
              endtime: oneoutlet.endtime,
              dailypromotiontypeid: oneoutlet.dailypromotiontype.id,
              dailypromotiontypecode: oneoutlet.dailypromotiontype.code,
              imagelist: Object.values(removeAuthorFields(dailypromotionimage)),
              productlist: Object.values(removeAuthorFields(dailypromotiondetailoulet))
            });
        }
      }

    }
    else {
      return ctx.badRequest(
        null,
        formatError({
          id: 'mobile_home.home.outlet',
          message: 'Can not get daily promotion type.',
        })
      );
    }
    ctx.send({
      id: 'success',
      message: 'success',
      promotiondetail: Object.values(removeAuthorFields(newoutletlist)),
    });
  }
};

