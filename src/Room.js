class Room {
	constructor(id, name){
		this.id = id;
		this.name = name;
		this.users = new Map();
		this.privileged = [];
		this.bans = [];
		this.timeouts = [];
		this.emotes = {};
		this.owner = null;
	}

	addUser(args){
		if(!args) return null;
		const normalized = args.name.toLowerCase();
		let user = this.users.get(normalized);
		if(!user){
			user = args;
			this.users.set(normalized, user);
		}
		return user;
	}

	getUserById(id){
		if(typeof id !== 'number') return null;
		//const normalized = name.toLowerCase();
		let username =  Array.from(this.users).map((data) => {
			if(data.length < 2) return;
			if(data[1].id === id) return data[0].toLowerCase();
		});
		return username ? this.getUser(username[1]) : false;
	}

	getUser(name){
		if(!name) return null;
		const normalized = name.toLowerCase();
		return this.users.get(normalized) || false;
	}

	removeUser(name){
		if(!name) return null;
		const normalized = name.toLowerCase();
		return this.users.delete(normalized) || false;
	}

	isUserBanned(name, id){
		if(!name || typeof id !== 'number') return null;
		const normalized = name.toLowerCase();
		return this.bans.indexOf(id) >= 0 || this.users.get(normalized).banned;
	}

	isUserTimedout(name) {
		if(!name) return null;
		const normalized = name.toLowerCase();
		let user = this.timeouts.hasOwnProperty(normalized) && this.timeouts[normalized];
		return (user && user.time >= (new Date).getTime());
	}
}
export default Room;