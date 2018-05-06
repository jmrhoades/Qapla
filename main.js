'use strict';

const {app, BrowserWindow, dialog} = require('electron')
const path = require('path')
const url = require('url')
const express = require('express');
const SocketServer = require('ws').Server;
const midi = require('midi');


// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win

const createWindow = function() {

	// Create the browser window
	win = new BrowserWindow({
		show:false,
		backgroundThrottling: false,
		width: 700,
		height: 400,
		resizable: false,
		title: "Qapla'!"
	})

	// Set up the services once the window loads
	win.once('ready-to-show', () => {
		let shouldStartApp = true
		shouldStartApp = createMIDIOutput();
		shouldStartApp = createMIDIInput();
		if (shouldStartApp) {
			win.show();
			startServer();
		} else {
			app.quit();
		}
	})

	// and load the index.html of the app.
	win.loadURL(url.format({
		pathname: path.join(__dirname, 'app/index.html'),
		protocol: 'file:',
		slashes: true
	}))

	// Open the DevTools.
	//win.webContents.openDevTools()

	// Emitted when the window is closed.
	win.on('closed', () => {
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		win = null;
	})
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
	// On macOS it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
	if (process.platform !== 'darwin') {
		app.quit();
	}
})

app.on('activate', () => {
	// On macOS it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (win === null) {
		createWindow();
	}
})

/* ------------------------------------------------------- */

// Global MIDI output & input

/* ------------------------------------------------------- */

let output;
let input;

const PPQN = 24; // 24 pulses-per-quarter-note 
const beatsPerBar = 4; // assume standard 4/4 time

const MIDI_CC         = 176; // On MIDI Channel 1, Ch. 2 == 177, etc.
const MIDI_SONG_POS   = 242;
const MIDI_CLOCK      = 248;
const MIDI_START      = 250;
const MIDI_CONTINUE   = 251;
const MIDI_STOP       = 252;
const MIDI_NOTE_ON    = 144; // On MIDI Channel 1, Ch. 2 == 145, etc.
const MIDI_NOTE_OFF   = 128; // On MIDI Channel 1, Ch. 2 == 129, etc.
const MIDI_PITCH_BEND = 224;

let tick = 0;
let quarterNotes = 0;
let barCount = 1;
let quarterNoteTime = 0;
let mspb = 0; // milliseconds per beat
let bpm = 0;
let storedBPMs = [];
let bpmTimer = 0 // interval that will check stored bpm values

const createMIDIOutput = function() {

	// Set up a new output
	output = new midi.output();
	
	// Count the available output ports
	let outputCount = output.getPortCount();
	console.log('MIDI output port count: ', outputCount);

	if (outputCount < 1) {
		return false
	}

	// Get the name of a specified output port.
	let portName = output.getPortName(0);
	console.log('createMIDIOutput: ', portName);
	
	// Open the first available output port.
	output.openPort(0);

	win.webContents.send('MIDI output open', portName);
	win.webContents.send('MIDI output port selected', '1');
	
	return true;
}

// Throttle the number of clock messages sent.
// The midi standard of 24 pulses-per-quarter-note 
// (e.g. 120*24 = 2880 messages per second @ 120bpm) is a
// little high to pump through a web socket.

