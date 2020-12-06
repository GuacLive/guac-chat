import ApiService from './api';

export default class ChannelService {
	public ApiService: any;

	constructor(API_URL: string){
		this.ApiService = new ApiService(API_URL);
	}

	async getChannel(channel: string) {
		if(typeof channel !== 'string') return;
		return await this.ApiService.callApi('/watch/' + channel, {
			method: 'GET',
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

	async getChannelBans(channel: number) {
		return await this.ApiService.callApi('/channel/bans', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			accessToken: process.env.API_SECRET,
			body: JSON.stringify({
				channel
			})
		})
		.then((response: {json: () => any;}) => response.json())
		.then(async (json: {statusCode: number; data: any[];}) => {
			if (!('statusCode' in json)) {
				return Promise.reject(json);
			}
			if (json.statusCode !== 200) {
				return Promise.reject(json);
			}
			let bans: any[] = [];
			if(json && json.data){
				await json.data.forEach(async (data: {user_id: any;}) => {
					if(bans.indexOf(data.user_id) > -1) return;
					bans.push(data.user_id);
				})
			}
			return bans;
		})
		.catch((error: any) => {
			throw error;
		});
	}

	async getChannelTimeouts(channel: number) {
		return await this.ApiService.callApi('/channel/timeouts', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			accessToken: process.env.API_SECRET,
			body: JSON.stringify({
				channel
			})
		})
		.then((response: {json: () => any;}) => response.json())
		.then(async (json: {statusCode: number; data: any[];}) => {
			if (!('statusCode' in json)) {
				return Promise.reject(json);
			}
			if (json.statusCode !== 200) {
				return Promise.reject(json);
			}
			let timeouts = new Map();
			if(json && json.data){
				await json.data.forEach(async (data: {name: any; time: any;}) => {
					if(timeouts.has(data.name)) return;
					timeouts.set(data.name, data.time);
				});
			}
			return timeouts;
		})
		.catch((error: any) => {
			throw error;
		});
	}

	async channelUserMod(channel: number, user: number, type = 'user_id') {
		let json = {
				channel,
				[type]: user
		};
		return await this.ApiService.callApi('/channel/userMod', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			accessToken: process.env.API_SECRET,
			body: JSON.stringify(json)
		})
		.then((response: {json: () => any;}) => response.json())
		.then((json: {statusCode: number;}) => {
			if (!('statusCode' in json)) {
				return Promise.reject(json);
			}
			if (json.statusCode !== 200) {
				return Promise.reject(json);
			}
			return json;
		})
		.catch((error: any) => {
			throw error;
		});
	}

	async channelUserUnmod(channel: number, user: number, type = 'user_id') {
		let json = {
				channel,
				[type]: user
		};
		return await this.ApiService.callApi('/channel/userUnmod', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			accessToken: process.env.API_SECRET,
			body: JSON.stringify(json)
		})
		.then((response: {json: () => any;}) => response.json())
		.then((json: {statusCode: number;}) => {
			if (!('statusCode' in json)) {
				return Promise.reject(json);
			}
			if (json.statusCode !== 200) {
				return Promise.reject(json);
			}
			return json;
		})
		.catch((error: any) => {
			throw error;
		});
	}

	async channelUserBan(channel: number, user: number, type = 'user_id') {
		let json = {
				channel,
				[type]: user
		};
		return await this.ApiService.callApi('/channel/userBan', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			accessToken: process.env.API_SECRET,
			body: JSON.stringify(json)
		})
		.then((response: {json: () => any;}) => response.json())
		.then((json: {statusCode: number;}) => {
			if (!('statusCode' in json)) {
				return Promise.reject(json);
			}
			if (json.statusCode !== 200) {
				return Promise.reject(json);
			}
			return json;
		})
		.catch((error: any) => {
			throw error;
		});
	}

	async channelUserUnban(channel: number, user: number, type = 'user_id') {
		let json = {
				channel,
				[type]: user
		};
		return await this.ApiService.callApi('/channel/userUnban', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			accessToken: process.env.API_SECRET,
			body: JSON.stringify(json)
		})
		.then((response: {json: () => any;}) => response.json())
		.then((json: {statusCode: number;}) => {
			if (!('statusCode' in json)) {
				return Promise.reject(json);
			}
			if (json.statusCode !== 200) {
				return Promise.reject(json);
			}
			return json;
		})
		.catch((error: any) => {
			throw error;
		});
	}

	async channelUserTimeout(channel: number, user: number, timeout = 0, type = 'user_id') {
		let json = {
				channel,
				timeout,
				[type]: user
		};
		return await this.ApiService.callApi('/channel/userTimeout', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			accessToken: process.env.API_SECRET,
			body: JSON.stringify(json)
		})
		.then((response: {json: () => any;}) => response.json())
		.then((json: {statusCode: number;}) => {
			if (!('statusCode' in json)) {
				return Promise.reject(json);
			}
			if (json.statusCode !== 200) {
				return Promise.reject(json);
			}
			return json;
		})
		.catch((error: any) => {
			throw error;
		});
	}
}
