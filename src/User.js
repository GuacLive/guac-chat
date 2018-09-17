class User {
	constructor(id, name, heartbeat){
		this.id = id;
		this.name = name;
		this.anon = true;
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