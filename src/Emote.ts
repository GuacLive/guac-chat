const globalEmotes = [
	'Kappa',
	'PogChamp'
];
export const isGlobalEmote = (emote: string) => {
	return globalEmotes.indexOf(emote);
};