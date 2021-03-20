'use strict';

/**
 * `lalamoveshippingservice` service.
 */

const CryptoJS = require('crypto-js');
const axios = require('axios');
const _ = require("lodash");
const uuid = require('uuid');
const NodeGeocoder = require('node-geocoder');

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

const generateSignature = async (rawBody, method, path) => {
	try {
		const apiKey = process.env.LALAMOVE_API_KEY || 'd28388cb4ccf46d2b58d22f711c8c664';
		const secretKey = process.env.LALAMOVE_SECRET_KEY || 'MCwCAQACBQC35+AtAgMBAAECBG/mKcECAwDkqQIDAM3lAgMAtykCAgV5AgJV';
		const time = new Date().getTime().toString();

		const body = JSON.stringify(rawBody);
		const rawSignature = `${time}\r\nPOST\r\n/v2/quotations\r\n\r\n${body}`;
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
module.exports = {
	getConfiguration: () => {
		return {
			"malaysia_service_types": malaysiaServiceTypes,
			"countries": countiesCode
		};
	},
	getQuotations: async (body) => {
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
		// 	"service_type": "MOTORCYCLE",
		// 	"toStop": 1
		// }

		let serviceTypeKey = "MOTORCYCLE";
		if (!_.isNil(body.service_type)) {
			serviceTypeKey = body.service_type.toUpperCase();
		}

		let serviceType = malaysiaServiceTypes.find(s => s.key.toUpperCase() == serviceTypeKey);
		if (_.isNil(serviceType)) {
			return {
				success: false,
				message: "Shipping service type not supported"
			}
		}

		var req = {
			"scheduleAt": body.scheduleAt, // in UTC timezone
			"serviceType": serviceTypeKey,
			"specialRequests": [],
			"stops": [
				// {
				// 	"location": {
				// 		// "lat": body.pickup_location.lat,
				// 		// "lng": body.pickup_location.lng
				// 	},
				// 	"addresses": {}
				// },
				// {
				// 	"location": {
				// 		// "lat": body.deliver_location.lat,
				// 		// "lng": body.deliver_location.lng
				// 	},
				// 	"addresses": {}
				// }
			],
			"requesterContact": {
				"name": body.receiver.name,
				"phone": body.receiver.phone_number
			},
			"deliveries": [{
				"toStop": 1,
				"toContact": {
					"name": body.sender.name,
					"phone": body.sender.phone_number
				},
				"remarks": body.sender.remarks
			}]
		}

		if (!_.isNil(body.special_requests)) {
			req.specialRequests.push(body.special_requests);
		}

		const options = {
			provider: 'here',

			// Optional depending on the providers
			// fetch: customFetchImplementation,
			apiKey: 'b_tw_a6m371Kris1qsOWLzhA2jerXM2A8BP8eNwiK4o', // for Mapquest, OpenCage, Google Premier, Here
			formatter: null // 'gpx', 'string', ...
		};

		const geocoder = NodeGeocoder(options);

		var pickUpCountry = countiesCode.find(s => s.code == body.pickup_location.country_code);
		if (_.isNil(pickUpCountry)) {
			return {
				success: false,
				message: "pickup_location.country_code in valid"
			};
		}

		const mapForPickup = await geocoder.geocode(body.pickup_location.address);
		if (_.isNil(mapForPickup)) {
			return {
				success: false,
				message: "Can not detect pickup_location"
			};
		}

		var pickUP = {
			"location": {
				"lat": mapForPickup[0].latitude.toString(),
				"lng": mapForPickup[0].longitude.toString()
			},
			"addresses": {}
		};

		pickUP.addresses[pickUpCountry.locale_keys] = {
			"displayString": body.pickup_location.address,
			"country": pickUpCountry.locode
		};
		
		req.stops.push(pickUP)
		
		var deliverCountry = countiesCode.find(s => s.code == body.deliver_location.country_code);
		if (_.isNil(deliverCountry)) {
			return {
				success: false,
				message: "pickup_location.country_code in valid"
			};
		}

		const mapForDeliver = await geocoder.geocode(body.deliver_location.address);
		if (_.isNil(mapForDeliver)) {
			return {
				success: false,
				message: "Can not detect deliver_location"
			};
		}

		var deliver = {
			"location": {
				"lat": mapForDeliver[0].latitude.toString(),
				"lng": mapForDeliver[0].longitude.toString()
			},
			"addresses": {}
		};

		deliver.addresses[deliverCountry.locale_keys] = {
			"displayString": body.deliver_location.address,
			"country": deliverCountry.locode
		};

		req.stops.push(deliver)

		const path = "/v2/quotations";
		const method = "POST";

		var auth = await generateSignature(req, method, path);
		if (!auth.success) {
			return {
				success: false,
				message: "Unauthorized"
			}
		}

		let header = getHttpHeader(auth.apiKey, auth.timestamp, auth.signature, pickUpCountry.locode);
		const LALAMOVE_API = process.env.LALAMOVE_API || 'https://sandbox-rest.lalamove.com';

		var res = await
			axios.post(`${LALAMOVE_API}${path}`, req, {
				headers: header
			}).then(function (response) {
				let httpCode = response.status;
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
