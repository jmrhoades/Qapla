// Imports
const {ipcRenderer} = require('electron');
const anime = require('animejs');
const mojs = require('mo-js');

// Get just the local hostname
const os = require("os");
const hostname = os.hostname();
const noLocal = hostname.split(".")[0]
document.getElementById("serverAddressSmall").innerHTML = noLocal;

let bpm = 0;
let isConnected = false;

/*
	Message Log
*/

let messageLog = "";
const messageContainer = document.querySelector("#messages-log");
const messageDiv = document.querySelector("#messages-log .log");
const updateMessageLog = function(txt) {
	messageLog  = messageLog + '<br>' + txt;
	messageDiv.innerHTML = messageLog;
	messageContainer.scrollTop = messageContainer.scrollHeight;
}
updateMessageLog("<br><br><br><br>");

/*
	Events received from main.js
*/

ipcRenderer.on('server started', (event, t) => {
	let txt = "Server Started <br>" + hostname;
	updateMessageLog(txt);
	//console.log("Started", hostname)
});

ipcRenderer.on('socket connection', (event, t) => {
	if (isConnected) {
		return;
	}
	isConnected = true;

	// Update log
	let txt = "Client Connected";
	updateMessageLog(txt);

	// Stop type on animation 
	typeOnWipeOffAnimation.pause();
	typeOnWipeOffAnimation.seek(0);

	// Fade out server address
	connectedAnimation.seek(0);
	connectedAnimation.play();

	// Stop dots and hide
	dotsAnimation.pause();
	dotsContainer.style.opacity = 0;

	// Spray some circles
	circleJerk.seek(0);
	circleJerk.play();

	// Show the feedback indicators
	let mF = document.querySelector("#midiInFeedback");
	mF.style.opacity = 1;
	let CF = document.querySelector("#ccInFeedback");
	CF.style.opacity = 1;

	// Stop line animation
	clearInterval(lineTimeout);
});

ipcRenderer.on('socket disconnection', (event, t) => {
	if (!isConnected) {
		return;
	}
	isConnected = false;

	// Update log
	let txt = "Client Disconnected";
	updateMessageLog(txt);

	// Start type on animation 
	typeOnWipeOffAnimation.seek(0);
	typeOnWipeOffAnimation.play();

	// Fade in server address
	disconnectedAnimation.seek(0);
	disconnectedAnimation.play();
	
	// Start dots
	doDotsAnimation();
	dotsContainer.style.opacity = 1;
	
	// Hide the feedback indicators
	let mF = document.querySelector("#midiInFeedback");
	mF.style.opacity = 0;
	let CF = document.querySelector("#ccInFeedback");
	CF.style.opacity = 0;	

	// Start line animation
	doLineAnimation();
});

ipcRenderer.on('MIDI output open', (event, t) => {
	let txt = "MIDI Out Connected " + t;
	updateMessageLog(txt);
});

ipcRenderer.on('MIDI output port selected', (event, t) => {
	let txt = "Output Port: " + t;
	updateMessageLog(txt);
})

ipcRenderer.on('MIDI input open', (event, t) => {
	let txt = "MIDI In Connected " + t;
	updateMessageLog(txt);
})

ipcRenderer.on('MIDI input port selected', (event, t) => {
	let txt = "Input Port: " + t;
	updateMessageLog(txt);
})

ipcRenderer.on('clock start', (event, t) => {
	anime.remove(barIndicator); 
	barIndicator.style.opacity = 1;
	barIndicator.style.transform = 'scaleX(0)';	
})

ipcRenderer.on('clock stop', (event, t) => {
	anime.remove(barIndicator); 
	barIndicator.style.opacity = 0;
	barIndicator.style.transform = 'scaleX(0)';
})

ipcRenderer.on('bpm change', (event, t) => {
	bpm = t
	var duration = (4/bpm * 60) * 1000;
	barIndicator.setAttribute('data-duration', duration);
})

