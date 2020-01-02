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

import Badge from './Badge';

import Room from './Room';

import User from './User';

import UserService from './services/user';

import ChannelService from './services/channel';

import FlakeId from 'flake-idgen'
import intformat from 'biguint-format'

const flake = new FlakeId({
    epoch: new Date(2018, 5, 16)
})

const generateFlake = () => intformat(flake.next(), 'dec')

var rooms = [

];

const COOLDOWN_TIME = 3; // in seconds

(() => {
	const socketIO = io(
		nconf.get('server:port'),
		{
		wsEngine: 'uws',
		perMessageDeflate: {
			threshold: 32768,
			serverNoContextTakeover: false
		}
	});

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
		var roomName = splited[splited.length - 1];
		let room = rooms[roomName];
		let user = null;

		socket.on('join', async (token) => {
			if(typeof roomName !== 'string'){
				console.log(roomName, 'Invalid room type');
				socket.emit('sys', 'Invalid room type');  
				return;
			}

			function emitViewers(){
				socket.emit('viewers', 
					Object.keys(socketIO.in(roomName).clients().connected)
					&& Object.keys(socketIO.in(roomName).clients().connected).length
				);
			}
			emitViewers();
			// emit viewer count every 30 seconds
			setInterval(emitViewers.bind(this), 30 * 1000);

			if(!room){
				rooms[roomName] = room = new Room(
					null,
					roomName
				);

				// Get channel info, and check if valid
				let channelInfo = await cs.getChannel(roomName);
				if(channelInfo && typeof channelInfo.id === 'number'){
					room.owner = channelInfo.user.id;
					room.id = channelInfo.id;
					console.log('channelInfo', channelInfo.mods);
					room.privileged = channelInfo.mods && Array.isArray(channelInfo.mods) ? channelInfo.mods : [];
					room.privileged.push(room.owner);
					let channelBans = await cs.getChannelBans(room.id);
					let channelTimeouts = await cs.getChannelTimeouts(room.id);
					if(channelBans) room.bans = channelBans;
					if(channelTimeouts) room.timeouts = channelTimeouts;
				}else{
					console.error(roomName, channelInfo);
					socket.emit('sys', 'Channel does not exist');
					return;
				}
			}
			let showJoinMessage = true;
			// Authenticate user
			if(token){
				let authedUser = await us.tokenAuth(token);
				console.log('authedUser', authedUser);
				if(authedUser && typeof authedUser.id === 'number'){
					// if user has been globally banned
					if(authedUser.banned){
						// Make them an anonymous user, so they still can read chat
						user = new User(
							false,
							'User' + Math.floor(Math.random() * (99999 - 10000 + 1)) + 10000,
							true
						);
						user.banned = true;
						socket.emit('sys', 'You are globally banned from Guac');  
						return;	
					}
					// If user already exists in room
					if(room.getUser(authedUser.name)){
						user = room.getUser(authedUser.name);
						// Check if banned from room
						if(room.bans.indexOf(user.id) >= 0){
							user.banned = true;
						}
						showJoinMessage = false;
						return false;
					}else{
						// Create new user with authed details
						user = new User(
							authedUser.id,
						  	authedUser.name,
							false,
							authedUser.type
						);
						// Check if banned from room
						if(room.bans.indexOf(authedUser.id) >= 0){
							user.banned = true;
						}
						//user.banned = authedUser.banned;
					}
					// Room owner will always have broadcaster badge
					if(user.id === room.owner){
						user.badges.set('broadcaster', new Badge('broadcaster', 'BROADCASTER', 'Broadcaster'));
					}else if(room.privileged.indexOf(user.id) > -1){ // Mods will always have mod badge
						user.badges.set('moderator', new Badge('moderator', 'MODERATOR', 'Moderator'));
					}
					// Other badge types
					switch(user.type){
						case 'staff':
							user.badges.set('staff', new Badge('staff', 'STAFF', 'Staff', 2));
						break;
						case 'admin':
							user.badges.set('admin', new Badge('admin', 'ADMIN', 'Admin', 2));
						break;
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

			socket.emit('privileged', room.privileged);
			if(room.users){
				room.addUser(user);

				socket.join(roomName);
				socket.emit('users', [...room.users.values()]);
				if(!user.anon){
					socketIO.sockets.in(roomName).emit('join', user);
					if(showJoinMessage){
						socketIO.sockets.in(roomName).emit('sys', user.name + ' has joined', room);
					}
					console.log(JSON.stringify(user) + ' joined' + roomName);
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

			socket.leave(roomName);
			if(!user.anon){
				socketIO.sockets.in(roomName).emit('leave', user);
				//socketIO.sockets.in(roomName).emit('sys', user.name + ' has left', room);
				console.log(JSON.stringify(user) + ' has left ' + roomName);
			}
		});

		socket.on('delete', (msgID) => {
			console.log('Inside delete', user, msgID);
			if(typeof user !== 'object' || typeof msgID !== 'number') return false;
			if(room.privileged.indexOf(user.id) === -1){ // is this user not a mod?
				return false;
			}

			socket.emit('sys', `Message has been deleted`);  
			socket.emit('delete', msgID);  
			return false;
		});

		socket.on('ban', async (userToBan) => {
			console.log('spellspell', room.privileged, user.id, userToBan)
			if(typeof user !== 'object' || typeof userToBan !== 'number') return false;
			if(room.privileged.indexOf(user.id) === -1){ // is this user not a mod?
				return false;
			}else if(room.privileged.indexOf(userToBan) !== -1){ // can't ban mods
				return false;
			}

			room.bans.push(userToBan);
			await cs.channelUserBan(room.id, userToBan);
			let u = room.getUserById(userToBan);
			if(u){
				socket.emit('sys', `${u.name} has been banned`);  
				// Now do the thing
				u.banned = true;
			}else{
				socket.emit('sys', `user has been banned`);  
			}
			return false;
		});

		socket.on('unban', async (userToBan) => {
			if(typeof user !== 'object' || typeof userToBan !== 'number') return false;
			if(room.privileged.indexOf(user.id) === -1){ // is this user not a mod?
				return false;
			}else if(room.privileged.indexOf(userToBan) !== -1){ // can't ban mods
				return false;
			}
			room.bans = room.bans.slice(0, room.bans.indexOf(userToBan));
			await cs.channelUserUnban(room.id, userToBan);
			let u = room.getUserById(userToBan);
			if(u){
				socket.emit('sys', `${u.name} has been unbanned`);  
				// Now do the thing
				u.banned = false;
			}else{
				socket.emit('sys', `user has been unbanned`);  
			}
			return false;
		});

		socket.on('mod', async (userToMod) => {
			console.log('spellspell', room.privileged, user.id, userToMod)
			if(typeof user !== 'object' || typeof userToMod !== 'number') return false;
			if(room.owner !== user.id || user.type !== 'staff'){ // if this user is not the owner or not staff
				return false;
			}
			if(room.privileged.indexOf(userToMod) !== -1){ // user is already a mod
				return false;
			}

			await cs.channelUserMod(room.id, userToMod);
			let u = room.getUserById(userToMod);
			if(u){
				socket.emit('sys', `${u.name} has been modded`);  
				// Now do the thing
				room.privileged.push(userToMod);
				socket.emit('privileged', room.privileged);
			}else{
				socket.emit('sys', `user has been modded`);  
			}
			return false;
		});

		socket.on('unmod', async (userToMod) => {
			console.log('spellspell', room.privileged, user.id, userToMod)
			if(typeof user !== 'object' || typeof userToMod !== 'number') return false;
			if(room.owner !== user.id && user.id !== userToMod){ // is this user not the owner AND NOT yourself?
				return false;
			}
			if(room.privileged.indexOf(userToMod) == -1){ // user is not a mod
				return false;
			}

			await cs.channelUserUnmod(room.id, userToMod);
			let u = room.getUserById(userToMod);
			if(u){
				socket.emit('sys', `${u.name} has been unmodded`);  
				// Now do the thing
				room.privileged.splice(room.privileged.indexOf(userToMod));
				socket.emit('privileged', room.privileged);
			}else{
				socket.emit('sys', `user has been unmodded`);  
			}
			return false;
		});

		socket.on('timeout', async (userToBan, time) => {
			console.log('spellspell', room.privileged, user.id, userToBan, time)
			if(typeof user !== 'object' || typeof userToBan !== 'number' || typeof time !== 'number') return false;
			if(room.privileged.indexOf(user.id) === -1){ // is this user not a mod?
				return false;
			}else if(room.privileged.indexOf(userToBan) !== -1){ // can't ban mods
				return false;
			}

			room.timeouts[userToBan] = time > 0 ? (new Date).getTime() + time : time;
			await cs.channelUserTimeout(room.id, userToBan, room.timeouts[userToBan]);
			let u = room.getUserById(userToBan);
			if(u){
				socket.emit('sys', `${u.name} has been timed out for ${time} seconds`);
				// Now do the thing
				u.timeout = room.timeouts[userToBan];
			}else{
				socket.emit('sys', `user has been timed out for ${time} seconds`);	
			}
			return false;
		});

		socket.on('message', (msgs) => {
			console.log('bab', room, user, msgs);
			if(!room){
				return false;
			}
			if(!user || !room.getUser(user.name) || user.anon){ 
				console.error({
					statusCode: 403, 
					message: 'USER_NOT_AUTHED'
				});
				socket.emit('sys', 'User is not authenticated');  
				return false;
			}
			let now = (new Date).getTime();
			if(room.getUser(user.name)){
				// Ignore this if user is owner
				if(typeof room.owner === 'undefined' || room.owner !== user.id){
					if(room.isUserBanned(user.name, user.id)){
						socket.emit('sys', 'You are banned.');
						return false;
					}

					if (room.isUserTimedout(user.name)) {
						socket.emit('sys', `You are timed out.`);
						return false;
					}

					if(room.getUser(user.name).lastMessage &&
						(now - room.getUser(user.name).lastMessage) <= (COOLDOWN_TIME * 1000)){
							socket.emit('sys', `You are typing too fast (${COOLDOWN_TIME} seconds).`);
							return false;
					}
				}
			}
			if(typeof msgs == 'object'){
				msgs.forEach((msg, i) => {
					console.log('this is msg yes', msg, i);
					if(msg && msg.content.trim()){	
						switch(msg.type){
							case 'text':
								// todo: filter
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
								msg = null;
							break;
						}
						if(msg === null){
							delete msgs[i];
						}else{
							msgs[i] = msg;
						}
					}
					if(i == msgs.length - 1){
						msgs.time = (new Date).getTime();
						room.getUser(user.name).lastMessage = (new Date).getTime();
						socketIO.sockets.in(roomName).emit('msgs', user.toJSON(), generateFlake(), msgs);
					}
				});
			}
		});
	});
})()