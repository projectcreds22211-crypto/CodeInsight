import { buildApp } from './app.js';

const PORT = Number(process.env['PORT']) || 3001;
const HOST = process.env['HOST'] || '0.0.0.0';

const app = buildApp({
  logger: true,
});

const start = async (): Promise<void> => {
  try {
    await app.listen({ port: PORT, host: HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
