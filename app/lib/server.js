/*
* Server related tasks
*
*/

// Dependencies
const http = require("http");
let https = require("https");
const url = require("url");
const fs = require("fs");
const StringDecoder = require("string_decoder").StringDecoder;
let config = require("./config");
let handlers = require('./handlers')
let helpers = require('./helpers')
let path = require('path')

//Instantiate the server module object
let server = {}



// Instantiating the http server
server.httpServer = http.createServer((req, res) => {
  server.unifiedServer(req, res);
});

server.httpsServerOptions = {
  key: fs.readFileSync(path.join(__dirname, "/../https/key.pem")),
  cert: fs.readFileSync(path.join(__dirname, "/../https/cert.pem")),
};

server.httpsServer = https.createServer(server.httpsServerOptions, (req, res) => {
  server.unifiedServer(req, res);
});





// Create logic for both the htpp and https server

server.unifiedServer = (req, res) => {
  //Get the url and parse it (parsedUrl is an object with keys about the url one of which is pathname)
  let parsedUrl = url.parse(req.url, true);

  //Get the path and then we trim it to take off extraneous slashes
  let path = parsedUrl.pathname;
  let trimmedPath = path.replace(/^\/+|\/+$/g, "");

  // Get the query string as an object
  let queryStringObject = parsedUrl.query;

  //Get the HTTP method (It's one of the keys on req object which is new for each request)
  let method = req.method.toLowerCase();

  //Get the headers as an object
  let headers = req.headers;

  //Get the payload, if any
  let decoder = new StringDecoder("utf-8");
  let buffer = "";
  req.on("data", (data) => {
    console.log("Hey");
    buffer += decoder.write(data);
  });
  req.on("end", () => {
    buffer += decoder.end();

    //Choose the handler the req should go too.  If none, it should go to the not found handler

    let chosenHandler =
      typeof server.router[trimmedPath] !== "undefined"
        ? server.router[trimmedPath]
        : handlers.notFound;

    //Construct data object to send to handler

    let data = {
      trimmedPath: trimmedPath,
      queryStringObject: queryStringObject,
      method: method,
      headers: headers,
      payload: helpers.parseJsonToObject(buffer),
    };

    //Route the request to the handler

    chosenHandler(data, (statusCode, payload) => {
      //Use the status code by handler or default to 200
      statusCode = typeof statusCode == "number" ? statusCode : 200;

      //Use the payload call back on the handler or default to an empty object
      payload = typeof payload == "object" ? payload : {};

      //Convert the payload to a string
      let payloadString = JSON.stringify(payload);

      //Return the response
      res.setHeader("Content-Type", "application/json");
      res.writeHead(statusCode);
      res.end(payloadString);
      console.log(`Returning this response`, statusCode, payload);
    });

    //Send a response
    // res.end("Hi there from the server\n");

    //Log the request path

    //console.log(`Request received on path: ${trimmedPath} with method: ${method},with these query string parameters:`, queryStringObject);
    //console.log(`Request received with these headers:`, headers);
    // console.log(`Request received with this payload:`, buffer);
  });
};


//Defining a request router

server.router = {
  ping: handlers.ping,
  users: handlers.users,
  tokens: handlers.tokens,
  checks: handlers.checks
};

// Init script
server.init = () => {
    //Start the HTTP server
    server.httpServer.listen(config.httpPort, () => {
        console.log(`The server is listening on port ${config.httpPort}`);
      });

    //Start the HTTPS server
    server.httpsServer.listen(config.httpsPort, () => {
        console.log(`The server is listening on port ${config.httpsPort}`);
      });
}

//Export the server

module.exports = server
