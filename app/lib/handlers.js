/*
Request Handlers
*
*
*/

//Dependencies

let _data = require("./data");
let helpers = require("./helpers");
let config = require("./config");

//Defining handlers
let handlers = {};

//Users

handlers.users = (data, callback) => {
  let acceptableMethods = ["post", "get", "put", "delete"];
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._users[data.method](data, callback);
  } else {
    callback(405);
  }
};

// Container for the users submethods

handlers._users = {};

//Users post
//Required data: firstname, lastname, phone, password, toSAgreement
//Optional Data: none
handlers._users.post = (data, callback) => {
  //Check that all required fields are filled out
  let firstName =
    typeof data.payload.firstName == "string" &&
    data.payload.firstName.trim().length > 0
      ? data.payload.firstName.trim()
      : false;
  let lastName =
    typeof data.payload.lastName == "string" &&
    data.payload.lastName.trim().length > 0
      ? data.payload.lastName.trim()
      : false;
  let phone =
    typeof data.payload.phone == "string" &&
    data.payload.phone.trim().length == 10
      ? data.payload.phone.trim()
      : false;
  let password =
    typeof data.payload.password == "string" &&
    data.payload.password.trim().length > 0
      ? data.payload.password.trim()
      : false;
  let tosAgreement =
    typeof data.payload.tosAgreement == "boolean" &&
    data.payload.tosAgreement == true
      ? true
      : false;

  if (firstName && lastName && phone && password && tosAgreement) {
    //Make sure user doesn't already exist
    _data.read("users", phone, (err, data) => {
      if (err) {
        //Hash the password
        let hashedPassword = helpers.hash(password);
        if (hashedPassword) {
          //Create the user object
          let userObject = {
            firstName: firstName,
            lastName: lastName,
            phone: phone,
            hashedPassword: hashedPassword,
            tosAgreement: true,
          };

          //Store the user
          _data.create("users", phone, userObject, (err) => {
            if (!err) {
              callback(200);
            } else {
              console.log(err);
              callback(500, { Error: "Could not create new user" });
            }
          });
        } else {
          callback(500, { Error: "Could not hash user's password" });
        }
      } else {
        //User already exists
        callback(400, { Error: "User exists already" });
      }
    });
  } else {
    callback(400, { Error: "Missing required fields" });
  }
};

//Users get
//Required data: phone
//Optional data: none

handlers._users.get = (data, callback) => {
  //check that the phone number is valid
  let phone =
    typeof data.queryStringObject.phone == "string" &&
    data.queryStringObject.phone.trim().length == 10
      ? data.queryStringObject.phone.trim()
      : false;

  if (phone) {
    //Get the token from the headers
    let token =
      typeof data.headers.token == "string" ? data.headers.token : false;
    //Verify that teh given token is valid for the phone number
    handlers._tokens.verifyToken(token, phone, (tokenIsValid) => {
      if (tokenIsValid) {
        //Lookup the user
        _data.read("users", phone, (err, data) => {
          if (!err && data) {
            //Remove the hashed password from the user object before returning it to the requester
            delete data.hashedPassword;
            callback(200, data);
          } else {
            callback(404);
          }
        });
      } else {
        callback(403, {
          Error: "Missing required token in header or token is invalid",
        });
      }
    });
  } else {
    callback(400, { Error: "Missing required field" });
  }
};

//Users put
//Required data: phone
//Optional data: firstName, lastName, password.  At least one must be specified

