const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const wss = new WebSocket.Server({ port: 8080 });
const clients = new Set();

const usersFile = path.join(__dirname, 'users.json');
const messagesFile = path.join(__dirname, 'messages.json');

// Helper: Load users
const loadUsers = () => {
  if (!fs.existsSync(usersFile)) return [];
  return JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
};

// Helper: Save user
const saveUser = (username) => {
  const users = loadUsers();
  if (!users.find(u => u.username === username)) {
    users.push({ username });
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  }
};

// Helper: Load messages
const loadMessages = () => {
  if (!fs.existsSync(messagesFile)) return [];
  return JSON.parse(fs.readFileSync(messagesFile, 'utf-8'));
};

// Helper: Save message
const saveMessage = (msg) => {
  const messages = loadMessages();
  messages.push(msg);
  fs.writeFileSync(messagesFile, JSON.stringify(messages, null, 2));
};

wss.on('connection', (ws) => {
  // console.log('Client connected');
  clients.add(ws);

  ws.on('message', (message) => {
      // console.log('Received raw message:', message);

    try {
      const msg = JSON.parse(message.toString());
          // console.log('Parsed message object:', msg);

      // AUTH handler
      if (msg.type === 'AUTH') {
        const username = msg.username.trim().toLowerCase();
        saveUser(username);

        // Send back stored messages relevant to the user
        const allMessages = loadMessages();
        const userMessages = allMessages.filter(m =>
          m.sender === username || m.recipient === username
        );

        ws.send(JSON.stringify({
          type: 'AUTH_SUCCESS',
          username,
          users: loadUsers(), 
          messages: userMessages
        }));

        // console.log('Sent AUTH_SUCCESS for user:', username);

        return;
      }

      // Handle new chat message
      if (msg.type === 'SEND_MESSAGE') {
        const { sender, recipient, text, id, image } = msg;
        const newMessage = { sender, recipient, text, id, image };
        saveMessage(newMessage);

        // Broadcast to all connected clients
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'NEW_MESSAGE', ...newMessage }));
          }
        });

        // console.log('Broadcasted new message:', newMessage);

        return;
      }

    } catch (err) {
      console.error('Error parsing message:', err);
      console.error('Invalid message received:', message);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log('Client disconnected');
  });
});

console.log('✅ WebSocket server started on ws://localhost:8080');
