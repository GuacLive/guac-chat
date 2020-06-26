class User {
	constructor(id, name, anon, type, socketId, activated, isPatron, subscriber, subLength, color){
		if(typeof id === 'number') this.id = id;
		if(name) this.name = name;
		this.anon = anon;
		this.heartbeat = (new Date).getTime();
		this.lastMessage = null;
		this.banned = false;
		this.timeout = null;
		this.type = type || 'user';
		if(typeof socketId === 'number') this.socketId = socketId;
		this.activated = activated || 0;
		this.isPatron = !!isPatron;
		this.subscriber = false;
		this.subLength = 0;
		this.color = color || null;
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
			type: this.type,
			socketId: this.socketId,
			activated: this.activated,
			isPatreon: this.isPatron,
			subscriber: this.subscriber,
			subLength: this.subLength,
			color: this.color,
		};
		cloned.badges = [...this.badges.values()];
		return cloned;
	}
}
export default User;