handlers._users.put = (data, callback) => {
  let phone =
    typeof data.payload.phone == "string" &&
    data.payload.phone.trim().length == 10
      ? data.payload.phone.trim()
      : false;

  //Check for the optional data
  let firstName =
    typeof data.payload.firstName == "string" &&
    data.payload.firstName.trim().length > 0
      ? data.payload.firstName.trim()
      : false;
  let lastName =
    typeof data.payload.lastName == "string" &&
    data.payload.lastName.trim().length > 0
      ? data.payload.lastName.trim()
      : false;
  let password =
    typeof data.payload.password == "string" &&
    data.payload.password.trim().length > 0
      ? data.payload.password.trim()
      : false;

  //Error if phone is missing
  if (phone) {
    //Error if nothing is sent to update
    if (firstName || lastName || password) {
      //Get the token from the headers
      let token =
        typeof data.headers.token == "string" ? data.headers.token : false;
      //Verify that the given token is valid for the phone number
      handlers._tokens.verifyToken(token, phone, (tokenIsValid) => {
        if (tokenIsValid) {
          //Lookup the user
          _data.read("users", phone, (err, userData) => {
            if (!err && userData) {
              //Update the necessary fields
              if (firstName) {
                userData.firstName = firstName;
              }
              if (lastName) {
                userData.lastName = lastName;
              }
              if (password) {
                userData.hashedPassword = helpers.hash(password);
              }

              _data.update("users", phone, userData, (err) => {
                if (!err) {
                  callback(200);
                } else {
                  console.log(err);
                  callback(500, { Error: "Could not update the user" });
                }
              });
            } else {
              callback(400, { Error: "The specified user does not exist" });
            }
          });
        } else {
          callback(403, {
            Error: "Missing required token in header or token is invalid",
          });
        }
      });
    } else {
      callback(400, { Error: "Missing fields to update" });
    }
  } else {
    callback(400, { Error: "Missing required field" });
  }
};
//Users delete
//Required Data: phone

handlers._users.delete = (data, callback) => {
  //check that the phone number is valid
  let phone =
    typeof data.queryStringObject.phone == "string" &&
    data.queryStringObject.phone.trim().length == 10
      ? data.queryStringObject.phone.trim()
      : false;

  if (phone) {
    //Get the token from the headers
    let token =
      typeof data.headers.token == "string" ? data.headers.token : false;
    //Verify that the given token is valid for the phone number
    handlers._tokens.verifyToken(token, phone, (tokenIsValid) => {
      if (tokenIsValid) {
        //Lookup the user
        _data.read("users", phone, (err, userData) => {
          if (!err && data) {
            _data.delete("users", phone, (err) => {
              if (!err) {
                //Delete each check associated with the user
                let userChecks =
                  typeof userData.checks == "object" &&
                  userData.checks instanceof Array
                    ? userData.checks
                    : [];
                let checksToDelete = userChecks.length;
                if (checksToDelete > 0) {
                  let checksDeleted = 0;
                  let deletionErrors = false;
                  //Loop through the checks
                  userChecks.forEach((checkId) => {
                    _data.delete("checks", checkId, (err) => {
                      if (err) {
                        deletionErrors = true;
                      }
                      checksDeleted++;
                      if (checksDeleted == checksDeleted) {
                        if (!deletionErrors) {
                          callback(200);
                        } else {
                          callback(500, {
                            Error:
                              "Errors encountered while attempting to delete all of the user's checks.  The user's checks may not all have deleted successfully",
                          });
                        }
                      }
                    });
                  });
                } else {
                  callback(200);
                }
              } else {
                callback(500, { Error: "Could not delete the specified user" });
              }
            });
          } else {
            callback(400, { Error: "Could not find the specified user" });
          }
        });
      } else {
        callback(403, {
          Error: "Missing required token in header or token is invalid",
        });
      }
    });
  } else {
    callback(400, { Error: "Missing required field" });
  }
};

//tokens

handlers.tokens = (data, callback) => {
  let acceptableMethods = ["post", "get", "put", "delete"];
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._tokens[data.method](data, callback);
  } else {
    callback(405);
  }
};

//Container for all the tokens methods

handlers._tokens = {};

//Tokens - post
//Required data: phone, password
//Optional data: none

handlers._tokens.post = (data, callback) => {
  let phone =
    typeof data.payload.phone == "string" &&
    data.payload.phone.trim().length == 10
      ? data.payload.phone.trim()
      : false;
  let password =
    typeof data.payload.password == "string" &&
    data.payload.password.trim().length > 0
      ? data.payload.password.trim()
      : false;

  if (phone && password) {
    //Lookup the user who matches that phone number
    _data.read("users", phone, (err, userData) => {
      if (!err && userData) {
        //Hash the password and compare it
        let hashedPassword = helpers.hash(password);
        if (hashedPassword == userData.hashedPassword) {
          //if valid, create a new token with a random name and set expiration for 1 hour in the future
          let tokenId = helpers.createRandomString(20);

          let expires = Date.now() + 1000 * 60 * 60;
          let tokenObject = {
            phone: phone,
            id: tokenId,
            expires: expires,
          };

          _data.create("tokens", tokenId, tokenObject, (err) => {
            if (!err) {
              callback(200, tokenObject);
            } else {
              callback(500, { Error: "Could not create the new token" });
            }
          });
        } else {
          callback(400, {
            Error:
              "Password did not match the specified user's stored password",
          });
        }
      } else {
        callback(404, { Error: "Missing required Fields" });
      }
    });
  }
};
//Tokens - get
// Required data: id
//Optional data: none
handlers._tokens.get = (data, callback) => {
  //check that the id is valid
  let id =
    typeof data.queryStringObject.id == "string" &&
    data.queryStringObject.id.trim().length == 20
      ? data.queryStringObject.id.trim()
      : false;

  if (id) {
    //Lookup the token
    _data.read("tokens", id, (err, tokenData) => {
      if (!err && tokenData) {
        callback(200, tokenData);
      } else {
        callback(404);
      }
    });
  } else {
    callback(400, { Error: "Missing required field" });
  }
};

