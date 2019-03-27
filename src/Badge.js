class Badge {
    constructor(id, name, label, slot = 0){
        this.id = id;
        this.name = name;
        this.label = label;
        if(slot <= 3) this.slot = slot;
	}
}
export default Badge;