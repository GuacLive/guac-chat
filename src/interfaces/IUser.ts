import IBadge from './IBadge';

type ObjectAlias = object;
export default interface IUser extends ObjectAlias {
	initBadges(owner: number, privileged: Array<number>): void;
	toJSON?: () => IUser;
	id: number;
	name: string;
	anon: boolean;
	heartbeat: number;
	lastMessage: number;
	banned: boolean;
	timeout: number;
	type: string;
	socketId: string;
	activated: boolean;
	isPatron: boolean;
	subscriber: boolean;
	subLength: number;
	color: string;
	badges: Map<string, IBadge>;
}