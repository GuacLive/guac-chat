import ApiService from './api';

export default class UserService {
	constructor(API_URL){
		this.ApiService = new ApiService(API_URL);
	}

	async tokenAuth(token) {
		return await this.ApiService.callApi('/tokenAuth', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			accessToken: token
		})
		.then(response => response.json())
		.then((json) => {
			if (!('statusCode' in json)) {
				return Promise.reject(json);
			}
			return json && json.user;
		})
		.catch(error => {
			throw error;
		});
	}
	

	async getSubscriptions(accessToken) {
		if(typeof channel !== 'string') return;
		return await this.ApiService.callApi('/user/subscriptions', {
			method: 'GET',
			accessToken,
			headers: {
				'Content-Type': 'application/json'
			}
		})
		.then(response => response.json())
		.then((json) => {
			if (!('statusCode' in json)) {
				return Promise.reject(json);
			}
			if (json.statusCode !== 200) {
				return Promise.reject(json);
			}
			return json && json.data;
		})
		.catch(error => {
			throw error;
		});
	}
}
