type ObjectAlias = object;
export default interface IBadge extends ObjectAlias {
	id: string;
	name: string;
	label: string;
	url: string;
	slot: number;
}