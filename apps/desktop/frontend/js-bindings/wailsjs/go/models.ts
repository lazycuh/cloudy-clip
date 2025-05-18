export namespace main {
	
	export class ClipboardItem {
	    Fingerprint: string;
	    Text: string;
	    Image: string;
	
	    static createFrom(source: any = {}) {
	        return new ClipboardItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Fingerprint = source["Fingerprint"];
	        this.Text = source["Text"];
	        this.Image = source["Image"];
	    }
	}

}

