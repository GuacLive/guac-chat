import ApiService from './api';

export default class UserService {
	public ApiService: any;

	constructor(API_URL: string){
		this.ApiService = new ApiService(API_URL);
	}

	async tokenAuth(token: string) {
		return await this.ApiService.callApi('/tokenAuth', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			accessToken: token
		})
		.then((response: {json: () => any;}) => response.json())
		.then((json: any) => {
			if (!('statusCode' in json)) {
				return Promise.reject(json);
			}
			return json && json.user;
		})
		.catch((error: any) => {
			throw error;
		});
	}
	

	async getSubscriptions(accessToken: string) {
		return await this.ApiService.callApi('/user/subscriptions', {
			method: 'GET',
			accessToken,
			headers: {
				'Content-Type': 'application/json'
			}
		})
		.then((response: {json: () => any;}) => response.json())
		.then((json: {statusCode: number; data: any;}) => {
			if (!('statusCode' in json)) {
				return Promise.reject(json);
			}
			if (json.statusCode !== 200) {
				return Promise.reject(json);
			}
			return json && json.data;
		})
		.catch((error: any) => {
			throw error;
		});
	}
}
