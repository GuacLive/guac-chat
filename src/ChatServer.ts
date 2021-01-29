import * as path from 'path';
var nconf = require('nconf');
import * as pkg from '../package.json';

const ENV = process.env.NODE_ENV || 'production';

nconf.argv().env();
nconf.file('default', path.join('config', path.sep, `${ENV}.json`));
nconf.set('base_dir', __dirname);
nconf.defaults({
	server: {
		port: 3002,
		api_url: 'http://api.local.guac.live'
	},
	redis: {
		connection: {
			host: '127.0.0.1',
			port: 6379,
			key: 'myapp_test',
			password: 'your_database_password',
		}
	}
});
//nconf.save();

// @ts-ignore
global.nconf = nconf;

import express from 'express';
import * as socketIo from 'socket.io';
import {createAdapter} from 'socket.io-redis';
import {createServer, Server} from 'http';
import {RedisClient} from 'redis';

import Badge from './Badge';

import Room from './Room';

import User from './User';

import UserService from './services/user';

import ChannelService from './services/channel';

import FloodProtection from 'flood-protection';

import IUser from './interfaces/IUser';
import IRoom from './interfaces/IRoom';

var cors = require('cors');

import {genRandomId, monthDiff} from './util';
import Message from './Message';
import IMessage from './interfaces/IMessage';
import SocketIO from 'socket.io';

var rooms: Map<string, IRoom> = new Map<string, IRoom>();

const SHOW_JOIN_MESSAGE = false;
const USERNAME_REGEX = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

export class ChatServer {
	private _app: express.Application;
	private server: Server;
	private io: SocketIO.Server;
	private port: string | number;
	private userService: UserService;
	private channelService: ChannelService;

	constructor() {
		this._app = express();
		this.port = nconf.get('server:port');
		this._app.use(cors());
		this._app.use(express.json());
		this._app.options('*', cors());

		this._app.get('/messages/:room', async (req: express.Request, res: express.Response) => {
			if (!USERNAME_REGEX.test(req.params.room)) {
				res.sendStatus(400);
				return;
			}
			if (rooms && rooms.get(req.params.room)) {
				var room = rooms.get(req.params.room);
				// Serve 50 latest messages
				res.send(JSON.stringify(room.messages.slice(-50)));
			} else {
				res.send(JSON.stringify([]));
			}
		});
		this._app.get('/', async (_req: express.Request, res: express.Response) => {
			res.send(`guac chat server ${pkg.version}\r\n https://github.com/GuacLive/guac-chat`);
		});
		this.server = createServer(this._app);
		this.initServices();
		this.initSocket();
		this.listen();
	}

    get app(): express.Application {
        return this._app;
    }

	private initServices(): void {
		// @ts-ignore
		this.userService = new UserService(global.nconf.get('server:api_url'));
		// @ts-ignore
		this.channelService = new ChannelService(global.nconf.get('server:api_url'));
	}

	private initSocket(): void {
		this.io = require('socket.io')(this.server, {
			wsEngine: 'eiows',
			cors: {
				origin: true,
				methods: ['GET', 'POST'],
				credentials: true
			},
			perMessageDeflate: {
				threshold: 32768
			}
		});;
		const pubClient = new RedisClient({
			host: nconf.get('redis:connection:host'),
			port: nconf.get('redis:connection:port'),
			prefix: nconf.get('redis:connection:key')
		});
		const subClient = pubClient.duplicate();
		const adapter = createAdapter({pubClient, subClient});
		this.io.adapter(adapter);
	}

