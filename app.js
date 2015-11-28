// Setup basic express server
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;

server.listen(port, function () {
  console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(__dirname + '/public'));

// Chatroom

// usernames which are currently connected to the chat
var usernames = {};
var numUsers = 0;
var question = "";
var sequence = 0;

var eventHubs = require('eventhubs-js');
eventHubs.init({
    hubNamespace: "nkitaazu-ns",
    hubName: "nkitaazu",
    keyName: "send",
    key: "LaioFeOffMZontOG2VbgwmRbrbtZ4mxX6A2/eu980Ek="
});

var utf8 = require('utf8');

io.on('connection', function (socket) {
  var addedUser = false;

  function initQuestion() {
    question = "";
  }

  function sendEventHub(data) {
    var jsonMessage = {
      question: question.question,
      answer: question.answer,
      username: socket.username,
      sequence: sequence,
      message: data,
      time: (new Date).toISOString()
    }

    eventHubs.sendMessage({
      message: jsonMessage
    }).catch(function(err) {
      console.log(err);
    }).then(function() {
      console.log('Message Sent!');
    });

  }
  
  socket.on('new question', function (data) {
    initQuestion();

    // we tell the client to execute 'new question'
    question = data;
    io.sockets.emit('new question', {
      question: data.question
    });
  });

  // when the client emits 'new message', this listens and executes
  socket.on('new message', function (data) {
    if (question === "") {
      return;
    }
    
    // we tell the client to execute 'new message'
    io.sockets.emit('new message', {
      username: socket.username,
      message: data,
      sequence: ++sequence
    });
    
    sendEventHub(data);
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (username) {
    // we store the username in the socket session for this client
    socket.username = username;
    // add the client's username to the global list
    usernames[username] = username;
    ++numUsers;
    addedUser = true;
    socket.emit('login', {
      numUsers: numUsers
    });
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers
    });
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function () {
    socket.broadcast.emit('typing', {
      username: socket.username
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', function () {
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
    // remove the username from global usernames list
    if (addedUser) {
      delete usernames[socket.username];
      --numUsers;

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  });
});
