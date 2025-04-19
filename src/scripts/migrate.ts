import { runMigrations, rollbackLastMigration } from '../lib/migrations';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    if (command === 'up' || !command) {
      await runMigrations();
    } else if (command === 'down') {
      await rollbackLastMigration();
    } else {
      console.error('Unknown command. Use "up" to apply migrations or "down" to rollback the last migration.');
      process.exit(1);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

main();
