import Badge from './Badge';
import IUser from './interfaces/IUser';

class User implements IUser {
	public id: number;
	public name: string;
	public anon: boolean;
	public heartbeat: number;
	public lastMessage: number;
	public banned: boolean;
	public timeout: number;
	public type: string;
	public socketId: string;
	public activated: boolean;
	public isPatron: boolean;
	public subscriber: boolean;
	public subLength: number;
	public color: string;
	public badges: Map<string, Badge>;

	constructor(id: number | boolean, name: string, anon: boolean, type: string, socketId: string, activated?: number, isPatron?: undefined, subscriber?: boolean, subLength?: number, color?: null) {
		if(typeof id === 'number') this.id = id;
		if(name) this.name = name;
		this.anon = anon;
		this.heartbeat = (new Date).getTime();
		this.lastMessage = null;
		this.banned = false;
		this.timeout = null;
		this.type = type || 'user';
		if(typeof socketId === 'number') this.socketId = socketId;
		this.activated = activated ? true : false;
		this.isPatron = !!isPatron;
		this.subscriber = subscriber ? true : false;
		this.subLength = subLength || 0;
		this.color = color || null;
		this.badges = new Map<string, Badge>();
	}

	toJSON(): any{
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
			isPatron: this.isPatron,
			subscriber: this.subscriber,
			subLength: this.subLength,
			color: this.color,
			badges: new Array,
		};
		cloned.badges = [...this.badges.values()];
		return cloned;
	}
}
export default User;