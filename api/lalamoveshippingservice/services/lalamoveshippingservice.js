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

const buildLalamoveReq = async (userAddressId, products, shippingNote, scheduleAt) => {
	let weigh = 0;
	products.forEach(product => {
		weigh += (_.isNil(product.weight) ? 0 : parseFloat(product.weight));
	});

	var userAddress = await strapi.query("user-address").findOne({ id: userAddressId });
	if (_.isNil(userAddress)) {
		return {
			success: false,
			message: "User address not found"
		}
	}

	var nearMe = await strapi.services.outlet.getNearMe(userAddress.longitude,
		userAddress.latitude,
		100000);

	if (nearMe.length == 0) {
		return {
			success: false,
			message: "Can not detect pickup address"
		}
	}

	let deliverAddress = `${userAddress.address1}, ${userAddress.city}, ${userAddress.state.name}, ${userAddress.country.name}`;
	if (_.isNil(userAddress.phone_number) || userAddress.phone_number == "") {
		return {
			success: false,
			message: "The receiver phone number is required"
		};
	}

	let serviceType = serviceTypesByWeigh.find(s => s.min <= weigh && weigh <= s.max);
	if (_.isNil(serviceType) || _.isNil(malaysiaServiceTypes.find(s => s.key.toUpperCase() == serviceType.key))) {
		return {
			success: false,
			message: "Shipping service type not supported"
		}
	}

	var req = {
		"serviceType": serviceType.key,
		"specialRequests": [],
		"stops": [],
		"requesterContact": {
			"name": nearMe[0].name,
			"phone": nearMe[0].telephone
		},
		"deliveries": [{
			"toStop": 1,
			"toContact": {
				"name": userAddress.full_name,
				"phone": userAddress.phone_number
			},
			"remarks": shippingNote
		}]
	}

	if (!_.isNil(scheduleAt) && scheduleAt != "") {
		req.scheduleAt = scheduleAt; // in UTC timezone
	}

	// if (!_.isNil(body.special_requests)) {
	// 	req.specialRequests.push(body.special_requests);
	// }

	var pickUpCountry = countiesCode.find(s => s.code == nearMe[0].country.codeiso2);
	if (_.isNil(pickUpCountry)) {
		return {
			success: false,
			message: "pickup_location.country_code in valid"
		};
	}

	var pickUP = {
		"location": {
			"lat": nearMe[0].latitude.toString(),
			"lng": nearMe[0].longitude.toString()
		},
		"addresses": {}
	};

	pickUP.addresses[pickUpCountry.locale_keys] = {
		"displayString": nearMe[0].address,
		"country": pickUpCountry.locode
	};

	req.stops.push(pickUP)

	var deliverCountry = countiesCode.find(s => s.code == userAddress.country.codeiso2);
	if (_.isNil(deliverCountry)) {
		return {
			success: false,
			message: "pickup_location.country_code in valid"
		};
	}

	var deliver = {
		"location": {
			"lat": userAddress.latitude.toString(),
			"lng": userAddress.longitude.toString()
		},
		"addresses": {}
	};

	deliver.addresses[deliverCountry.locale_keys] = {
		"displayString": deliverAddress,
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
	getQuotations: async (userAddressId, products, shippingNote, scheduleAt) => {
		let quotationBody = await buildLalamoveReq(userAddressId, products, shippingNote);
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

		let header = getHttpHeader(auth.apiKey, auth.timestamp, auth.signature, "MY_KUL");
		var res = await
			axios.post(`${LALAMOVE_API}${path}`, quotationBody.data, {
				headers: header
			}).then(function (response) {
				let httpCode = response.status;
				return {
					success: true,
					body: quotationBody.data,
					totalFee: response.data.totalFee,
					totalFeeCurrency: response.data.totalFeeCurrency
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
	placeOrder: async (userAddressId, products, shippingNote, scheduleAt) => {
		var quotationRes = await strapi.services.lalamoveshippingservice.getQuotations(userAddressId, products, shippingNote, scheduleAt);
		if (_.isNil(quotationRes) || !quotationRes.success) {
			return {
				success: false,
				message: "Can not get shipping information"
			}
		}

		var req = quotationRes.body;
		req.quotedTotalFee = {
			"amount": quotationRes.totalFee,
			"currency": quotationRes.totalFeeCurrency
		};

		const path = "/v2/orders";
		const method = "POST";

		var auth = await generateSignature(req, method, path);
		if (!auth.success) {
			return {
				success: false,
				message: "Unauthorized"
			}
		}

		let header = getHttpHeader(auth.apiKey, auth.timestamp, auth.signature, "MY_KUL");
		var res = await
			axios.post(`${LALAMOVE_API}${path}`, req, {
				headers: header
			}).then(function (response) {
				let httpCode = response.status;
				return {
					success: true,
					data: {
						customerOrderId: response.data.customerOrderId,
						orderRef: response.data.orderRef,
						shippingProvider: "LALAMOVE"
					}
				};
			}).catch(function (error) {
				// console.log(error.response);
				return {
					success: false,
					message: "Place order failed",
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