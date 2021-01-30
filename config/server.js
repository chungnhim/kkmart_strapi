module.exports = ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  admin: {
    auth: {
      secret: env('ADMIN_JWT_SECRET', 'a7f01dbd1a1ca14fae64ce2f0dc27db1'),
    },
  },
  autoReload : {
    'enable': true
  },
  cron: { enabled: true },
});
