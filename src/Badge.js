const MAX_SLOT = 2;
class Badge {
    constructor(id, name, label, slot = 0){
        this.id = id;
        this.name = name;
        this.label = label;
        this.slot = slot <= 2 ? slot : MAX_SLOT;
	}
}
export default Badge;