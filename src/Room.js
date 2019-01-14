class Room {
	constructor(id, name){
		this.id = id;
		this.name = name;
		this.users = {};
		this.privileged = [];
		this.emotes = {};
	}

	addUser(args){
		this.users[args.id] = {
			...args
		};
	}

	getUser(id){
		return this.users[id] || false;
	}

	removeUser(id){
		delete this.users[id];
		return true;
	}
}
export default Room;