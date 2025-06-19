import http from 'http';
import { WebSocketServer } from 'ws';
import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const server = http.createServer();
export const wss = new WebSocketServer({ server });

const pgClient = new Client({
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  database: process.env.PGDATABASE,
});
pgClient.connect();
pgClient.query('LISTEN status_update');
pgClient.query('LISTEN user_update');

pgClient.on('notification', (msg) => {
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN && msg.payload) {
      client.send(msg.payload);
    }
  });
});

export function startWebSocketServer(port = 3001) {
  server.listen(port);
}

startWebSocketServer();
