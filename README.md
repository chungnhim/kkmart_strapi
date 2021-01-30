# Strapi application

A quick description of your strapi application

# First Instal Postgres database
# Second Config file server database
```
module.exports = ({ env }) => ({
  defaultConnection: 'default',
  connections: {
    default: {
      connector: 'bookshelf',
      settings: {
        client: 'postgres',
        host: env('DATABASE_HOST', '192.168.1.6'),
        port: env.int('DATABASE_PORT', 5432),
        database: env('DATABASE_NAME', 'dbtest02'),
        username: env('DATABASE_USERNAME', 'strapi'),
        password: env('DATABASE_PASSWORD', 'strapi'),
        ssl: env.bool('DATABASE_SSL', false),
      },
      options: {}
    },
  },
});

```
# Run CMD for install environment
```
npm install --global --production windows-build-tools --vs2015

```

## Project setup
```
npm install
```

### Compiles and hot-reloads for development
```
npm run develop
```

### Compiles and minifies for production
```
npm run build
```

### Run your tests
```
npm run test
```

### Lints and fixes files
```
npm run lint
```