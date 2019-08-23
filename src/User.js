class User {
	constructor(id, name, anon, type){
		if(typeof id === 'number') this.id = id;
		if(name) this.name = name;
		this.anon = anon;
		this.heartbeat = (new Date).getTime();
		this.lastMessage = null;
		this.banned = false;
		this.timeout = null;
		this.type = type;
		this.badges = new Map();
	}

	toJSON(){
		// TODO: Find a different way to do this?
		let cloned = {
			id: this.id,
			name: this.name,
			anon: this.anon,
			heartbeat: this.heartbeat,
			lastMessage: this.lastMessage,
			banned: this.banned,
			timeout: this.timeout,
			type: this.type
		};
		cloned.badges = [...this.badges.values()];
		return cloned;
	}
}
export default User;