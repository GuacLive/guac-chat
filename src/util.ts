
import intformat from 'biguint-format';
import FlakeId from 'flake-idgen';
const flake: FlakeId = new FlakeId({
    epoch: new Date(2018, 5, 16).getTime()
})

export const generateFlake = () => intformat(flake.next(), 'dec');
export const truncate = (str: string, n: number, useWordBoundary?: boolean) => {
	if(str.length <= n){return str;}
	const subString = str.substr(0, n - 1); // the original check
	return (useWordBoundary
		? subString.substr(0, subString.lastIndexOf(' '))
		: subString) + '&hellip;';
}
export const genRandomId = () => Math.floor(Math.random() * (99999 - 10000 + 1)) + 10000;
export const monthDiff = (d1: Date, d2: Date) => {
	var months;
	months = (d2.getFullYear() - d1.getFullYear()) * 12;
	months -= d1.getMonth();
	months += d2.getMonth();
	return months <= 0 ? 0 : months;
}