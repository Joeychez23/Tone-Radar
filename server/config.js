const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env"), quiet: true });

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable ${name}. See server/.env.example.`);
    process.exit(1);
  }
  return value;
}

const config = {
  // API_PORT wins so a PORT meant for the React dev server isn't picked up here.
  port: Number(process.env.API_PORT || process.env.PORT) || 5050,
  isProduction: process.env.NODE_ENV === "production",
  typesafeApiKey: required("TYPESAFE_API_KEY"),
  typesafeUrl: process.env.TYPESAFE_URL || "https://api.typesafe.ai/v1/systemone",
  mongoUri: process.env.MONGODB_URI || "",
  mongoDb: process.env.MONGODB_DB || "tone_radar",
  jwtSecret: process.env.JWT_SECRET || "",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
};

// Accounts need both a database and a signing secret; without them the app
// still runs in guest mode.
config.accountsEnabled = Boolean(config.mongoUri && config.jwtSecret);

module.exports = config;
