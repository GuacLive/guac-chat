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

(() => {
	const socketIO = io(nconf.get('server:port'), {wsEngine: 'uws'});

	socketIO.adapter(redisAdapter({
		host: nconf.get('redis:connection:host'),
		port: nconf.get('redis:connection:port'),
		key: nconf.get('redis:connection:key')
	}));

	const us = new UserService(global.nconf.get('server:api_url'));
	const cs = new ChannelService(global.nconf.get('server:api_url'));

	socketIO.on('connection', (socket) => {
		var url = socket.request.headers.referer;
		console.log(url);
		var splited = url.split('/');
		var roomID = splited[splited.length - 1];
		let room = rooms[roomID];
		let user = null;

		socket.on('join', async (token) => {
			socket.emit('viewers', 
				socketIO.sockets.adapter.rooms[roomID]
				&& socketIO.sockets.adapter.rooms[roomID].length
			);

			if(!room){
				rooms[roomID] = room = new Room({
					id: roomID,
					name: `Room ${roomID}`
				});
			}

			// TODO: Auth
			if(token){
				authedUser = await us.auth(token);
				if(authedUser && authedUser.id){
					user = new User({
					  	id: authedUser.id,
					  	name: authedUser.name,
					  	anon: false
					});
				}else{
					console.error(token, authedUser);
					//return;
				}
			}else{
				user = new User();
			}

			if(room.users){
				room.addUser(user);

				socket.join(roomID);
				if(!user.anon){
					socketIO.to(roomID).emit('join', user);
					socketIO.to(roomID).emit('sys', user + 'has joined', room);  
					console.log(JSON.stringify(user) + ' joined' + roomID);
				}
			}
		});

		socket.on('leave', () => {
			socket.emit('disconnect');
		});

		socket.on('disconnect', () => {
			if(!room){
				return false;
			}
			if(room.getUser(user.id)){
				room.removeUser(user.id);
			}

			socket.leave(roomID);
			if(!user.anon){
				socketIO.to(roomID).emit('leave', user);
				socketIO.to(roomID).emit('sys', user.name + ' has left', room);
				console.log(JSON.stringify(user) + ' has left ' + roomID);
			}
		});

		socket.on('ban', async (userToBan) => {
			if(!room.privileged.contains(user.id)){ // is this user not a mod?
				return false;
			}else if(room.privileged.contains(userToBan)){ // can't ban mods
				return false;
			}
			if(room.getUser(userToBan)){ 
				// ??? add it to sql db directly or via api?
				// Now do the thing
				room.users[userToBan].banned = true;
				await cs.channelUserBan(room.id, userToBan);
			}
			return false;
		});

		socket.on('message', (msgs) => {
			if(!room){
				return false;
			}
			if(!room.getUser(user.id) || user.anon){ 
				socket.emit('err', {
					statusCode: 403, 
					message: 'USER_NOT_AUTHED'
				});
				return false;
			}
			if(room.users[user.id] 
				&& (room.users[user.id].banned 
					|| room.users[user.id].lastMessage < (new Date).getTime()-30*1000/*30sec*/)
			){
				return false;
			}
			if(typeof msgs == 'array'){
				msgs.forEach((msg, i) => {
					if(!msg.type){
						return false;
					}
					if(!msg.content.trim()){
						return;
					}
					switch(msg.type){
						case 'message':
							// todo: filter
							msg.content = linkifyUrls(msg.content);
							msg.content = msg.content.substring(0, 240);
						break;
						case 'emote':
							if(!isValidEmote(msg.content)){
								msg = null;
							}
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
					if(i == msg.length - 1){
						room.users[user].lastMessage = (new Date).getTime();
						socketIO.to(roomID).emit('msgs', user, msgs);
					}
				});
			}
		});
	});
})()