ipcRenderer.on('beat pulse', (event, t) => {
    midiOutSquare.play();
})

ipcRenderer.on('bar pulse', (event, t) => {
    if (bpm > 0) {
    	var duration = (4/bpm * 60) * 1000;		
		anime.remove(barIndicator);
		barAnim = anime({
    		targets: barIndicator,
    		scaleX: [0,1],
    		duration: duration,
    		easing: 'linear'
    	});
    }
})

ipcRenderer.on('note on', (event, t) => {
	let txt = "Note On " + t;
	updateMessageLog(txt);

	let pulse = anime({
	  targets: '#midiInFeedback .indicator',
	  scale: 1,
	  opacity: 1,
	  easing: 'easeInOutSine',
	  duration: 100
	});
});

ipcRenderer.on('note off', (event, t) => {
	let txt = "Note Off " + t;
	updateMessageLog(txt);

	let pulse = anime({
		targets: '#midiInFeedback .indicator',
		scale: 0,
		opacity: 0,
		easing: 'easeInOutSine',
		duration: 200
	});
});

const nub = document.querySelector('#ccInFeedback .nub');
ipcRenderer.on('cc change', (event, cc, val) => {
	let txt = "CC " + cc + ": " + val;
	updateMessageLog(txt);
	arc.percent = val/127;
	let rotation = arc.mapValueInRange(arc.percent, 0, 1, 30, 330);
	nub.style.transform = "rotate(" + rotation + "deg)";
});

/*
	Draw a grid of dots
*/
const dotElements = [];
const dotsContainer = document.querySelector("#dotsContainer");
const dotSpace = dotsContainer.getBoundingClientRect();
let w = dotSpace.width;
let h = dotSpace.height;
let cols = 14;
let rows = 9;
let radius = 1;
let startX = radius;
let startY = radius;
let marginX = 10;
let marginY = 10;
let dotColor = "rgba(200,200,200,1.0)";
const drawDotsAsDivs = function() {
	for (var i = 0; i < rows; i++) {
		for (var j = 0; j < cols; j++) {
			let dot = document.createElement("div");
			dot.style.position = 'absolute';
			dot.style.width  = radius*2 + 'px';
			dot.style.height = radius*2 + 'px';
			dot.style.borderRadius = radius + 'px';
			dot.style.backgroundColor = dotColor;
			dot.style.left = (startX + (j * (marginX))) + 'px';
			dot.style.top  = (startY + (i * (marginY))) + 'px';
			dotsContainer.appendChild(dot);
			dotElements.push(dot);
		}
	}
}
drawDotsAsDivs();
let dotsTick = true;
let dotsAnimation = false;
const doDotsAnimation = function() {
	let x = dotsTick ? -200 : 0;
	dotsTick = !dotsTick;
	dotsAnimation = anime({
		targets: dotElements.reverse(),
		translateX: x,
		duration: 1000,
		elasticity: 500,
		delay: function(el, i, l) {
		  return i * 20;
		},
		complete: function(anim) {
			setTimeout(function(){doDotsAnimation()}, 100);
		  }
	});
}
dotElements.reverse();
doDotsAnimation();