//Tokens - put
//Required data: id, extend
//Optional data: none
handlers._tokens.put = (data, callback) => {
  let id =
    typeof data.payload.id == "string" && data.payload.id.length == 20
      ? data.payload.id
      : false;
  let extend =
    typeof data.payload.extend == "boolean" && data.payload.extend == true
      ? data.payload.extend
      : false;

  if (id && extend) {
    //Lookup the token
    _data.read("tokens", id, (err, tokenData) => {
      if (!err && tokenData) {
        //Check to see if token has expired
        if (tokenData.expires > Date.now()) {
          //set the expiration an hour from now
          tokenData.expires = Date.now() + 1000 * 60 * 60;
          _data.update("tokens", id, tokenData, (err) => {
            if (!err) {
              callback(200);
            } else {
              callback(500, {
                Error: "Could not update the token's expiration",
              });
            }
          });
        } else {
          callback(400, {
            Error: "The token has already expired and cannot be extended",
          });
        }
      } else {
        callback(400, { Error: "specified token does not exist" });
      }
    });
  } else {
    callback(400, { Error: "Missing required fields or fields are invalid" });
  }
};
//Tokens - delete
//Required data: id
//Optional dta: none

handlers._tokens.delete = (data, callback) => {
  //check that id is valid
  let id =
    typeof data.queryStringObject.id == "string" &&
    data.queryStringObject.id.trim().length == 20
      ? data.queryStringObject.id.trim()
      : false;

  if (id) {
    //Lookup the user
    _data.read("tokens", id, (err, data) => {
      if (!err && data) {
        _data.delete("tokens", id, (err) => {
          if (!err) {
            callback(200);
          } else {
            callback(500, { Error: "Could not delete the token" });
          }
        });
      } else {
        callback(400, { Error: "Could not find the token" });
      }
    });
  } else {
    callback(400, { Error: "Missing required field" });
  }
};

//Verify if a given tokenid is valid for a given user

handlers._tokens.verifyToken = (id, phone, callback) => {
  //Lookup the token
  _data.read("tokens", id, (err, tokenData) => {
    if (!err && tokenData) {
      //Check that the token data is for the given user and has not expired
      if (tokenData.phone == phone && tokenData.expires > Date.now()) {
        callback(true);
      } else {
        callback(false);
      }
    }
  });
};

//checks

handlers.checks = (data, callback) => {
  let acceptableMethods = ["post", "get", "put", "delete"];
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._checks[data.method](data, callback);
  } else {
    callback(405);
  }
};

//container for all the checks
handlers._checks = {};

//Checks - Post
//Required Data: protocol, urlmethod, successcodes, timeout seconds
//Optional data: none

