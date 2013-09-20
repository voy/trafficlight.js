var https = require('https'),
    util = require('util'),
    Q = require('q'),
    _ = require('lodash');


module.exports = TrafficLight;

function TrafficLight(config) {
    this.jobNames = config.jobNames;
    this.jenkinsConfig = config.jenkinsConfig;
    this.pollInterval = config.pollInterval || 1000 * 60;
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
