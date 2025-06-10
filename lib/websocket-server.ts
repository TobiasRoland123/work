import { WebSocketServer } from 'ws';
import http from 'http';
import { listenToStatusChanges } from './realtimeListener';

const server = http.createServer();
const wss = new WebSocketServer({ server });

listenToStatusChanges((msg) => {
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(msg);
    }
  });
});

server.listen(3001, () => {});
