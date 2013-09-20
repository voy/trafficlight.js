$(function() {
    var socket = io.connect('http://localhost:8081');

    socket.on('colorChange', function(data) {
        $('.trafficlight .active').removeClass('active');
        $('.trafficlight .' + data.color).addClass('active');
    });
});
