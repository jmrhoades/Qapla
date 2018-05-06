
class ArcView {

	constructor(containingElement) {
        if (!containingElement || !containingElement.nodeType) {
            console.log("Error: ArcView needs a valid node element.");
            return null;
		}
		this._ID = "ArcView-" + ArcView.count++;
		this._parent = containingElement;
		this._strokeWidth = 4;
		this._color = "#F3F3F3";
		this._wedgePercent = 0.18;
		this.createSVG();
	}

	get color() {
        return this._color;
    }

    set color(c) {
		this._color = c;
        if (this._path) {
            this._path.setAttribute('stroke', this._color);
        }
	}
	
	get percent() {
		return this._percent;
	}

	set percent(value) {
		this._percent = value;
		let p = this.mapValueInRange(this._percent, 0, 1, 1, this._wedgePercent);
		if (this._path) {
			this._path.setAttribute('stroke-dashoffset', this._pathLength*p);
		}
	}
	
	createSVG() {
		this.updateSize();
		let SVG = `\
		<svg viewBox='-${this._strokeWidth/2} -${this._strokeWidth/2} ${this._size} ${this._size}' id='arcView-${this._ID}'>
			<circle fill='none' stroke='${this._color}' stroke-linecap='round'
				stroke-width      = '${this._strokeWidth}'
				stroke-dasharray  = '${this._pathLength}'
				stroke-dashoffset = '0'
				cx = '${this._radius}'
				cy = '${this._radius}'
				r  = '${this._radius}'>
		</svg>`;
		this._parent.innerHTML = SVG;
		let query = '#arcView-' + this._ID;
		this._svg = document.querySelector(query)
		query += ' circle';
		this._path = document.querySelector(query)
		//this._path.style.transition = "stroke-dashoffset 850ms ease-in-out";
		this.updateOffset(this._wedgePercent);
	}

	updateSize() {
		let rect = this._parent.getBoundingClientRect();
		this._size = rect.height - this._strokeWidth;
		this._radius = (this._size-this._strokeWidth)/2;
		this._pathLength = 2 * Math.PI * this._radius;
	}

	updateOffset(offset) {
		this._path.setAttribute('stroke-dashoffset', this._pathLength*offset);
		let rotation = 90 + ((360*offset)/2);
		this._svg.style.transform = "rotate("+rotation+"deg)";
	}

	mapValueInRange(value, fromLow, fromHigh, toLow, toHigh) {
        let fromRangeSize = fromHigh - fromLow;
        let toRangeSize = toHigh - toLow;
        let valueScale = (value - fromLow) / fromRangeSize;
        return toLow + (valueScale * toRangeSize);
    }

}

ArcView.count = 0;

