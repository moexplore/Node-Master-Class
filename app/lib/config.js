// Create and export configuration variables

// Container for all the environments

let environments = {};

//Staging default environment

environments.staging = {
  httpPort: 3000,
  httpsPort: 3001,
  envName: "staging",
  hashingSecret: "thisIsASecret",
  maxChecks: 5,
  // Either get these values from a Twilio account or use github pirple account which I've done here for staging
  twilio: {
    accountSid: "ACb32d411ad7fe886aac54c665d25e5c5d",
    authToken: "9455e3eb3109edc12e3d8c92768f7a67",
    fromPhone: "+15005550006",
  },
};

// Production Environment
environments.production = {
  httpPort: 5000,
  httpsPort: 5001,
  envName: "production",
  hashingSecret: "thisIsAlsoASecret",
  maxChecks: 5,
  twilio: {
    accountSid: "",
    authToken: "",
    fromPhone: "",
  },
};

// Determine which environment was passed as a CL argument

let currentEnvironment =
  typeof process.env.NODE_ENV == "string"
    ? process.env.NODE_ENV.toLowerCase()
    : "";

// Check that the current environment matches one above and if not set it to default

let environmentToExport =
  typeof environments[currentEnvironment] == "object"
    ? environments[currentEnvironment]
    : environments.staging;

// export the module

module.exports = environmentToExport;
