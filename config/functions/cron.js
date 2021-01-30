'use strict';
const crypto = require('crypto');
const uuid = require('uuid');
const _ = require('lodash');
const grant = require('grant-koa');
const { sanitizeEntity } = require('strapi-utils');

/**
 * Cron config that gives you an opportunity
 * to run scheduled jobs.
 *
 * The cron format consists of:
 * [SECOND (optional)] [MINUTE] [HOUR] [DAY OF MONTH] [MONTH OF YEAR] [DAY OF WEEK]
 *
 * See more details here: https://strapi.io/documentation/v3.x/concepts/configurations.html#cron-tasks
 */

module.exports = {
  /**
   * Simple example.
   * Every monday at 1am.
   */
  '*/1 * * * *': async() => {
		console.log("Job credit balance");
		var moment = require('moment');
		var startDate = new Date;
		var startDateUTC = moment.utc(startDate);
		var checkCreditAmount = await strapi.query('transaction-history').model.query(qb => {
            qb.select('creditamount', 'mobileuserid','id')
			  .where('isprocessed', false)
			  .where('creditamount','>',0)
              .where('availabledate', '<=', startDateUTC.toISOString())
          }).fetchAll();
		checkCreditAmount = checkCreditAmount.toJSON();
		if (checkCreditAmount) {
			var index;
			for (index = 0; index < checkCreditAmount.length; ++index) {
				var mycoinaccount = await strapi.query('mobileusercoinaccount').findOne({
					mobileuserid: checkCreditAmount[index].mobileuserid
				});
				if (mycoinaccount) {
					mycoinaccount.balance = mycoinaccount.balance + checkCreditAmount[index].creditamount;
					mycoinaccount.totalcredit = mycoinaccount.totalcredit + checkCreditAmount[index].creditamount;
					await strapi.query('mobileusercoinaccount').update({ mobileuserid: checkCreditAmount[index].mobileuserid },
					mycoinaccount
					);
					//update 
					await strapi.query('transaction-history').update(
					  { id: checkCreditAmount[index].id },
					  {
						isprocessed: true
					  });
				}
			}
		}
  }
};
