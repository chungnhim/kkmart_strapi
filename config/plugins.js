module.exports = ({ env }) => ({
  // ...
  email: {
    provider: 'sendgrid',
    providerOptions: {
      apiKey: env('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'),
    },
    settings: {
      defaultFrom: 'tungnt@bamboovn.net',
      defaultReplyTo: 'tungnt@bamboovn.net',
    },
  },
  // ...
});