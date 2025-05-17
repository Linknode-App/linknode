import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';import colors from 'colors';
import packageJson from '../package.json';

const app = express();
const httpServer = createServer(app);

const port = parseInt(process.env.PORT || '3300', 10);

// Configure CORS with specific options
app.use(cors());


async function start() {
  const listenOptions: { port: number; host?: string } = {
    port,
  };

  httpServer.listen(listenOptions, () => {
    const listenAddress = listenOptions.host
      ? `${listenOptions.host}:${listenOptions.port}`
      : `port ${listenOptions.port}`;
    console.log(`${packageJson.name} running on ${listenAddress}`);
  });
}

start();
