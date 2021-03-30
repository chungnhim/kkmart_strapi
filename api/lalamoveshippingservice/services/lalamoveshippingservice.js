'use strict';

/**
 * `lalamoveshippingservice` service.
 */

const CryptoJS = require('crypto-js');
const axios = require('axios');
const _ = require("lodash");
const uuid = require('uuid');
const LALAMOVE_API = process.env.LALAMOVE_API || 'https://sandbox-rest.lalamove.com';

const malaysiaServiceTypes = [
	{
		"key": "MOTORCYCLE",
		"description": "Motorcycle / Motosikal",
		"shipmentRestrictions": "36 x 36 x 36 cm, 10 kg"
	},
	{
		"key": "CAR",
		"description": "Car / Kereta",
		"shipmentRestrictions": "50 x 50 x 50 cm, 40 kg"
	},
	{
		"key": "VAN",
		"description": "Van",
		"shipmentRestrictions": "170 x 115 x 115 cm, 500 kg"
	},
	{
		"key": "4X4",
		"description": "4X4",
		"shipmentRestrictions": "120 x 91 x 91 cm, 250 kg"
	},
	{
		"key": "TRUCK330",
		"description": "1-Ton Lorry / Lori 1-Tan",
		"shipmentRestrictions": "275 x 152 x 152 cm・1,000 kg"
	},
	{
		"key": "TRUCK550",
		"description": "3-Ton Lorry / Lori 3-Tan",
		"shipmentRestrictions": "427 x 220 x 213 cm・3,000 kg"
	}
];

const countiesCode = [
	{
		"code": "BR",
		"locale_keys": "pt_BR",
		"locode": "BR_RIO"
	},
	{
		"code": "HK",
		"locale_keys": "zh_HK",
		"locode": "HK_HKG"
	},
	{
		"code": "ID",
		"locale_keys": "id_ID",
		"locode": "ID_JKT"
	},
	{
		"code": "MY",
		"locale_keys": "ms_MY",
		"locode": "MY_KUL"
	},
	{
		"code": "MX",
		"locale_keys": "es_MX",
		"locode": "MX_MEX"
	},
	{
		"code": "PH",
		"locale_keys": "en_PH",
		"locode": "PH_CEB"
	},
	{
		"code": "SG",
		"locale_keys": "en_SG",
		"locode": "SG_SIN"
	},
	{
		"code": "TW",
		"locale_keys": "zh_TW",
		"locode": "TW_TPE"
	},
	{
		"code": "TH",
		"locale_keys": "en_TH",
		"locode": "TH_PYX"
	},
	{
		"code": "VN",
		"locale_keys": "vi_VN",
		"locode": "VN_HAN"
	}
]

// Unit is Gram
const serviceTypesByWeigh = [
	{ key: "MOTORCYCLE", min: 0, max: 10000 },
	{ key: "CAR", min: 10001, max: 40000 },
	{ key: "VAN", min: 40001, max: 500000 },
	{ key: "4X4", min: 500001, max: 250000 },
	{ key: "TRUCK330", min: 250001, max: 1000000 },
	{ key: "TRUCK550", min: 1000001, max: 3000000 }
];

const formatError = error => [
	{ messages: [{ id: error.id, message: error.message, field: error.field }] },
];

const generateSignature = async (rawBody, method, path) => {
	try {
		const apiKey = process.env.LALAMOVE_API_KEY || 'd28388cb4ccf46d2b58d22f711c8c664';
		const secretKey = process.env.LALAMOVE_SECRET_KEY || 'MCwCAQACBQC35+AtAgMBAAECBG/mKcECAwDkqQIDAM3lAgMAtykCAgV5AgJV';
		const time = new Date().getTime().toString();

		let rawSignature = "";
		if (!_.isNil(rawBody) && rawBody != "") {
			const body = JSON.stringify(rawBody);
			rawSignature = `${time}\r\n${method}\r\n${path}\r\n\r\n${body}`;
		} else {
			rawSignature = `${time}\r\n${method}\r\n${path}\r\n\r\n`;
		}

		const signature = CryptoJS.HmacSHA256(rawSignature, secretKey).toString();

		return {
			success: true,
			signature,
			apiKey,
			timestamp: time
		};
	} catch (error) {
		console.log(`lalamove generate signature`, error);
		return {
			success: false
		};
	}
}

