import escapeHtml from "escape-html";
import IMessage from "./interfaces/IMessage";
import IUser from "./interfaces/IUser";
import Room from "./Room";
import {generateFlake, truncate} from "./util";

import * as socketIo from 'socket.io';
class Message implements IMessage {
	id: string;
	time: number;
	user: IUser;
	messages: any;
	room: any;
	socket: any;
	constructor(socket: socketIo.Server, room: Room, user: IUser, messages: IMessage[]){
		this.id = generateFlake();
		this.room = room;
		this.socket = socket;
		this.user = user;
		this.msgs = messages;
	}
	msgs: any;
	send() {
		return new Promise((resolve) => {
			try {
				// NEW content length check
				if (this.msgs.map((msg: {type: string; content: any;}) => msg && msg.type === 'text' ? msg.content : '').join(' ').length > 240) {
					this.socket.emit('sys', 'Your message is too long.');
					resolve(false);
				}
			} catch { }
			this.msgs.forEach((msg: {content: string; type: any;}, i: number) => {
				// If message has content
				if (msg && msg.content && ['text', 'emote'].indexOf(msg.type) > -1) {
					msg.content = escapeHtml(msg.content);
					// This is kinda useless as it is per-word
					msg.content = truncate(msg.content.trim(), 240);
					console.log('this is msg yes', msg, i);
					this.msgs[i] = msg;
				} else {
					// If empty message
					delete this.msgs[i];
				}
				// If at last msg
				if (i == this.msgs.length - 1 && this.msgs.length > 0) {
					var lastMessage = (new Date).getTime();
					// Set lastMessage on user
					this.user.lastMessage = this.time = lastMessage;
					this.room.addMessage(this.toJSON());
					this.socket
					.in(this.room.name)
					.emit('msgs', this.user.toJSON(), this.id, this.msgs);
					resolve(true);
				} else if(this.msgs.length === 0){
					resolve(false);
				}
			});
		});
	}
	toJSON(): IMessage{
		return {
			id: this.id,
			time: this.time,
			user: this.user.toJSON(),
			msgs: this.msgs
		};
	}
}
export default Message;