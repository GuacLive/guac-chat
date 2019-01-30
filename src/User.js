class User {
	constructor(id, name, anon){
		if(id) this.id = id;
		if(name) this.name = name;
		this.anon = anon;
		this.heartbeat = (new Date).getTime();
		this.lastMessage = null;
		this.banned = false;
		this.privileges = [];
	}

	hasPrivilege(priv){
		return this.privileges.contains(priv);
	}
}
export default User;