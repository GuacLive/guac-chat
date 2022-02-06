import fetch from 'cross-fetch';

export default class ApiService{
	public API_URL: string;

	constructor(API_URL: string){
		this.API_URL = API_URL;
	}

	callApi(endpoint: string, options: any) {
		const opt = options;
		opt.headers = opt.headers || {};
		const fullUrl = (endpoint.indexOf(this.API_URL) === -1)
			? this.API_URL + endpoint : endpoint;

		const accessToken = options.accessToken;
		const defaultHeaders: any = {
			Accept: 'application/json',
			'Content-Type': 'application/json'
		};
		if (accessToken) {
			defaultHeaders.Authorization = 'Bearer ' + accessToken;
		}
		opt.headers = Object.assign(opt.headers, defaultHeaders);
		return fetch(fullUrl, opt);
	}

	callDeleteApi(endpoint: string, options: any) {
		const opt = options;
		opt.method = 'DELETE';

		return this.callApi(endpoint, opt)
		.then((res: {status: number;}) => {
			if (res.status === 500 || res.status === 503) {
				return Promise.reject(res);
			}
			return res;
		});
	}

	callPutApi(endpoint: string, options: any) {
		const opt = options;
		opt.method = 'PUT';

		return this.callApi(endpoint, opt)
		.then((res: {status: number;}) => {
			if (res.status === 500 || res.status === 503) {
				return Promise.reject(res);
			}
			return res;
		});
	}

}
