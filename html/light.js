$(function() {
    var socket = io.connect('http://localhost:8081');

    socket.on('colorChange', function(data) {
        $('.traffic-light').attr('class', 'traffic-light ' + data.color);
    });
});
