/*
 * Worker related tasks
 *
 */

// Dependencies
const path = require("path");
const fs = require("fs");
const _data = require("./data");
const https = require("https");
const http = require("http");
const helpers = require("./helpers");
const url = require("url");
const { worker } = require("cluster");

//Instantiate the worker object
let workers = {};

//Lookup all the checks, get their data and send to a validator
workers.gatherAllChecks = () => {
  //Get all the checks
  _data.list("checks", (err, checks) => {
    if (!err && checks && checks.length > 0) {
      checks.forEach((check) => {
        //Read all the check data. Each check name already has.json taken off
        _data.read("checks", check, (err, originalCheckData) => {
          if (!err && originalCheckData) {
            //Pass the data to the check validator and let that function continue or log errors as needed.  No need to return status because there's no request coming in
            workers.validateCheckData(originalCheckData);
          } else {
            console.log("Error reading one of the check's data");
          }
        });
      });
    } else {
      console.log("Error: Could not find any checks to process");
    }
  });
};

// sanity-check the check data
workers.validateCheckData = (originalCheckData) => {
  originalCheckData =
    typeof originalCheckData == "object" && originalCheckData !== null
      ? originalCheckData
      : {};

  originalCheckData.id =
    typeof originalCheckData.id == "string" &&
    originalCheckData.id.trim().length == 20
      ? originalCheckData.id
      : false;

  originalCheckData.userPhone =
    typeof originalCheckData.userPhone == "string" &&
    originalCheckData.userPhone.trim().length == 10
      ? originalCheckData.userPhone
      : false;

  originalCheckData.protocol =
    typeof originalCheckData.protocol == "string" &&
    ["http", "https"].indexOf(originalCheckData.protocol) > -1
      ? originalCheckData.protocol
      : false;

  originalCheckData.url =
    typeof originalCheckData.url == "string" &&
    originalCheckData.url.trim().length > 0
      ? originalCheckData.url
      : false;

  originalCheckData.method =
    typeof originalCheckData.method == "string" &&
    ["post", "get", "put", "delete"].indexOf(originalCheckData.method) > -1
      ? originalCheckData.method
      : false;

  originalCheckData.successCodes =
    typeof originalCheckData.successCodes == "object" &&
    originalCheckData.successCodes instanceof Array &&
    originalCheckData.successCodes.length > 0
      ? originalCheckData.successCodes
      : false;

  originalCheckData.timeoutSeconds =
    typeof originalCheckData.timeoutSeconds == "number" &&
    originalCheckData.timeoutSeconds % 1 === 0 &&
    originalCheckData.timeoutSeconds >= 1 &&
    originalCheckData.timeoutSeconds <= 5
      ? originalCheckData.timeoutSeconds
      : false;

    //Set the keys that may not be set if the workers have never seen this check before
    originalCheckData.state = typeof originalCheckData.state == "string" &&
    ["up", "down"].indexOf(originalCheckData.state) > -1
      ? originalCheckData.state
      : 'down';

      originalCheckData.lastChecked =
      typeof originalCheckData.lastChecked == "number" &&
      originalCheckData.lastChecked > 0
        ? originalCheckData.lastChecked
        : false;

    //If all the checks pass, pass the data along to the next step in the process
    if(originalCheckData.id && originalCheckData.userPhone && originalCheckData.protocol && originalCheckData.url && originalCheckData.method && originalCheckData.successCodes && originalCheckData.timeoutSeconds) {

        workers.performCheck(originalCheckData)

    } else {
        console.log("Error: One of the checks is not properly formatted");
    }
};

