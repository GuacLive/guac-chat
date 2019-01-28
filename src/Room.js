class Room {
	constructor(id, name){
		this.id = id;
		this.name = name;
		this.users = new Map();
		this.privileged = [];
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
}
export default Room;