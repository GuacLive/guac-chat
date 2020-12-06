import IUser from './interfaces/IUser';
import IMessage from './interfaces/IMessage';

const MAX_LINES = 100;
class Room {
	public id: number;
	public name: string;
	public users: Map<string, IUser>;
	public privileged: any;
	public bans: Array<number>;
	public timeouts: Map<string, number>;
	public emotes: Object;
	public messages: Array<IMessage>;
	public owner: Number | null;
	public subEnabled: Boolean;

	constructor(id: number, name: string){
		this.id = id;
		this.name = name;
		this.users = new Map<string, IUser>();
		this.privileged = [];
		this.bans = [];
		this.timeouts = new Map<string, number>();
		this.emotes = {};
		this.messages = [];
		this.owner = null;
	}

	addMessage(msg: IMessage): void{
		this.messages.push(msg);
		if(this.messages && this.messages.length >= MAX_LINES){
            this.messages = this.messages.slice(-MAX_LINES);
		}
	}

	removeMessage(id: string): void{
		this.messages = this.messages.filter((msg: IMessage) => msg.id !== id);
	}

	addUser(args: IUser): IUser{
		if(!args) return null;
		const normalized = args.name.toLowerCase();
		let user = this.users.get(normalized);
		if(!user){
			user = args;
			this.users.set(normalized, user);
		}
		return user;
	}
	
	modifyUser(args: IUser): void{
		if(!args) return null;
		const normalized = args.name.toLowerCase();
		let user = this.users.get(normalized);
		this.users.set(normalized, user);
	}

	getUserById(id: number): IUser | false{
		if(typeof id !== 'number') return null;
		//const normalized = name.toLowerCase();
		let username =  Array.from(this.users).map((data) => {
			if(data.length < 2) return;
			if(data[1] && data[1].id === id) return data[0].toLowerCase();
		});
		return username ? this.getUser(username[0]) : false;
	}

	getUserBySocketId(socketId: string): IUser {
		if(typeof socketId !== 'string') return null;
		//const normalized = name.toLowerCase();
		let username = Array.from(this.users).map((data) => {
			if(data.length < 2 || !socketId) return;
			if(data[1] && data[1].socketId === socketId.toString()) return data[0].toLowerCase();
		});
		return username ? this.getUser(username[0]) : null;
	}

	getUser(name: string): IUser {
		if(!name) return null;
		const normalized = name.toLowerCase();
		return this.users.get(normalized);
	}

	removeUser(name: string): boolean{
		if(!name) return null;
		const normalized = name.toLowerCase();
		return this.users.delete(normalized) || false;
	}

	isUserBanned(name: string, id: number): boolean{
		if(!name || typeof id !== 'number') return null;
		const normalized = name.toLowerCase();
		return this.bans.indexOf(id) >= 0 || (this.users.get(normalized) && this.users.get(normalized).banned);
	}

	isUserTimedout(name: string): boolean{
		if(!name) return null;
		const normalized = name.toLowerCase();
		let user = this.getUser(normalized);
		if(!user) return null;
		let timeout = this.timeouts.get(normalized);
		let isTimedOut = user.timeout >= (new Date).getTime()
			|| timeout >= (new Date).getTime();
		console.log(user, timeout, isTimedOut);
		return (user && isTimedOut);
	}
}
export default Room;