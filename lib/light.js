var Q = require('q'),
    express = require('express'),
    os = require('os'),
    sys = require('sys'),
    exec = require('child_process').exec;

var https = require('https'),
    util = require('util'),
    _ = require('lodash');


function getPassword() {
    var deferred = Q.defer();
    exec('security 2>&1 find-generic-password -gl GDC', function(err, stdout) {
        if (err) {
            deferred.reject(err);
        } else {
            var password = stdout.match(/password: "(.*?)"/);
            if (password) {
                deferred.resolve(password[1]);
            } else {
                deferred.reject();
            }
        }
    });
    return deferred.promise;
}

var jobs = [
    'Client-develop-rpmbuild',
    'Client-release-rpmbuild',
    'Client-master-rpmbuild',
    'ATeam-Connectors-IntegrationTests-UI-Graphene-all'
];

var statusUri = '/job/%s/lastBuild/api/json';

var CI_PASSWORD;


function checkJob(jobName) {
    var deferred = Q.defer();

    var options = {
        hostname: 'ci.intgdc.com',
        auth: process.env.CI_USERNAME + ':' + CI_PASSWORD,
        port: 443,
        path: util.format(statusUri, jobName),
        method: 'GET',
        rejectUnauthorized: false
    };

    var req = https.get(options, function(res) {
        res.on('data', function(data) {
            var result = JSON.parse(data).result;
            console.log(result);
            deferred.resolve(result);
        });
        req.on('error', function(err) {
            deferred.reject(err);
        });
    });
    req.end();

    return deferred.promise;
}

var failedBuildsExist = false;

getPassword()
    .then(function(password) {
        CI_PASSWORD = password;
    })
    .then(function() {
        return Q.all(jobs.map(checkJob)).spread(function() {
            failedBuildsExist = _.some(arguments, function(status) {
                return status !== 'SUCCESS';
            });
        });
    }).done();


var app = express();

app.get('/', function(req, res) {
    var color = failedBuildsExist ? 'red' : 'green';
    res.send(color);
});

app.listen(8081);
