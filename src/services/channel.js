import ApiService from './api';

export default class ChannelService {
	constructor(API_URL){
		this.ApiService = new ApiService(API_URL);
	}

	async getChannel(channel) {
		if(typeof channel !== 'string') return;
		return await this.ApiService.callApi('/watch/' + channel, {
			method: 'GET',
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

	async getChannelBans(channel) {
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
		.then(response => response.json())
		.then(async (json) => {
			if (!('statusCode' in json)) {
				return Promise.reject(json);
			}
			if (json.statusCode !== 200) {
				return Promise.reject(json);
			}
			let bans = [];
			if(json && json.data){
				await json.data.forEach(async (data) => {
					if(bans.indexOf(data.user_id) > -1) return;
					bans.push(data.user_id);
				})
			}
			return bans;
		})
		.catch(error => {
			throw error;
		});
	}

	async getChannelTimeouts(channel) {
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
		.then(response => response.json())
		.then(async (json) => {
			if (!('statusCode' in json)) {
				return Promise.reject(json);
			}
			if (json.statusCode !== 200) {
				return Promise.reject(json);
			}
			let timeouts = new Map();
			if(json && json.data){
				await json.data.forEach(async (data) => {
					if(timeouts.has(data.name])) return;
					timeouts.set(data.name, data.time);
				})
			}
			return timeouts;
		})
		.catch(error => {
			throw error;
		});
	}

	async channelUserMod(channel, user, type = 'user_id') {
		let json = {
				channel
		};
		json[type] = user;
		return await this.ApiService.callApi('/channel/userMod', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			accessToken: process.env.API_SECRET,
			body: JSON.stringify(json)
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

	async channelUserUnmod(channel, user, type = 'user_id') {
		let json = {
				channel
		};
		json[type] = user;
		return await this.ApiService.callApi('/channel/userUnmod', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			accessToken: process.env.API_SECRET,
			body: JSON.stringify(json)
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

	async channelUserBan(channel, user, type = 'user_id') {
		let json = {
				channel
		};
		json[type] = user;
		return await this.ApiService.callApi('/channel/userBan', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			accessToken: process.env.API_SECRET,
			body: JSON.stringify(json)
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

	async channelUserUnban(channel, user, type = 'user_id') {
		let json = {
				channel
		};
		json[type] = user;
		return await this.ApiService.callApi('/channel/userUnban', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			accessToken: process.env.API_SECRET,
			body: JSON.stringify(json)
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

	async channelUserTimeout(channel, user, timeout = 0, type = 'user_id') {
		let json = {
				channel,
				timeout
		};
		json[type] = user;
		return await this.ApiService.callApi('/channel/userTimeout', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			accessToken: process.env.API_SECRET,
			body: JSON.stringify(json)
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