const createMIDIInput = function() {

	// Set up a new input
	input = new midi.input();

	// Count the available output ports
	let inputCount = input.getPortCount();
	console.log('createMIDIInput: ', inputCount);

	if (inputCount < 1) {
		dialog.showErrorBox("Qagh!", "No MIDI ports were found.\nOpen the Audio MIDI Setup app, show the MIDI Studio window, open the IAC Driver and check 'Device is online'.");
		return false;
	}

	// Get the name of a specified output port.
	let portName = input.getPortName(0);
	console.log(portName);
	
	input.on('message', function(deltaTime, message) {
		//console.log(message);

		if (message[0] >= MIDI_NOTE_ON && message[0] < (MIDI_NOTE_ON+16)) {
			wss.clients.forEach((client) => {
				let msg = {
					type: 'note on',
					status: message[0],
					val1: message[1],
					val2: message[2],
					date: Date.now()
				};
				// Send the msg object as a JSON-formatted string.
				client.send(JSON.stringify(msg));
			});
		}

		if (message[0] >= MIDI_NOTE_OFF && message[0] < (MIDI_NOTE_OFF+16)) {
			wss.clients.forEach((client) => {
				let msg = {
					type: 'note off',
					status: message[0],
					val1: message[1],
					val2: message[2],
					date: Date.now()
				};
				// Send the msg object as a JSON-formatted string.
				client.send(JSON.stringify(msg));
			});
		}

		if (message[0] >= MIDI_CC && message[0] < (MIDI_CC+16)) {
			wss.clients.forEach((client) => {
				let msg = {
					type: 'cc',
					status: message[0],
					val1: message[1],
					val2: message[2],
					date: Date.now()
				};
				// Send the msg object as a JSON-formatted string.
				client.send(JSON.stringify(msg));
			});
		}

		if (message[0] === MIDI_CLOCK) {
			//console.log("tick!!");   
			tick++;
			if (tick > (PPQN-1)) {
				tick = 0;
				quarterNotes++;
				if (quarterNoteTime != 0) {
					// milliseconds between beats
					mspb = Date.now() - quarterNoteTime
					let newBPM = 60000 / mspb;
					if (storedBPMs.length>4) {
						storedBPMs.shift();
					}
					storedBPMs.push(newBPM);
					//console.log('bpm: ', newBPM);
				}
				quarterNoteTime = Date.now()
				win.webContents.send('beat pulse', '');
				wss.clients.forEach((client) => {
						let msg = {
							type: 'beat pulse',
							date: Date.now()
						};
						client.send(JSON.stringify(msg));
					});

				if (quarterNotes%beatsPerBar == 0) {
					barCount++;
					//console.log('bar: ', barCount);
					win.webContents.send('bar pulse', '');
					wss.clients.forEach((client) => {
						let msg = {
							type: 'bar pulse',
							date: Date.now()
						};
						client.send(JSON.stringify(msg));
					});
				}
			}
		}

		if (message[0] === MIDI_START) {
			//console.log("start!"); 
			tick = 0;
			quarterNotes = 0;
			win.webContents.send('clock start', '');
			
			wss.clients.forEach((client) => {
				let msg = {
					type: 'clock start',
					date: Date.now()
				};
				// Send the msg object as a JSON-formatted string.
				client.send(JSON.stringify(msg));
			});
		}

		if (message[0] === MIDI_STOP) {
			//console.log("stop!");      
			win.webContents.send('clock stop', '');

			wss.clients.forEach((client) => {
				let msg = {
					type: 'clock stop',
					date: Date.now()
				};
				// Send the msg object as a JSON-formatted string.
				client.send(JSON.stringify(msg));
			});
		}
	});

	// Receive only MIDI Clock beats 
	input.ignoreTypes(true, false, true)

	// Open the first available input port.
	input.openPort(0);

	// Start the bpm checker
	bpmTimer = setInterval(() => {
		checkBPM();
	}, 1000);

	win.webContents.send('MIDI input open', portName);
	win.webContents.send('MIDI input port selected', '1');

	return true;
}

// Set up the express server
const PORT = process.env.PORT || 3000;
const INDEX = path.join(__dirname, 'index.html');
let server;
let wss;

const startServer = function() {
	
	server = express()
	.use((req, res) => res.sendFile(INDEX) )
	.listen(PORT, () => {
			console.log(`Listening on ${ PORT }`);
			win.webContents.send('server started', '');
		});

	// Create the socket server
	wss = new SocketServer({ server });

	// If it works, set up the callbacks
	wss.on('connection', (ws) => {

		win.webContents.send('socket connection', '');
		
		ws.on('close', function incoming(data) {
			win.webContents.send('socket disconnection', '')
			console.log('socket disconnection')
		});
		
		ws.on('message', function incoming(data) {

			// Send the received MIDI message to the internal MIDI device
			var message = data.split(',').map(Number);
			output.sendMessage(message);    
			//console.log(message)

			if (message[0] >= MIDI_NOTE_ON && message[0] < (MIDI_NOTE_ON+16)) {
				console.log(message[1], "note on");
				win.webContents.send('note on', message[1]);
			}

			if (message[0] >= MIDI_NOTE_OFF && message[0] < (MIDI_NOTE_OFF+16)) {
				console.log(message[1],"note off");
				win.webContents.send('note off', message[1]);      
			}
			
			if (message[0] >= MIDI_CC && message[0] < (MIDI_CC+16)) {
				console.log(message[1],"cc change");
				win.webContents.send('cc change', message[1], message[2]);      
			}
		})
	});
}

// An idea around using a simple moving average to calculate a stable bpm
let calcNormalAvg = function(list) {
	// sum(list) / len(list)
	// add em all up and divide by number of samples, not too smart but seems to work
	return list.reduce(function(a, b) { return a + b; }) / list.length;
}

const checkBPM = function() {
	if (storedBPMs.length > 1) {
		let newBPM = Math.round((calcNormalAvg(storedBPMs)));
		if (newBPM != bpm) {
			//console.log('set BPM: ', bpm, newBPM)
			bpm = newBPM
			win.webContents.send('bpm change', bpm);
			wss.clients.forEach((client) => {
				let msg = {
					type: 'bpm change',
					val: bpm,
					date: Date.now()
				};
				// Send the msg object as a JSON-formatted string.
				client.send(JSON.stringify(msg));
			});
		}
	}
}
