class Room {
	constructor(id, name){
		this.id = id;
		this.name = name;
		this.users = new Map();
		this.privileged = [];
		this.bans = [];
		this.timeouts = new Map();
		this.emotes = {};
		this.messages = [];
		this.owner = null;
	}

	addMessage(msg){
		this.messages.push(msg);
		if(this.messages && this.messages.length >= 250){
            this.messages = this.messages.slice(-maxlines);
		}
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
	
	modifyUser(args){
		if(!args) return null;
		const normalized = args.name.toLowerCase();
		let user = this.users.get(normalized);
		this.users.set(normalized, user);
	}

	getUserById(id){
		if(typeof id !== 'number') return null;
		//const normalized = name.toLowerCase();
		let username =  Array.from(this.users).map((data) => {
			if(data.length < 2) return;
			if(data[1].id === id) return data[0].toLowerCase();
		});
		return username ? this.getUser(username[0]) : false;
	}

	getUserBySocketId(socketId){
		if(typeof socketId !== 'number') return null;
		//const normalized = name.toLowerCase();
		let username =  Array.from(this.users).map((data) => {
			if(data.length < 2) return;
			if(data[1].socketId === socketId) return data[0].toLowerCase();
		});
		return username ? this.getUser(username[0]) : false;
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
		let user = this.getUser(normalized);
		let timeout = this.timeouts.get(normalized);
		let isTimedOut = user.timeout >= (new Date).getTime()
			|| timeout >= (new Date).getTime();
		console.log(user, timeout, isTimedOut);
		return (user && isTimedOut);
	}
}
export default Room;