'use strict';

/**
 * `lalamoveshippingservice` service.
 */

const CryptoJS = require('crypto-js');
const axios = require('axios');
const _ = require("lodash");
const uuid = require('uuid');

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
		"locale_keys": "pt_BR"
	},
	{
		"code": "HK",
		"locale_keys": "zh_HK"
	},
	{
		"code": "ID",
		"locale_keys": "id_ID"
	},
	{
		"code": "MY",
		"locale_keys": "ms_MY"
	},
	{
		"code": "MX",
		"locale_keys": "es_MX"
	},
	{
		"code": "PH",
		"locale_keys": "en_PH"
	},
	{
		"code": "SG",
		"locale_keys": "en_SG"
	},
	{
		"code": "TW",
		"locale_keys": "zh_TW"
	},
	{
		"code": "TH",
		"locale_keys": "en_TH"
	},
	{
		"code": "VN",
		"locale_keys": "vi_VN"
	}
]

const generateSignature = async (rawBody, method, path) => {
	try {
		const LALAMOVE_API = process.env.LALAMOVE_API || 'https://sandbox-rest.lalamove.com';
		const secretKey = process.env.LALAMOVE_SECRET_KEY || 'MCwCAQACBQDDym2lAgMBAAECBDHB';
		const apiKey = process.env.LALAMOVE_API_KEY || 'apiKey';
		const time = new Date().getTime().toString();

		const body = JSON.stringify(rawBody);
		const rawSignature = `${time}\r\n${method}\r\n${path}\r\n\r\n${body}`;
		const signature = CryptoJS.HmacSHA256(rawSignature, secretKey).toString();

		return {
			success: true,
			signature,
			apiKey,
			timestamp: time,
			apiEndpont: LALAMOVE_API
		};
	} catch (error) {
		console.log(`lalamove generate signature`, error);
		return {
			success: false
		};
	}
}

const getHttpHeader = (apiKey, timestamp, signature) => {
	const TOKEN = `${apiKey}:${timestamp}:${signature}`

	return {
		'Authorization': `hmac ${TOKEN}`,
		'X-LLM-Country': 'MY',
		'X-Request-ID': uuid()
	};
}
module.exports = {
	getConfiguration: () => {
		return {
			"malaysia_service_types": malaysiaServiceTypes,
			"countries": countiesCode
		};
	},
	getQuotations: async (body) => {
		// {
		// 	"deliver_location": {
		// 		"address": "",
		// 		"country_code": "",
		// 		"lat": 0,
		// 		"lng": 0
		// 	},
		// 	"pickup_location": {
		// 		"address": "",
		// 		"country_code": "",
		// 		"lat": 0,
		// 		"lng": 0
		// 	},
		// 	"receiver": {
		// 		"name": "",
		// 		"phone_number": ""
		// 	},
		// 	"schedule_at": "",
		// 	"sender": {
		// 		"name": "",
		// 		"phone_number": "",
		// 		"remarks": ""
		// 	},
		// 	"service_type": "",
		// 	"toStop": 1
		// }

		let serviceType = malaysiaServiceTypes.find(s => s.key == body.serviceType);
		if (_.isNil(serviceType)) {
			return {
				success: false,
				message: "Shipping service type not supported"
			}
		}

		let pickUpCountry = countiesCode.find(s => s.code == pickup_location.country_code).locale_keys;
		let deliverCountry = countiesCode.find(s => s.code == deliver_location.country_code).locale_keys;
		var req = {
			"scheduleAt": body.scheduleAt, // in UTC timezone
			"serviceType": body.serviceType,
			"stops": [
				{
					"location": {
						"lat": body.pickUpLocation.lat,
						"lng": body.pickUpLocation.lng
					},
					"addresses": {
						pickUpCountry: {
							"displayString": body.pickUpLocation.address,
							"country": pickup_location.country_code
						}
					}
				},
				{
					"location": {
						"lat": body.deliverLocation.lat,
						"lng": body.deliverLocation.lng
					},
					"addresses": {
						deliverCountry: {
							"displayString": body.deliverLocation.address,
							"country": deliver_location.country_code
						}
					}
				}
			],
			"deliveries": {
				"toStop": 1,
				"toContact": {
					"name": body.sender.name,
					"phone": body.sender.phone_number
				},
				"remarks": body.sender.remarks
			},
			"requesterContact": {
				"name": body.receiver.name,
				"phone": body.receiver.phone_number
			},
			"specialRequests": special_requests
		}

		const path = "/v2/quotations";
		const method = "POST";

		var auth = await generateSignature(body, method, path);
		if (!auth.success) {
			return {
				success: false,
				message: "Unauthorized"
			}
		}

		let header = getHttpHeader(auth.apiKey, auth.timestamp, auth.signature);

		var res = await
			axios.post(`${auth.apiEndpont}${path}`, {
				headers: header
			}, req).then(function (response) {
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
	}
};
