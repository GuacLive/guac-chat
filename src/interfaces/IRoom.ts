import IMessage from "./IMessage";
import IUser from "./IUser";

type ObjectAlias = object;
export default interface IRoom extends ObjectAlias {
	id: number;
	name: string;
	users: Map<string, IUser>;
	privileged: any;
	bans: Array<number>;
	timeouts: Map<string, number>;
	emotes: Object;
	messages: Array<IMessage>;
	owner: number | null;
	subEnabled: Boolean;

	addMessage(msg: IMessage): void;
	removeMessage(id: string): void;

	addUser(args: IUser): IUser;
	
	modifyUser(args: IUser): void;

	getUserById(id: number): IUser | false;

	getUserBySocketId(socketId: string): IUser;

	getUser(name: string): IUser;

	removeUser(name: string): boolean;

	isUserBanned(name: string, id: number): boolean;
	isUserTimedout(name: string): boolean;
}