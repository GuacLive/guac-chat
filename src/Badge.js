const MAX_SLOT = 3;
class Badge {
    constructor(id, name, label, url, slot = 0){
        this.id = id;
        this.name = name;
        this.label = label;
        this.url = url;
        this.slot = slot <= 2 ? slot : MAX_SLOT;
	}
}
export default Badge;