const getHttpHeader = (apiKey, timestamp, signature, countryLocode) => {
	const TOKEN = `${apiKey}:${timestamp}:${signature}`;

	return {
		'Authorization': `hmac ${TOKEN}`,
		'X-LLM-Country': countryLocode,
		'X-Request-ID': uuid(),
		'Content-Type': 'application/json'
	};
}

const getQuotationBody = async (scheduleAt, serviceType, pickUpPoint, deliverPoint) => {
	// {
	// 	"pickUpPoint": {
	// 		"address": "",
	// 		"countryCode": "",
	// 		"latitude": "",
	// 		"longitude": "",
	// 		"name":"",
	// 		"phone":"",
	// 		"remarks":""
	// 	}
	// }

	// {
	// 	"pickup_location": {
	// 		"address": "Bumi Bukit Jalil, No 2-1, Jalan Jalil 1, Lebuhraya Bukit Jalil, Sungai Besi, 57000 Kuala Lumpur, Malaysia",
	// 		"country_code": "MY"
	// 	},
	// 	"deliver_location": {
	// 		"address": "64000 Sepang, Selangor, Malaysia",
	// 		"country_code": "MY"
	// 	},
	// 	"receiver": {
	// 		"name": "Chris Wong",
	// 		"phone_number": "0376886555"
	// 	},
	// 	"schedule_at": "",
	// 	"sender": {
	// 		"name": "Shen Ong",
	// 		"phone_number": "0376886555",
	// 		"remarks": "Remarks for drop-off point (#1)."
	// 	},
	// 	"service_type": "MOTORCYCLE"
	// }

	if (_.isNil(deliverPoint.phone) || deliverPoint.phone == "") {
		return {
			success: false,
			message: "The receiver phone number is required"
		};
	}

	var req = {
		"serviceType": serviceType,
		"specialRequests": [],
		"stops": [],
		"requesterContact": {
			"name": pickUpPoint.name,
			"phone": pickUpPoint.phone
		},
		"deliveries": [{
			"toStop": 1,
			"toContact": {
				"name": deliverPoint.name,
				"phone": deliverPoint.phone
			},
			"remarks": deliverPoint.remarks
		}]
	}

	if (!_.isNil(scheduleAt) && scheduleAt != "") {
		req.scheduleAt = scheduleAt; // in UTC timezone
	}

	// if (!_.isNil(body.special_requests)) {
	// 	req.specialRequests.push(body.special_requests);
	// }

	var pickUpCountry = countiesCode.find(s => s.code == pickUpPoint.countryCode);
	if (_.isNil(pickUpCountry)) {
		return {
			success: false,
			message: "pickup_location.country_code in valid"
		};
	}

	var pickUP = {
		"location": {
			"lat": pickUpPoint.latitude.toString(),
			"lng": pickUpPoint.longitude.toString()
		},
		"addresses": {}
	};

	pickUP.addresses[pickUpCountry.locale_keys] = {
		"displayString": pickUpPoint.address,
		"country": pickUpCountry.locode
	};

	req.stops.push(pickUP)

	var deliverCountry = countiesCode.find(s => s.code == deliverPoint.countryCode);
	if (_.isNil(deliverCountry)) {
		return {
			success: false,
			message: "pickup_location.country_code in valid"
		};
	}

	var deliver = {
		"location": {
			"lat": deliverPoint.latitude.toString(),
			"lng": deliverPoint.longitude.toString()
		},
		"addresses": {}
	};

	deliver.addresses[deliverCountry.locale_keys] = {
		"displayString": deliverPoint.address,
		"country": deliverCountry.locode
	};

	req.stops.push(deliver);

	return {
		success: true,
		data: req
	};
}

