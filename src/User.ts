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

	initBadges(owner: number, privileged: Array<number>){
		// Global badges
		switch (this.type) {
			case 'staff':
				this.badges.set('staff', new Badge('staff', 'STAFF', 'Staff', '', 0));
				break;
			case 'admin':
				this.badges.set('admin', new Badge('admin', 'ADMIN', 'Admin', '', 0));
				break;
		}
		// Room owner will always have broadcaster badge
		if (this.id === owner) {
			this.badges.set('broadcaster', new Badge('broadcaster', 'BROADCASTER', 'Broadcaster', '', 1));
		} else if (privileged.indexOf(this.id) > -1) { // Mods will always have mod badge
			this.badges.set('moderator', new Badge('moderator', 'MODERATOR', 'Moderator', '', 1));
		}
		if (this.subscriber) {
			this.badges.set('subscriber', new Badge('subscriber', 'SUBSCRIBER', 'Subscriber', '', 2));
		}
		if (this.isPatron) {
			this.badges.set('patron', new Badge('patron', 'PATRON', 'Patron', 'https://www.patreon.com/bePatron?u=19057109&utm_medium=widget', 3));
		}
		const now = (new Date);
		if( this.name === 'data' && now.getMonth() === 11 && now.getDate() === 18) {
			this.badges.delete('patron');
			this.badges.set('birthday', new Badge('birthday', 'BIRTHDAY', 'User has birthday', 'https://www.youtube.com/watch?v=vdVnnMOTe3Q', 3));
		}
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