handlers._checks.post = (data, callback) => {
  let protocol =
    typeof data.payload.protocol == "string" &&
    ["http", "https"].indexOf(data.payload.protocol > -1)
      ? data.payload.protocol
      : false;
  let url =
    typeof data.payload.url == "string" && data.payload.url.trim().length > 0
      ? data.payload.url.trim()
      : false;

  let method =
    typeof data.payload.method == "string" &&
    ["post", "get", "put", "delete"].indexOf(data.payload.method > -1)
      ? data.payload.method
      : false;

  let successCodes =
    typeof data.payload.successCodes == "object" &&
    data.payload.successCodes instanceof Array &&
    data.payload.successCodes.length > 0
      ? data.payload.successCodes
      : false;

  let timeoutSeconds =
    typeof data.payload.timeoutSeconds == "number" &&
    data.payload.timeoutSeconds % 1 === 0 &&
    data.payload.timeoutSeconds >= 1 &&
    data.payload.timeoutSeconds <= 5
      ? data.payload.timeoutSeconds
      : false;

  if ((protocol, method, successCodes, timeoutSeconds)) {
    // Get the token from the headers
    let token =
      typeof data.headers.token == "string" ? data.headers.token : false;

    //lookup the user by reading the token
    _data.read("tokens", token, (err, tokenData) => {
      if (!err && tokenData) {
        let userPhone = tokenData.phone;

        //Lookup the user data
        _data.read("users", userPhone, (err, userData) => {
          if (!err && userData) {
            let userChecks =
              typeof userData.checks == "object" &&
              userData.checks instanceof Array
                ? userData.checks
                : [];
            //Verify the user has less than maxchecks
            if (userChecks.length < config.maxChecks) {
              // create random id for the checks
              let checkId = helpers.createRandomString(20);

              //Create the check object and include the user's phone
              let checkObject = {
                id: checkId,
                userPhone: userPhone,
                protocol: protocol,
                url: url,
                method: method,
                successCodes: successCodes,
                timeoutSeconds: timeoutSeconds,
              };

              //Save the object

              _data.create("checks", checkId, checkObject, (err) => {
                if (!err) {
                  //Add the checkId to the user's object
                  userData.checks = userChecks;
                  userData.checks.push(checkId);

                  //Save the new user data
                  _data.update("users", userPhone, userData, (err) => {
                    if (!err) {
                      //Return the data about the new check
                      callback(200, checkObject);
                    } else {
                      callback(500, {
                        Error: "could not update the user with a new check",
                      });
                    }
                  });
                } else {
                  callback(500, { Error: "Could not create the new check" });
                }
              });
            } else {
              callback(400, {
                Error: "The user has exceeded the max number of checks (5)",
              });
            }
          } else {
            callback(403, { Error: "Could not find the specified user" });
          }
        });
      } else {
        callback(403, { Error: "Could not find the specified token" });
      }
    });
  } else {
    callback(400, { Error: "Missing required inputs or inputs are invalid" });
  }
};

//Checks - get
//Required Data: id
//Optional Data: none

handlers._checks.get = (data, callback) => {
  //check that the id is valid
  let id =
    typeof data.queryStringObject.id == "string" &&
    data.queryStringObject.id.trim().length == 20
      ? data.queryStringObject.id.trim()
      : false;

  if (id) {
    //Lookup the check
    _data.read("checks", id, (err, checkData) => {
      if (!err && checkData) {
        //Get the token from the headers
        let token =
          typeof data.headers.token == "string" ? data.headers.token : false;
        //Verify that the given token is valid and belongs to user who created the check
        handlers._tokens.verifyToken(
          token,
          checkData.userPhone,
          (tokenIsValid) => {
            if (tokenIsValid) {
              //Return the checkData
              callback(200, checkData);
            } else {
              callback(403, {
                Error: "Missing required token in header or token is invalid",
              });
            }
          }
        );
      } else {
        callback(404, { Error: "Could not find the secified check" });
      }
    });
  } else {
    callback(400, { Error: "Missing required field" });
  }
};

//Checks - put
//Required data: id
//Optional Data: protocol, url, method, successCodes, Timeoutseconds.  One must be sent

