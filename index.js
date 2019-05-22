/*
███████╗██████╗  ██████╗ ███╗   ██╗████████╗██╗     ███████╗███████╗███████╗
██╔════╝██╔══██╗██╔═══██╗████╗  ██║╚══██╔══╝██║     ██╔════╝██╔════╝██╔════╝
█████╗  ██████╔╝██║   ██║██╔██╗ ██║   ██║   ██║     █████╗  ███████╗███████╗
██╔══╝  ██╔══██╗██║   ██║██║╚██╗██║   ██║   ██║     ██╔══╝  ╚════██║╚════██║
██║     ██║  ██║╚██████╔╝██║ ╚████║   ██║   ███████╗███████╗███████║███████║
╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝   ╚═╝   ╚══════╝╚══════╝╚══════╝╚══════╝
<<<<<<<<<<<<   FeathersJS - RiotJS - Turbolinks - Express    >>>>>>>>>>>>>>> 
----------------------------------------------------------------------------
@GitHub: https://github.com/nesterow/frontless
@License: MIT
@Author: Anton Nesterov <arch.nesterov@gmail.com>
*/

const dotenv = require("dotenv");
dotenv.config({ path: process.argv[process.argv.length - 1] });

const express = require("@feathersjs/express");
const feathers = require("@feathersjs/feathers");
const session = require("express-session");
const cors = require("cors");
const socketio = require("@feathersjs/socketio");
const authentication = require("@feathersjs/authentication");
const local = require("@feathersjs/authentication-local");
const register = require("@riotjs/ssr/register");
register();

const { FrontlessMiddleware } = require("frontless-utils");
const withJSS = require("riot-jss");
const riot = require("riot");

riot.install(withJSS);

const sessionMiddleware = session({
  secret: process.env.HTTP_SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.HTTP_SESSION_SECURE === "yes" }
});

// Use CORS
// you can use dynamic resolution if allowed hosts are kept in some storage
const ALOWED_HOSTS = ["*"];
const origin = async (host, cb) => {
  if (ALOWED_HOSTS.includes("*") || ALOWED_HOSTS.includes(host))
    return cb(null, true);
  return cb("Host is not alowed", false);
};

const corsMiddleware = cors({
  origin: origin
});

const api = feathers();
const app = express(api);

app.use(corsMiddleware);
app.use(sessionMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.configure(express.rest());
app.use("/assets", express.static("assets"));

app.configure(
  socketio({}, function(io) {
    io.origins(origin);
    io.use(function(socket, next) {
      sessionMiddleware(socket.request, socket.request.res, next);
    });
    io.use(function(socket, next) {
      socket.feathers.request = socket.request;
      next();
    });
  })
);
app.configure(
  authentication({
    session: true,
    secret: process.env.REST_AUTH_SECRET,
    service: process.env.REST_AUTH_SERVICE
  })
);
app.configure(local());

app.use("/*@:args", FrontlessMiddleware(__dirname, ["styles"]));
app.use("/*", FrontlessMiddleware(__dirname, ["styles"]));

app.setState = (id, data) => {
  return {
    opts: {
      _t: "/m/",
      _id: id
    },
    data
  };
};

const start = db => {
  require("./services")(app, db);
  app.listen(6767, () => {
    console.log(`👍  app is listening on ${6767} \r\n`);
  });
};

if (process.env.MONGODB_URI) {
  const MongoClient = require("mongodb").MongoClient;
  MongoClient.connect(process.env.MONGODB_URI, { useNewUrlParser: true })
    .then(db => {
      console.log(`✔️ MongoDB connection is active`);
      start(db);
    })
    .catch(err => {
      console.error(`❌  MongoDB connection error`, err);
      console.log("↪️ Trying to continue without MongoDB");
      start();
    });
} else {
  start();
}
