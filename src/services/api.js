import fetch from 'cross-fetch';

export default class ApiService{
	constructor(API_URL){
		this.API_URL = API_URL;
	}

	callApi(endpoint, options = {}) {
		const opt = options;
		opt.headers = opt.headers || {};
		const fullUrl = (endpoint.indexOf(this.API_URL) === -1)
			? this.API_URL + endpoint : endpoint;

		const accessToken = options.accessToken;
		const defaultHeaders = {
			Accept: 'application/json',
			'Content-Type': 'application/json'
		};
		if (accessToken) {
			defaultHeaders.Authorization = 'Bearer ' + accessToken;
		}
		opt.headers = Object.assign(opt.headers, defaultHeaders);
		return fetch(fullUrl, opt);
	}

	callDeleteApi(endpoint, options = {}) {
		const opt = options;
		opt.method = 'DELETE';

		return callApi(endpoint, opt)
		.then((res) => {
			if (res.status === 500 || res.status === 503) {
				return Promise.reject(res);
			}
			return res;
		});
	}

	callPutApi(endpoint, options = {}) {
		const opt = options;
		opt.method = 'PUT';

		return callApi(endpoint, opt)
		.then((res) => {
			if (res.status === 500 || res.status === 503) {
				return Promise.reject(res);
			}
			return res;
		});
	}

}