handlers._checks.put = (data, callback) => {
  let id =
    typeof data.payload.id == "string" && data.payload.id.trim().length == 20
      ? data.payload.id.trim()
      : false;

  //Check for the optional data
  let protocol =
    typeof data.payload.protocol == "string" &&
    ["http", "https"].indexOf(data.payload.protocol > -1)
      ? data.payload.protocol
      : false;
  let url =
    typeof data.payload.url == "string" && data.payload.url.trim().length > 0
      ? data.payload.url.trim()
      : false;

  let method =
    typeof data.payload.method == "string" &&
    ["post", "get", "put", "delete"].indexOf(data.payload.method > -1)
      ? data.payload.method
      : false;

  let successCodes =
    typeof data.payload.successCodes == "object" &&
    data.payload.successCodes instanceof Array &&
    data.payload.successCodes.length > 0
      ? data.payload.successCodes
      : false;

  let timeoutSeconds =
    typeof data.payload.timeoutSeconds == "number" &&
    data.payload.timeoutSeconds % 1 === 0 &&
    data.payload.timeoutSeconds >= 1 &&
    data.payload.timeoutSeconds <= 5
      ? data.payload.timeoutSeconds
      : false;

  //Check if id is valid
  if (id) {
    //Make sure they've included at least one of the required fields
    if (protocol || url || method || successCodes || timeoutSeconds) {
      _data.read("checks", id, (err, checkData) => {
        if (!err && checkData) {
          //Get the token from the headers
          let token =
            typeof data.headers.token == "string" ? data.headers.token : false;
          //Verify that the given token is valid and belongs to user who created the check
          handlers._tokens.verifyToken(
            token,
            checkData.userPhone,
            (tokenIsValid) => {
              if (tokenIsValid) {
                //Update the check where necessary
                if (protocol) {
                  checkData.protocol = protocol;
                }
                if (url) {
                  checkData.url = url;
                }
                if (method) {
                  checkData.method = method;
                }
                if (successCodes) {
                  checkData.successCodes = successCodes;
                }
                if (timeoutSeconds) {
                  checkData.timeoutSeconds = timeoutSeconds;
                }

                //Store the update
                _data.update("checks", id, checkData, (err) => {
                  if (!err) {
                    callback(200, checkData);
                  } else {
                    callback(500, { Error: "Could not update the check" });
                  }
                });
              } else {
                callback(403, {
                  Error: "Missing required token in header or token is invalid",
                });
              }
            }
          );
        } else {
          callback(400, { Error: "Check id did not exist" });
        }
      });
    } else {
      callback(400, { Error: "Missing fields to update" });
    }
  } else {
    callback(400, { Error: "Missing Required Field" });
  }
};

// Checks - delete
//Required Data: id
//Optional data: none

handlers._checks.delete = (data, callback) => {
  //check that the phone number is valid
  let id =
    typeof data.queryStringObject.id == "string" &&
    data.queryStringObject.id.trim().length == 20
      ? data.queryStringObject.id.trim()
      : false;

  if (id) {
    //Look up the check that they want to delete
    _data.read("checks", id, (err, checkData) => {
      if (!err && checkData) {
        //Get the token from the headers
        let token =
          typeof data.headers.token == "string" ? data.headers.token : false;
        //Verify that the given token is valid for the phone number
        handlers._tokens.verifyToken(
          token,
          checkData.userPhone,
          (tokenIsValid) => {
            if (tokenIsValid) {
              //Delete the check data

              _data.delete("checks", id, (err) => {
                if (!err) {
                  //Lookup the user
                  _data.read("users", checkData.userPhone, (err, userData) => {
                    if (!err && userData) {
                      let userChecks =
                        typeof userData.checks == "object" &&
                        userData.checks instanceof Array
                          ? userData.checks
                          : [];
                      //Delete the check from their list of checks
                      let checkPosition = userChecks.indexOf(id);
                      if (checkPosition > -1) {
                        userChecks.splice(checkPosition, 1);
                        //Re-save the users data
                        _data.update(
                          "users",
                          checkData.userPhone,
                          userData,
                          (err) => {
                            if (!err) {
                              callback(200);
                            } else {
                              callback(500, {
                                Error:
                                  "Could not update the check data from the specified user who created the check",
                              });
                            }
                          }
                        );
                      } else {
                        callback(500, {
                          Error:
                            "Could not find the check on the user's object so could not remove it",
                        });
                      }
                    } else {
                      callback(500, {
                        Error:
                          "Could not find the user who created the check so could not delete the check data from their check object",
                      });
                    }
                  });
                } else {
                  callback(500, { Error: "Could not delete the check data" });
                }
              });
            } else {
              callback(403, {
                Error: "Missing required token in header or token is invalid",
              });
            }
          }
        );
      } else {
        callback(400, { Error: "Specified check id does not exist" });
      }
    });
  } else {
    callback(400, { Error: "Missing required field" });
  }
};

//Ping Handler just to let us know that the application is alive
handlers.ping = (data, callback) => {
  //callback a http status code
  callback(200);
};

//Not found handler
handlers.notFound = (data, callback) => {
  callback(404);
};

module.exports = handlers;