	private listen(): void {
		var self = this;
		this.server.listen(this.port, () => {
			console.log('[guac.live]', `Running chat server on port ${this.port}`);
		});
		// In 60 seconds, clean up users list
		setTimeout(this.cleanupUsers.bind(this), 60 * 1000);

		this.io.on('connection', async (socket: socketIo.Socket) => {
			var roomName: string;
			var room: Room = null;
			var user: IUser = null;
			var floodProtection = new FloodProtection({
				rate: 4,
				// default: 5, unit: messages
				// IMPORTANT: rate must be >= 1 (greater than or equal to 1)

				per: 8,
				// default: 8, unit: seconds
			});

			socket.emit('version', pkg.version);
			// room name is second paramter for backwards compatability
			socket.on('join', async (token: string, joinRoomName: string) => {
				roomName = joinRoomName;
				// If name is not provided in join or in referrer, tell user to room is invalid
				if (!roomName || typeof roomName !== 'string') {
					console.log(roomName, 'Invalid room type');
					socket.emit('sys', 'Invalid room type');
					return;
				}
				room = rooms.get(roomName);

				async function emitViewers() {
					// @tslint-ignore
					const clients = await (self.io.in(roomName) as any).allSockets();
					socket.emit('viewers', clients.size + 1);
				}

				await emitViewers();
				// emit viewer count every 30 seconds
				setInterval(emitViewers.bind(this), 30 * 1000);

				if (!room) {
					room = new Room(
						null,
						roomName
					);
					rooms.set(roomName, room);

					// Get channel info, and check if valid
					let channelInfo = await this.channelService.getChannel(roomName);
					if (channelInfo && typeof channelInfo.id === 'number') {
						room.owner = channelInfo.user.id;
						room.id = channelInfo.id;
						room.subEnabled = channelInfo.subEnabled;
						console.log('channelInfo', channelInfo.mods);
						room.privileged = channelInfo.mods && Array.isArray(channelInfo.mods) ? channelInfo.mods : [];
						room.privileged.push(room.owner);
						let channelBans = await this.channelService.getChannelBans(room.id);
						let channelTimeouts = await this.channelService.getChannelTimeouts(room.id);
						if (channelBans) room.bans = channelBans;
						if (channelTimeouts) {
							room.timeouts = channelTimeouts;
						}
					} else {
						console.error(roomName, channelInfo);
						socket.emit('sys', 'Channel does not exist');
						rooms.delete(roomName);
						return;
					}
				}
				let showJoinMessage = SHOW_JOIN_MESSAGE;
				// Authenticate user
				if (token) {
					let authedUser = await this.userService.tokenAuth(token);
					console.log('authedUser', authedUser);
					if (authedUser && typeof authedUser.id === 'number') {
						let subscriptions = await this.userService.getSubscriptions(token);
						let subscriber = false;
						let subLength = 0;
						// if user has been globally banned
						if (authedUser.banned) {
							// Make them an anonymous user, so they still can read chat
							user = new User(
								false,
								'User' + genRandomId(),
								true,
								'user',
								socket.id
							);
							user.banned = true;
							socket.emit('sys', 'You are globally banned from Guac');
							socket.join(roomName);
							return;
						}
						// If channel subscriptions are enabled, check if user is a subscriber
						if (room.subEnabled) {
							if (typeof subscriptions === 'object') {
								for (const sub of subscriptions) {
									if (sub && sub.channel_stream_id === room.id) {
										subscriber = true;
										subLength = monthDiff(new Date(sub.start_date.toString), new Date(sub.expiration_date));
									}
								}
							}
						}
						// If user already exists in room
						if (room.getUser(authedUser.name)) {
							user = room.getUser(authedUser.name);
							// Check if banned from room
							if (room.bans.indexOf(user.id) >= 0) {
								user.banned = true;
								showJoinMessage = false;
							}
							showJoinMessage = false;
						} else {
							// Create new user with authed details
							user = new User(
								authedUser.id,
								authedUser.name,
								false,
								authedUser.type,
								socket.id,
								authedUser.activated,
								// If user has linked patreon OR has color, they are a patron
								(authedUser.patreon && authedUser.patreon.isPatron) || authedUser.color,
								subscriber,
								subLength || 0,
								authedUser.color,
							);
							// Check if banned from room
							if (room.bans.indexOf(authedUser.id) >= 0) {
								user.banned = true;
								showJoinMessage = false;
							}
							//user.banned = authedUser.banned;
						}
						user.initBadges(room.owner, room.privileged);
					} else {
						console.error(token, authedUser);
						socket.emit('sys', 'User token is not valid');
						return;
					}
				} else {
					user = new User(
						false,
						'User' + genRandomId(),
						true,
						'user',
						socket.id
					);
				}

				socket.emit('privileged', room.privileged);
				if (room.users) {
					room.addUser(user);
					socket.emit('me', user);

					socket.join(roomName);
					socket.emit('users', [...room.users.values()]);
					if (!user.anon) {
						self.io.sockets.in(roomName).emit('join', user);
						if (showJoinMessage) {
							self.io.sockets.in(roomName).emit('sys', user.name + ' has joined', room);
						}
						console.log(JSON.stringify(user) + ' joined' + roomName);
					}
				}
			});

			socket.on('leave', () => {
				socket.emit('disconnect');
			});

			socket.conn.on('packet', (packet: {type: string;}) => {
				console.log('received', packet.type);
				if (packet.type === 'ping') {
					if (!room || !user) {
						return false;
					}
					var time = (new Date).getTime();
					user.heartbeat = time;
					if (user) {
						room.modifyUser(user);
					}
				}
			});

			socket.on('leave', () => {
				socket.emit('disconnect');
			});

			socket.on('disconnect', () => {
				socket.leave(roomName);
				if (!room) {
					// nothing
					return false;
				}
				if (socket.id) {
					var u = room.getUserBySocketId(socket.id);
					if (u) {
						room.removeUser(u.name);
						if (!u.anon) {
							self.io.sockets.in(roomName).emit('leave', u);
							console.log(JSON.stringify(u) + ' has left ' + room.name || roomName);
						}
					}
				}
				if (user) {
					if (room.getUser(user.name)) {
						room.removeUser(user.name);
						if (!user.anon) {
							self.io.sockets.in(roomName).emit('leave', user);
							console.log(JSON.stringify(user) + ' has left ' + room.name || roomName);
						}
					}
				}
			});

			socket.on('delete', (msgID: string) => {
				console.log('Inside delete', user, msgID);
				if (typeof user !== 'object' || typeof msgID !== 'string') return false;
				if (room.privileged.indexOf(user.id) === -1) { // is this user not a mod?
					return false;
				}

				socket.emit('sys', `Message has been deleted`);
				room.removeMessage(msgID);
				self.io.sockets.in(roomName).emit('delete', msgID);
				return false;
			});

			socket.on('ban', async (userToBan: number) => {
				console.log('spellspell', room.privileged, user.id, userToBan)
				if (typeof user !== 'object' || typeof userToBan !== 'number') return false;
				// Staff can ban anyone
				if (user.type !== 'staff') {
					if (room.privileged.indexOf(user.id) === -1) { // is this user not a mod?
						return false;
					} else if (room.privileged.indexOf(userToBan) !== -1) { // can't ban mods
						return false;
					}
				} else if (room.owner == userToBan) { // can't ban room owner even if admin
					socket.emit('sys', `Room owner can not be banned`);
					return false;
				}

				room.bans.push(userToBan);
				await this.channelService.channelUserBan(room.id, userToBan);
				let u = room.getUserById(userToBan);
				if (u) {
					socket.emit('sys', `${u.name} has been banned`);
					// Now do the thing
					u.banned = true;
					// Remove messages from user
					room.removeMessageFromUser(u.id);
				} else {
					socket.emit('sys', `user has been banned`);
				}
				return false;
			});

			socket.on('unban', async (userToBan: number) => {
				if (typeof user !== 'object' || typeof userToBan !== 'number') return false;
				// Staff can ban anyone
				if (user.type !== 'staff') {
					if (room.privileged.indexOf(user.id) === -1) { // is this user not a mod?
						return false;
					} else if (room.privileged.indexOf(userToBan) !== -1) { // can't ban mods
						return false;
					}
				} else if (room.owner == userToBan) { // can't ban room owner even if admin
					socket.emit('sys', `Room owner can not be banned`);
					return false;
				}
				room.bans = room.bans.slice(0, room.bans.indexOf(userToBan));
				await this.channelService.channelUserUnban(room.id, userToBan);
				let u = room.getUserById(userToBan);
				if (u) {
					socket.emit('sys', `${u.name} has been unbanned`);
					// Now do the thing
					u.banned = false;
				} else {
					socket.emit('sys', `user has been unbanned`);
				}
				return false;
			});

			socket.on('mod', async (userToMod: number) => {
				console.log('spellspell', room.privileged, user.id, userToMod)
				if (typeof user !== 'object' || typeof userToMod !== 'number') return false;
				if (room.owner !== user.id && user.type !== 'staff') { // if this user is not the owner or not staff
					return false;
				}
				if (room.privileged.indexOf(userToMod) !== -1) { // user is already a mod
					return false;
				}

				await this.channelService.channelUserMod(room.id, userToMod);
				let u = room.getUserById(userToMod);
				if (u) {
					socket.emit('sys', `${u.name} has been modded`);
					// Now do the thing
					room.privileged.push(userToMod);
					socket.emit('privileged', room.privileged);
					u.badges.set('moderator', new Badge('moderator', 'MODERATOR', 'Moderator', '', 1));
				} else {
					socket.emit('sys', `user has been modded`);
				}
				return false;
			});

			socket.on('unmod', async (userToMod: number) => {
				console.log('spellspell', room.privileged, user.id, userToMod)
				if (typeof user !== 'object' || typeof userToMod !== 'number') return false;
				if (room.owner !== user.id && user.type !== 'staff') { // is this user not the owner AND NOT staff?
					return false;
				}
				if (room.privileged.indexOf(userToMod) == -1) { // user is not a mod
					return false;
				}

				await this.channelService.channelUserUnmod(room.id, userToMod);
				let u = room.getUserById(userToMod);
				if (u) {
					socket.emit('sys', `${u.name} has been unmodded`);
					// Now do the thing
					room.privileged.splice(room.privileged.indexOf(userToMod));
					socket.emit('privileged', room.privileged);
					u.badges.delete('moderator');
				} else {
					socket.emit('sys', `user has been unmodded`);
				}
				return false;
			});

			socket.on('timeout', async (userToBan: any, time: number) => {
				console.log('spellspell', room.privileged, user.id, userToBan, time)
				if (typeof user !== 'object' || typeof userToBan !== 'number' || typeof time !== 'number') return false;
				if (room.privileged.indexOf(user.id) === -1) { // is this user not a mod?
					return false;
				} else if (room.privileged.indexOf(userToBan) !== -1) { // can't ban mods
					return false;
				}

				let u = room.getUserById(userToBan);
				if (u && u.name) {
					room.timeouts.set(u.name, time > 0 ? (new Date).getTime() + (time * 1000) : time);
					await this.channelService.channelUserTimeout(room.id, userToBan, room.timeouts.get(u.name));
					socket.emit('sys', `${u.name} has been timed out for ${time} seconds`);
					// Now do the thing
					u.timeout = room.timeouts.get(u.name);
					// Remove messages from user
					room.removeMessageFromUser(u.id);

				} else {
					socket.emit('sys', `Could not time out user`);
				}
				return false;
			});

			socket.on('message', async (msgs: IMessage[]) => {
				console.log('bab', room, user, msgs);
				if (!room) {
					return false;
				}
				if (user && !user.anon) {
					if (!user.activated) {
						socket.emit('sys', 'Your user account is not activated. Check your e-mail.');
						return false;
					}
					// Ignore this if user is owner
					if (typeof room.owner === 'undefined' || room.owner !== user.id) {
						if (room.isUserBanned(user.name, user.id)) {
							socket.emit('sys', 'You are banned.');
							return false;
						}

						if (room.isUserTimedout(user.name)) {
							socket.emit('sys', `You are timed out.`);
							return false;
						}
					}
				} else {
					console.error({
						statusCode: 403,
						message: 'USER_NOT_AUTHED'
					});
					socket.emit('sys', 'You are not logged in (if you are, trying refreshing chat)');
					return false;
				}

				if (floodProtection.check()) {
					if (typeof msgs == 'object') {
						const message = new Message(self.io, room, user, msgs);
						await message.send();
						// Update user in rooms object
						if (message.user) {
							room.modifyUser(message.user);
						}
					}
				} else {
					socket.emit('sys', `You are typing too fast.`);
				}
			});
		});
	}

	private cleanupUsers(): void {
		var i = 0;
		rooms.forEach((room: IRoom) => {
			if (room && room.users) {
				room.users.forEach((userVal: any, key: string) => {
					if (userVal) {
						// If we haven't received a heartbeat in 900 seconds (15 minutes)
						if (userVal.heartbeat <= (new Date).getTime() - (900 * 1000)) {
							// Remove user from list
							room.users.delete(userVal.name || key);
						}
					}
				});
			}
			i++;
			// We are done purging user list, so restart the function in 60 seconds
			if (rooms.size === i - 1) {
				setTimeout(this.cleanupUsers.bind(this), 60 * 1000);
			}
		});
	}
}