//Perform the check, send the original check Data and the outcome of the check process to the next step in the process
workers.performCheck = (originalCheckData) => {
    //prepare the initial check outcome
    let checkOutcome = {
        'error': false,
      'responseCode': false
    }

    // Mark that the outcome has not been sent yet
    let outcomeSent = false

    //Parse the hostname and path out of the original check data
    let parsedUrl = url.parse(originalCheckData.protocol + '://' + originalCheckData.url, true)
    let hostName = parsedUrl.hostname
    let path = parsedUrl.path //We're not using "pathname" because we want the query string

    //Constructing the request

    let requestDetails = {
        'protocol': originalCheckData.protocol + ':',
        'hostname': hostName,
        'method': originalCheckData.method.toUpperCase(),
        'path': path,
        'timeout': originalCheckData.timeoutSeconds * 1000 //Because this is esxpecting milliseconds
    }

    // Instantiate the request object using http or https
    let _moduleToUse = originalCheckData.protocol == 'http' ? http : https
    let req = _moduleToUse.request(requestDetails, (res) => {
        // Grab the status of the sent request
        let status = res.statusCode
        //Update teh check outcome and pass the data along
        checkOutcome.responseCode = status
        if(!outcomeSent) {
            workers.processCheckOutcome(originalCheckData, checkOutcome)
            outcomeSent = true
        }
    })

    //Bind to teh error event so it doesn't get thrown

    req.on('error', (e) => {
        // Update the check outcome and pass the data along
        checkOutcome.error = {
            'error': true,
            'value': e
        }
        if(!outcomeSent) {
            workers.processCheckOutcome(originalCheckData, checkOutcome)
            outcomeSent = true
        }
        
    })
    req.on('timeout', (e) => {
        // Update the check outcome and pass the data along
        checkOutcome.error = {
            'error': true,
            'value': 'timeout'
        }
        if(!outcomeSent) {
            workers.processCheckOutcome(originalCheckData, checkOutcome)
            outcomeSent = true
        }
        
    })

    //End the request
    req.end()
}

// Process the check outcome and update teh check data as needed and alert the user if needed
// Special logic for accomodating a check that has never been tested before and only alert user when we've first actually run a check i.e. We don't alert when the check reports its default status of 'down' when we haven't run it yet

workers.processCheckOutcome = (originalCheckData, checkOutcome) => {
    // Decide if the check's state is up or down
    let state = !checkOutcome.error && checkOutcome.responseCode && originalCheckData.successCodes.indexOf(checkOutcome.responseCode) > -1 ? 'up' : 'down'

    // Decide if an alert is warranted: It has been checked before and the last recorded state is different from the past recorded state
    let alertWarranted = originalCheckData.lastChecked && originalCheckData.state !==  state ? true : false

    //Update the check data
    let newCheckData = originalCheckData
    newCheckData.state = state
    newCheckData.lastChecked = Date.now()
    
    _data.update('checks', newCheckData.id, newCheckData, (err) => {
        if(!err) {
            //Save the new check data to the next phase of teh process if needed
            if(alertWarranted) {
                workers.alertUserToStatusChange(newCheckData)
            }else {
                console.log('Check outcome has not changed so no alert needed');
            }
        } else {
            console.log('Error trying to save updates to one of the checks');
        }
    })
} 

// Alert the user as to a change in their check status
workers.alertUserToStatusChange = (newCheckData) => {
    let msg = `Alert: Your check for ${newCheckData.method.toUpperCase()} ${newCheckData.protocol}://${newCheckData.url} is currently ${newCheckData.state}` 

    helpers.sendTwilioSms(newCheckData.userPhone, msg, (err) => {
        if(!err) {
            console.log('Success: User was alerted to a status change via SMS,', msg);
        } else {
            console.log('Error: could not alert the user who had a state change in their check');
        }
    })
}

//Timer to execute the workers-process once per minute
workers.loop = () => {
  setInterval(() => {
    workers.gatherAllChecks();
  }, 1000 * 60);
};

//Init script
workers.init = () => {
  //Execute all the checks immediately
  workers.gatherAllChecks();

  //Call a loop so that the checks continue to execute on their own
  workers.loop();
};

//Export the module
module.exports = workers;
