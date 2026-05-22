import { createServer } from './server';
import { assertRequiredServiceEnv, env } from './env';
import { migrate } from './db/migrate';
import { startWatcher } from './services/watcher';

async function main() {
  console.log('Service starting...');
  assertRequiredServiceEnv();
  
  // 1. Migrate
  console.log('Running migrations...');
  await migrate();

  // 2. Start Watcher
  startWatcher();

  // 3. Start Server
  const app = createServer();
  app.listen(env.PORT, () => {
    console.log(`Backend listening on port ${env.PORT}`);
  });
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
