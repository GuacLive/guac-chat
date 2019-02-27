import path from 'path';
import nconf from 'nconf';

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

global.nconf = nconf;

import io from 'socket.io';

import redisAdapter from 'socket.io-redis';

import linkifyUrls from 'linkify-urls';

import jsonwebtoken from 'jsonwebtoken';

import Room from './Room';

import User from './User';

import UserService from './services/user';

import ChannelService from './services/channel';

import { isValidEmote } from './Emote';

var rooms = [

];

const COOLDOWN_TIME = 30; // in seconds

(() => {
	const socketIO = io(nconf.get('server:port'));

	socketIO.adapter(redisAdapter({
		host: nconf.get('redis:connection:host'),
		port: nconf.get('redis:connection:port'),
		key: nconf.get('redis:connection:key')
	}));

	const us = new UserService(global.nconf.get('server:api_url'));
	const cs = new ChannelService(global.nconf.get('server:api_url'));

	socketIO.on('connection', (socket) => {
		var url = socket.request.headers.referer;
		if(!url) return;
		console.log(url);
		var splited = url.split('/');
		var roomID = splited[splited.length - 1];
		let room = rooms[roomID];
		let user = null;

		socket.on('join', async (token) => {
			if(typeof roomID !== 'string'){
				console.log(roomID, 'Invalid room type');
				socket.emit('sys', 'Invalid room type');  
				return;
			}

			socket.emit('viewers', 
				Object.keys(socketIO.in(roomID).clients().connected)
				&& Object.keys(socketIO.in(roomID).clients().connected).length
			);

			if(!room){
				rooms[roomID] = room = new Room(
					roomID,
					`Room ${roomID}`
				);

				// Get channel info, and check if valid
				let channelInfo = await cs.getChannel(roomID);
				if(channelInfo && typeof channelInfo.id === 'number'){
					room.owner = channelInfo.user.id;
					room.privileged.push(room.owner);
				}else{
					console.error(roomID, channelInfo);
					socket.emit('sys', 'Channel does not exist');
					return;
				}
			}
			// Authenticate user
			if(token){
				let authedUser = await us.tokenAuth(token);
				console.log('authedUser', authedUser);
				if(authedUser && typeof authedUser.id === 'number'){
					if(room.getUser(authedUser.name)){
						user = room.getUser(authedUser.name);
						if(room.bans.indexOf(user.name) >= 0){
							user.banned = true;
						}
						return false;
					}else{
						user = new User(
							authedUser.id,
						  	authedUser.name,
						  	false
						);
					}
				}else{
					console.error(token, authedUser);
					socket.emit('sys', 'User token is not valid');  
					return;
				}
			}else{
				user = new User(
					false,
					'User' + Math.floor(Math.random() * (99999 - 10000 + 1)) + 10000,
					true
				);
			}

			if(room.users){
				room.addUser(user);

				socket.join(roomID);
				socket.emit('users', [...room.users]);
				if(!user.anon){
					socketIO.sockets.in(roomID).emit('join', user);
					socketIO.sockets.in(roomID).emit('sys', user.name + ' has joined', room);
					console.log(JSON.stringify(user) + ' joined' + roomID);
				}
			}
		});

		socket.on('leave', () => {
			socket.emit('disconnect');
		});

		socket.on('disconnect', () => {
			if(!room || !user){
				return false;
			}
			if(room.getUser(user.name)){
				room.removeUser(user.name);
			}

			socket.leave(roomID);
			if(!user.anon){
				socketIO.sockets.in(roomID).emit('leave', user);
				//socketIO.sockets.in(roomID).emit('sys', user.name + ' has left', room);
				console.log(JSON.stringify(user) + ' has left ' + roomID);
			}
		});

		socket.on('ban', async (userToBan) => {
			console.log('spellspell', room.privileged, user.id, userToBan)
			if(typeof userToBan !== 'number') return false;
			if(room.privileged.indexOf(user.id) === -1){ // is this user not a mod?
				return false;
			}else if(room.privileged.indexOf(userToBan) !== -1){ // can't ban mods
				return false;
			}

			room.bans.push(userToBan);
			await cs.channelUserBan(room.id, userToBan);
			if(user = room.getUserById(userToBan)){ 
				// Now do the thing
				user.banned = true;
			}
			return false;
		});


		socket.on('unban', async (userToBan) => {
			if(typeof userToBan !== 'number') return false;
			if(!room.privileged.indexOf(user.id) === -1){ // is this user not a mod?
				return false;
			}else if(room.privileged.indexOf(userToBan) === -1){ // can't ban mods
				return false;
			}
			rooms.bans = rooms.bans.slice(0, rooms.bans.indexOf(userToBan));
			await cs.channelUserUnban(room.id, userToBan);
			if(user = room.getUserById(userToBan)){ 
				// Now do the thing
				user.banned = false;
			}
			return false;
		});

		socket.on('message', (msgs) => {
			console.log('bab', room, user, msgs);
			if(!room || !user){
				return false;
			}
			if(!room.getUser(user.name) || user.anon){ 
				console.error({
					statusCode: 403, 
					message: 'USER_NOT_AUTHED'
				});
				socket.emit('sys', 'User is not authenticated');  
				return false;
			}
			let now = (new Date).getTime();
			if(room.getUser(user.name)
				&& (room.isUserBanned(user.name)
					|| (
						room.getUser(user.name).lastMessage &&
						(now - room.getUser(user.name).lastMessage) <= (COOLDOWN_TIME * 1000))
					)
			){
				socket.emit('sys', room.isUserBanned(user.name) ?
					'You are banned.'
					: `You are typing too fast (${COOLDOWN_TIME} seconds).`);
				return false;
			}
			if(typeof msgs == 'object'){
				msgs.forEach((msg, i) => {
					if(!msg.type){
						return false;
					}
					if(!msg.content.trim()){
						return;
					}
					switch(msg.type){
						case 'text':
							// todo: filter
							msg.content = linkifyUrls(msg.content);
							msg.content = msg.content.substring(0, 240);
						break;
						case 'emote':
							/*if(!isGlobalEmote(msg.content)){
								msg = null;
							}else if(typeof room.emotes[msg.content] !== 'object'){
								msg = null;
							}*/
						break;
						default:
							return false;
						break;
					}
					if(msg === null){
						delete msgs[i];
					}else{
						msgs[i] = msg;
					}
					if(i == msgs.length - 1){
						msgs.time = (new Date).getTime();
						room.getUser(user.name).lastMessage = (new Date).getTime();
						socketIO.sockets.in(roomID).emit('msgs', user, msgs);
					}
				});
			}
		});
	});
})()