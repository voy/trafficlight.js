var express = require('express'),
    fs = require('fs'),
    http = require('http'),
    util = require('util'),
    path = require('path'),
    program = require('commander'),
    TrafficLight = require('./light.js');


program
    .version('0.0.1')
    .option('-u, --username <username>', 'Jenkins username')
    .option('-p, --password <password>', 'Jenkins password')
    .option('-f --password-file <password_file>', 'Path to a file containing your Jenkins password')
    .parse(process.argv);

if (!program.username || (!program.password && !program.passwordFile)) {
    program.help();
}


function readPassword(filename) {
    return fs.readFileSync(filename, { encoding: 'utf8' }).toString().trim();
}

function emitColorChange(color) {
    io.sockets.emit('colorChange', { color: color });
}


try {
    var password = program.password || readPassword(program.passwordFile);
} catch (e) {
    console.error(util.format('Error reading password from %s!', program.passwordFile));
    process.exit(1);
}

var light = new TrafficLight({
    jenkinsConfig: {
        username: program.username,
        password: password,
        hostname: 'ci.intgdc.com',
    },
    jobNames: [
        'Client-develop-rpmbuild',
        'Client-release-rpmbuild',
        'Client-master-rpmbuild'
    ],
    onColorChange: emitColorChange
});

console.log("All set, let's go!");

// uncomment for debugging
//light.doLoop = function() {
//    var counter = 0;
//    var colors = ['red', 'yellow', 'green'];
//    setInterval(function() {
//        emitColorChange(colors[counter % 3]);
//        counter++;
//    }, 5000);
//};

light.doLoop();

var app = express();
var server = http.createServer(app);
var io = require('socket.io').listen(server);

app.configure(function() {
    var staticRoot = path.join(__dirname, '../html');
    console.log('serving static files from', staticRoot);
    app.use(express.static(staticRoot));
});

io.sockets.on('connection', function(socket) {
    socket.emit('colorChange', { color: light.color });
});

server.listen(8081);
