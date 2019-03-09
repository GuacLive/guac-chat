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
}
