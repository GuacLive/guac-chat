import IBadge from "./interfaces/IBadge";

const MAX_SLOT = 3;
class Badge implements IBadge {
	public id: string;
	public name: string;
	public label: string;
	public url: string;
	public slot: number;

    constructor(id: string, name: string, label: string, url: string, slot: number = 0){
        this.id = id;
        this.name = name;
        this.label = label;
        this.url = url;
        this.slot = slot <= 2 ? slot : MAX_SLOT;
	}
}
export default Badge;