var Q = require('q'),
    express = require('express'),
    os = require('os'),
    sys = require('sys'),
    exec = require('child_process').exec,
    fs = require('fs');

var https = require('https'),
    http = require('http'),
    util = require('util'),
    program = require('commander'),
    _ = require('lodash');


program
    .version('0.0.1')
    .option('-u, --username <username>', 'Jenkins username')
    .option('-p, --password <password>', 'Jenkins password')
    .option('-f --password-file <password_file>', 'Path to a file containing your Jenkins password')
    .parse(process.argv);

if (!program.username || (!program.password && !program.passwordFile)) {
    program.help();
}

function TrafficLight(config) {
    this.jobNames = config.jobNames;
    this.jenkinsConfig = config.jenkinsConfig;
    //this.pollInterval = config.pollInterval || (60 * 1000 * 10);
    this.pollInterval = config.pollInterval || 5000;
    this.jobStatusPath = '/job/%s/api/json';
    this.color = 'orange';
    this.onColorChange = config.onColorChange;
}

TrafficLight.prototype = {
    doLoop: function() {
        return Q.all(this.jobNames.map(this.getJobStatus.bind(this)))
            .spread(this.setColor.bind(this))
            .then(this.scheduleNext.bind(this))
            .done();
    },

    getJobStatus: function(jobName) {
        var jenkins = this.jenkinsConfig;

        var options = {
            hostname: jenkins.hostname,
            auth: [jenkins.username, jenkins.password].join(':'),
            port: 443,
            path: util.format(this.jobStatusPath, jobName),
            method: 'GET',
            rejectUnauthorized: false
        };

        return this._makeRequest(options);
    },

    _makeRequest: function(options) {
        var deferred = Q.defer();

        var req = https.get(options, function(res) {
            res.on('data', function(data) {
                var color = JSON.parse(data).color;
                deferred.resolve(color);
            });
            req.on('error', function(err) {
                deferred.reject(err);
            });
        });
        req.end();

        return deferred.promise;
    },

    setColor: function(/* args... */) {
        var state = _.all(arguments, function(color) {
            return color === 'blue';
        });

        this.color = state ? 'green' : 'red';

        this.onColorChange(this.color);
    },

    scheduleNext: function() {
        setTimeout(this.doLoop.bind(this), this.pollInterval);
    }
};


function readPassword(filename) {
    return fs.readFileSync(filename, { encoding: 'utf8' }).toString().trim();
}

try {
    var password = program.password || readPassword(program.passwordFile);
} catch (e) {
    console.error(util.format('Error reading password from %s!', program.passwordFile));
    process.exit(1);
}


function emitColorChange(color) {
    io.sockets.emit('colorChange', { color: color });
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

light.doLoop();

var app = express();
var server = http.createServer(app);
var io = require('socket.io').listen(server);

app.get('/color', function(req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ color: light.color }));
});

app.configure(function() {
    var staticRoot = __dirname + '/../html';
    console.log('serving static files from', staticRoot);
    app.use(express.static(staticRoot));
});

io.sockets.on('connection', function(socket) {
    socket.emit('colorChange', { color: light.color });
});

server.listen(8081);
