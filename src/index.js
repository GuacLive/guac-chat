import path from 'path';
import nconf from 'nconf';
import pkg from '../package.json';

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

import FlakeId from 'flake-idgen';
import intformat from 'biguint-format';

import FloodProtection from 'flood-protection';

import escapeHtml from 'escape-html';

import {createServer} from 'http';
import express from 'express';
var cors = require('cors');

const flake = new FlakeId({
    epoch: new Date(2018, 5, 16)
})

const generateFlake = () => intformat(flake.next(), 'dec');
const truncate = (str, n, useWordBoundary) => {
	if(str.length <= n){return str;}
	const subString = str.substr(0, n - 1); // the original check
	return (useWordBoundary
		? subString.substr(0, subString.lastIndexOf(' '))
		: subString) + "&hellip;";
}
const genRandomId = () => Math.floor(Math.random() * (99999 - 10000 + 1)) + 10000;
function monthDiff(d1, d2){
	var months;
	months = (d2.getFullYear() - d1.getFullYear()) * 12;
	months -= d1.getMonth();
	months += d2.getMonth();
	return months <= 0 ? 0 : months;
}

var rooms = [

];

const SHOW_JOIN_MESSAGE = false;
const USERNAME_REGEX = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

(() => {
	let _app = express();
	_app.use(cors());
	_app.use(express.json());
	_app.options('*', cors());
	_app.get('/messages/:room', async (req, res) => {
		if(!USERNAME_REGEX.test(req.params.room)){
			res.sendStatus(400);
			return;
		}
		if(rooms && rooms[req.params.room]){
			var room = rooms[req.params.room];
			// Serve 50 latest messages
			res.send(JSON.stringify(room.messages.slice(-50)));
		}else{
			res.send(JSON.stringify([]));
		}
	});
	let server = createServer(_app);
	server.listen(nconf.get('server:port'));

	const socketIO = io(
		server, 
		{
			wsEngine: 'eiows',
			perMessageDeflate: {
				threshold: 32768
			}
		}
	);

	socketIO.adapter(redisAdapter({
		host: nconf.get('redis:connection:host'),
		port: nconf.get('redis:connection:port'),
		key: nconf.get('redis:connection:key')
	}));

	const us = new UserService(global.nconf.get('server:api_url'));
	const cs = new ChannelService(global.nconf.get('server:api_url'));
	function cleanupUsers(){
		rooms.forEach((room, i) => {
			if(room && room.users){
				room.users.forEach((userVal, key) => {
					if(userVal){
						// If we haven't received a heartbeat in 900 seconds (15 minutes)
						if(userVal.heartbeat <= (new Date).getTime() - (900 * 1000)){
							// Remove user from list
							room.users.delete(userVal.name || key);
						}
					}
				});
			}
			// We are done purging user list, so restart the function in 60 seconds
			if(rooms.length === i - 1){
				setTimeout(() => {cleanupUsers();}, 60 * 1000);
			}
		});
	}
	// In 60 seconds, clean up users list
	setTimeout(() => {cleanupUsers();}, 60 * 1000);
	socketIO.on('connection', (socket) => {
		var roomName;
		var room = null;
		var user = null;
		var floodProtection = new FloodProtection({
			rate: 4,
			// default: 5, unit: messages
			// IMPORTANT: rate must be >= 1 (greater than or equal to 1)

			per: 8,
			// default: 8, unit: seconds
		});

		socket.emit('version', pkg.version);

		// room name is second paramter for backwards compatability
		socket.on('join', async (token, joinRoomName) => {
			roomName = joinRoomName;
			// If name is not provided in join or in referrer, tell user to room is invalid
			if(!roomName || typeof roomName !== 'string'){
				console.log(roomName, 'Invalid room type');
				socket.emit('sys', 'Invalid room type');  
				return;
			}
			room = rooms[roomName];

			function emitViewers(){
				var clients = socketIO.in(roomName).allSockets();
				socket.emit('viewers', clients.size + 1);
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
					room.subEnabled = channelInfo.subEnabled;
					console.log('channelInfo', channelInfo.mods);
					room.privileged = channelInfo.mods && Array.isArray(channelInfo.mods) ? channelInfo.mods : [];
					room.privileged.push(room.owner);
					let channelBans = await cs.getChannelBans(room.id);
					let channelTimeouts = await cs.getChannelTimeouts(room.id);
					if(channelBans) room.bans = channelBans;
					if(channelTimeouts){
						room.timeouts = channelTimeouts;
					}
				}else{
					console.error(roomName, channelInfo);
					socket.emit('sys', 'Channel does not exist');
					delete rooms[roomName];
					return;
				}
			}
			let showJoinMessage = SHOW_JOIN_MESSAGE;
			// Authenticate user
			if(token){
				let authedUser = await us.tokenAuth(token);
				console.log('authedUser', authedUser);
				if(authedUser && typeof authedUser.id === 'number'){
					let subscriptions = await us.getSubscriptions(token);
					let subscriber = false;
					let subLength = 0;
					// if user has been globally banned
					if(authedUser.banned){
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
					if(room.subEnabled){
						if(typeof subscriptions === 'object'){
							for(const sub of subscriptions){
								if(sub && sub.channel_stream_id === room.id){
									subscriber = true;
									subLength = monthDiff(new Date(sub.start_date) - new Date(sub.expiration_date));
								}
							}
						}
					}
					// If user already exists in room
					if(room.getUser(authedUser.name)){
						user = room.getUser(authedUser.name);
						// Check if banned from room
						if(room.bans.indexOf(user.id) >= 0){
							user.banned = true;
							showJoinMessage = false;
						}
						showJoinMessage = false;
					}else{
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
						if(room.bans.indexOf(authedUser.id) >= 0){
							user.banned = true;
							showJoinMessage = false;
						}
						//user.banned = authedUser.banned;
					}
					// Global badges
					switch(user.type){
						case 'staff':
							user.badges.set('staff', new Badge('staff', 'STAFF', 'Staff', false, 0));
						break;
						case 'admin':
							user.badges.set('admin', new Badge('admin', 'ADMIN', 'Admin', false, 0));
						break;
					}
					// Room owner will always have broadcaster badge
					if(user.id === room.owner){
						user.badges.set('broadcaster', new Badge('broadcaster', 'BROADCASTER', 'Broadcaster', false, 1));
					}else if(room.privileged.indexOf(user.id) > -1){ // Mods will always have mod badge
						user.badges.set('moderator', new Badge('moderator', 'MODERATOR', 'Moderator', false, 1));
					}
					if(user.subscriber){
						user.badges.set('subscriber', new Badge('subscriber', 'SUBSCRIBER', 'Subscriber', false, 2));
					}
					if(user.isPatron){
						user.badges.set('patron', new Badge('patron', 'PATRON', 'Patron', 'https://www.patreon.com/bePatron?u=19057109&utm_medium=widget', 3));
					}
				}else{
					console.error(token, authedUser);
					socket.emit('sys', 'User token is not valid');  
					return;
				}
			}else{
				user = new User(
					false,
					'User' + genRandomId(),
					true,
					'user',
					socket.id
				);
			}

			socket.emit('privileged', room.privileged);
			if(room.users){
				room.addUser(user);
				socket.emit('me', user);

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


		socket.conn.on('packet', (packet) => {
			console.log('received', packet.type);
			if(packet.type === 'ping'){
				if(!room || !user){
					return false;
				}
				var time = (new Date).getTime();
				user.heartbeat = time;
				if(user){
					room.modifyUser(user);
				}
			}
		});
		  
		socket.on('leave', () => {
			socket.emit('disconnect');
		});

		socket.on('disconnect', () => {
			socket.leave(roomName);
			if(!room){
				// nothing
				return false;
			}
			if(socket.id){
				var u = room.getUserBySocketId(socket.id);
				if(u){
					room.removeUser(u.name);
					if(!u.anon){
						socketIO.sockets.in(roomName).emit('leave', u);
						console.log(JSON.stringify(u) + ' has left ' + room.name || roomName);
					}
				}
			}
			if(user){
				if(room.getUser(user.name)){
					room.removeUser(user.name);
					if(!user.anon){
						socketIO.sockets.in(roomName).emit('leave', user);
						console.log(JSON.stringify(user) + ' has left ' + room.name || roomName);
					}
				}
			}
		});

		socket.on('delete', (msgID) => {
			console.log('Inside delete', user, msgID);
			if(typeof user !== 'object' || typeof msgID !== 'string') return false;
			if(room.privileged.indexOf(user.id) === -1){ // is this user not a mod?
				return false;
			}

			socket.emit('sys', `Message has been deleted`);  
			room.removeMessage(msgID);
			socketIO.sockets.in(roomName).emit('delete', msgID);  
			return false;
		});

		socket.on('ban', async (userToBan) => {
			console.log('spellspell', room.privileged, user.id, userToBan)
			if(typeof user !== 'object' || typeof userToBan !== 'number') return false;
			// Staff can ban anyone
			if(user.type !== 'staff'){
				if(room.privileged.indexOf(user.id) === -1){ // is this user not a mod?
					return false;
				}else if(room.privileged.indexOf(userToBan) !== -1){ // can't ban mods
					return false;
				}
			}else if(room.owner == userToBan){ // can't ban room owner even if admin
				socket.emit('sys', `Room owner can not be banned`);  
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
			// Staff can ban anyone
			if(user.type !== 'staff'){
				if(room.privileged.indexOf(user.id) === -1){ // is this user not a mod?
					return false;
				}else if(room.privileged.indexOf(userToBan) !== -1){ // can't ban mods
					return false;
				}
			}else if(room.owner == userToBan){ // can't ban room owner even if admin
				socket.emit('sys', `Room owner can not be banned`);  
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
			if(room.owner !== user.id && user.type !== 'staff'){ // if this user is not the owner or not staff
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
				u.badges.set('moderator', new Badge('moderator', 'MODERATOR', 'Moderator', false, 1));
			}else{
				socket.emit('sys', `user has been modded`);  
			}
			return false;
		});

		socket.on('unmod', async (userToMod) => {
			console.log('spellspell', room.privileged, user.id, userToMod)
			if(typeof user !== 'object' || typeof userToMod !== 'number') return false;
			if(room.owner !== user.id && user.type !== 'staff'){ // is this user not the owner AND NOT staff?
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
				u.badges.delete('moderator');
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

			let u = room.getUserById(userToBan);
			if(u && u.name){
				room.timeouts.set(u.name, time > 0 ? (new Date).getTime() + (time * 1000) : time);
				await cs.channelUserTimeout(room.id, userToBan, room.timeouts.get(u.name));
				socket.emit('sys', `${u.name} has been timed out for ${time} seconds`);
				// Now do the thing
				u.timeout = room.timeouts.get(u.name);
			}else{
				socket.emit('sys', `Could not time out user`);	
			}
			return false;
		});

		socket.on('message', (msgs) => {
			console.log('bab', room, user, msgs);
			if(!room){
				return false;
			}
			if(user && !user.anon){ 
				if(!user.activated){
					socket.emit('sys', 'Your user account is not activated. Check your e-mail.');
					return false;
				}
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
				}
			}else{
				console.error({
					statusCode: 403, 
					message: 'USER_NOT_AUTHED'
				});
				socket.emit('sys', 'You are not logged in (if you are, trying refreshing chat)');  
				return false;
			}

			if(floodProtection.check()){
				if(typeof msgs == 'object'){
					try{
						// NEW content length check
						if(msgs.map((msg) => msg && msg.type === 'text' ? msg.content : '').join(' ').length > 240){
							socket.emit('sys', 'Your message is too long.');  
							return false;
						}
					}catch{}
					msgs.forEach((msg, i) => {
						// If message has content
						if(msg && msg.content){	
							msg.content = escapeHtml(msg.content);
							// This is kinda useless as it is per-word
							msg.content = truncate(msg.content.trim(), 240);
							console.log('this is msg yes', msg, i);
							switch(msg.type){
								case 'text':
									// todo: filter
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
						}else{
							// If empty message
							delete msgs[i];
						}
						// If at last msg
						if(i == msgs.length - 1 && msgs.length > 0){
							var msgID = generateFlake();
							var lastMessage = (new Date).getTime();
							// Set lastMessage on user
							user.lastMessage = lastMessage;
							if(user){
								// Update user in rooms object
								room.modifyUser(user);
							}
							room.addMessage({
								id: msgID,
								time: lastMessage,
								user: user.toJSON(),
								msgs
							});
							socketIO.in(roomName).emit('msgs', user.toJSON(), msgID, msgs);
						}
					});
				}
			}else{
				socket.emit('sys', `You are typing too fast.`);
			}
		});
	});
})()