const { exit } = require('node:process');

const { Liquibase, POSTGRESQL_DEFAULT_CONFIG } = require('liquibase');

const databaseName = process.argv[2];

const liquibase = new Liquibase({
  ...POSTGRESQL_DEFAULT_CONFIG,
  changeLogFile: 'master.yaml',
  logLevel: 'off',
  password: process.env.CLOUDY_CLIP_DATABASE_PASSWORD,
  url: `jdbc:postgresql://${process.env.CLOUDY_CLIP_DATABASE_HOST}:${process.env.CLOUDY_CLIP_DATABASE_PORT}/${databaseName}`,
  username: process.env.CLOUDY_CLIP_DATABASE_USERNAME,
  searchPath: __dirname + '/migrations'
});

async function applyMigrations() {
  try {
    console.log('Applying database migrations...');

    await liquibase.update({});

    console.log('Migrations were applied successfully');

    exit(0);
  } catch (error) {
    console.error('Failed to apply migrations');
    console.error(error.message);
    exit(1);
  }
}

applyMigrations();
