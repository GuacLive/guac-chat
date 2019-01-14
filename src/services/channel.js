import ApiService from './api';

export default class ChannelService {
	constructor(API_URL){
		this.ApiService = new ApiService(API_URL);
	}

	async channelUserBan(channel, user) {
		return await this.ApiService.callApi('/channel/userBan', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			accessToken: process.env.API_SECRET,
			body: {
				channel,
				user
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
			return json;
		})
		.catch(error => {
			throw error;
		});
	}
}
