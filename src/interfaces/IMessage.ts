import IUser from "./IUser";

export default interface IMessage {
	id: string;
	time: number;
	user: IUser;
	msgs: any;
}