/*
	Type On Wipe Off Animation
*/
// Wrap every letter in a span
let letters = document.querySelector('.typeon .letters')
letters.innerHTML = noLocal.replace(/([^\x00-\x80]|\w)/g, "<span class='letter'>$&</span>");
// Create a reverse array of the letters for the animation
let input = document.querySelectorAll('.typeon .letter')
let lettersReversed = new Array;
for(var i = input.length-1; i >= 0; i--) {
	lettersReversed.push(input[i]);
}
const typeOnWipeOffAnimation = anime.timeline({
	loop: true,
	autoplay: false
})
typeOnWipeOffAnimation.add({
	targets: '.typeon .line',
	scaleY: [0,1],
	opacity: [0.5,1],
	easing: "easeOutExpo",
	duration: 700,
	offset:'+=100'
  })
  .add({
	targets: '.typeon .line',
	translateX: [0, letters.offsetWidth + 10],
	easing: "easeOutExpo",
	duration: 1500,
  }).add({
	targets: '.typeon .letter',
	opacity: [0,1],
	easing: "easeOutExpo",
	duration: 500,
	offset: '-=1300',
	delay: function(el, i) {
	  return 60 * (i+1)
	}
  }).add({
	targets: '.typeon .line',
	opacity: 0,
	scaleY: 0,
	translateX: letters.offsetWidth + 10,
	duration: 500,
	easing: "easeOutExpo",
	offset: '-=200',
  }).add({
	targets: '.typeon .line',
	opacity: 0,
	duration: 1500
  }).add({
	targets: '.typeon .line',
	opacity: 1,
	scaleY: 1,
	translateX: letters.offsetWidth + 10,
	duration: 500,
	easing: "easeOutExpo",
	offset: '+=100',
  }).add({
	targets: '.typeon .line',
	translateX: 0,
	easing: "easeOutExpo",
	duration: 1500
  }).add({
	targets: lettersReversed,
	opacity: [1,0],
	easing: "easeOutExpo",
	duration: 400,
	offset: '-=1700',
	delay: function(el, i) {
	  return 60 * (i+1)
	}
  }).add({
	targets: '.typeon .line',
	opacity: 0,
	scaleY: 0,
	translateX: 0,
	duration: 550,
	easing: "easeOutExpo",
	offset: '-=300',
  }).add({
	targets: '.typeon .line',
	translateX: 0,
	easing: "easeOutExpo",
	duration: 500
  });
typeOnWipeOffAnimation.play()

/*
	Connect / Disconnect Animations
*/

const connectedAnimation = anime({
	targets: '#serverAddressContainer',
	opacity: 0,
	duration: 1000,
	loop: false,
	autoplay: false,
	easing: 'easeOutExpo'
});

const disconnectedAnimation = anime({
	targets: '#serverAddressContainer',
	opacity: 1,
	duration: 1000,
	loop: false,
	autoplay: false
});

const circleJerk = anime({
	autoplay: false,
	targets: "#connectionCirclesSVG circle",
	scale: [0,1],
	opacity: [0.5,0],
	easing: "easeOutExpo",
	duration: 1000,
	delay: function(el, i, l) {
		return i * 100;
	}
});

/*
	Wavey Line Animation
*/

let lineTimeout = false
const doLineAnimation = function() {
	lineTimeout = setInterval(function() {
		lineAnimation.seek(0);
		lineAnimation.play();
	}, 1500);
}
const lineAnimation = anime.timeline({
	loop: false,
	autoplay: false
});
lineAnimation
	.add({
		targets: '#waveyline',
		opacity: [0, 1],
		easing: 'easeOutSine',
		duration: 1200
	})
	.add({
		targets: '#waveyline',
		strokeDashoffset: [anime.setDashoffset, 0],
		easing: 'easeInOutSine',
		duration: 1500,
		offset: '-=700'
	})
	.add({
		targets: '#waveyline',
		strokeDashoffset: [0, -120],
		easing: 'easeInOutSine',
		duration: 1500
	})
	.add({
		targets: '#waveyline',
		opacity: [1, 0],
		easing: 'easeOutSine',
		duration: 500,
		offset: '-=200'
	})
doLineAnimation();

// Set up MIDI CC feedback view
let ccInFeedbackBg = document.querySelector("#ccInFeedback .bg");
let arcBg = new ArcView(ccInFeedbackBg);
arcBg.color = "#F3F3F3";
let ccInFeedback = document.querySelector("#ccInFeedback .indicator");
let arc = new ArcView(ccInFeedback);
arc.color = "rgba(7, 222, 136, 1.0)";
arc.percent = 0.0;
const updateArcKnob = function(percent) {
	let radius = 100;
	let x = cos(angle)*radius;
	let y = sin(angle)*radius;
}