module.exports = {
	getConfiguration: () => {
		return {
			"malaysia_service_types": malaysiaServiceTypes,
			"countries": countiesCode
		};
	},
	getQuotations: async (scheduleAt, weigh, pickUpPoint, deliverPoint) => {
		let serviceType = serviceTypesByWeigh.find(s => s.min <= weigh && weigh <= s.max);
		if (_.isNil(serviceType) || _.isNil(malaysiaServiceTypes.find(s => s.key.toUpperCase() == serviceType.key))) {
			return {
				success: false,
				message: "Shipping service type not supported"
			}
		}

		let quotationBody = await getQuotationBody(scheduleAt, serviceType.key, pickUpPoint, deliverPoint);

		if (!quotationBody.success) {
			return quotationBody;
		}

		const path = "/v2/quotations";
		const method = "POST";

		var auth = await generateSignature(quotationBody.data, method, path);
		if (!auth.success) {
			return {
				success: false,
				message: "Unauthorized"
			}
		}

		console.log(`quotationBody.data`, JSON.stringify(quotationBody.data));
		let header = getHttpHeader(auth.apiKey, auth.timestamp, auth.signature, "MY_KUL");

		console.log(`header`, header);

		var res = await
			axios.post(`${LALAMOVE_API}${path}`, quotationBody.data, {
				headers: header
			}).then(function (response) {
				let httpCode = response.status;
				return {
					success: true,
					data: response.data
				}
			}).catch(function (error) {
				let httpCode = error.response.status;
				let message = "";
				if (httpCode == 401) {
					message = "Unauthorized";
				} else {
					message = "Get quotation failed"
				}

				return {
					success: false,
					message: message,
					data: error.response.data
				}
			});

		return res;
	},
	placeOrder: async (body) => {
		const path = "/v2/orders";
		const method = "POST";

		var quotationRes = await strapi.services.lalamoveshippingservice.getQuotations(body);
		if (_.isNil(quotationRes) || !quotationRes.success) {
			return {
				success: false,
				message: "Can not get shipping information"
			}
		}

		let quotationBody = await getQuotationBody(body);
		quotationBody.quotedTotalFee = {
			"amount": quotationRes.data.totalFee,
			"currency": quotationRes.data.totalFeeCurrency
		};

		var auth = await generateSignature(quotationBody, method, path);
		if (!auth.success) {
			return {
				success: false,
				message: "Unauthorized"
			}
		}

		let header = getHttpHeader(auth.apiKey, auth.timestamp, auth.signature, "MY_KUL");
		var res = await
			axios.post(`${LALAMOVE_API}${path}`, quotationBody, {
				headers: header
			}).then(function (response) {
				let httpCode = response.status;
				return {
					success: true,
					data: response.data
				}
			}).catch(function (error) {
				let httpCode = error.response.status;
				let message = "";
				if (httpCode == 401) {
					message = "Unauthorized";
				} else {
					message = "Place order failed"
				}

				return {
					success: false,
					message: message,
					data: error.response.data
				}
			});

		return res;
	},
	getOrderDetails: async (orderRef) => {
		const path = `/v2/orders/${orderRef}`;
		const method = "GET";

		var auth = await generateSignature("", method, path);
		console.log(`authc`, auth);

		if (!auth.success) {
			return {
				success: false,
				message: "Unauthorized"
			}
		}

		let header = getHttpHeader(auth.apiKey, auth.timestamp, auth.signature, "MY_KUL");
		var res = await
			axios.get(`${LALAMOVE_API}${path}`, {
				headers: header
			}).then(function (response) {
				return {
					success: true,
					data: response.data
				}
			}).catch(function (error) {
				console.log(`error`, error);
				let httpCode = error.response.status;
				let message = "";
				if (httpCode == 401) {
					message = "Unauthorized";
				} else {
					message = "Get order detail failed"
				}

				return {
					success: false,
					message: message,
					data: error.response.data
				}
			});

		return res;
	}
};