//Library for storing and editing data

// Dependencies

const fs = require("fs");
const path = require("path");
const helpers = require('./helpers')

// Container for the module to b eexported
let lib = {};

//Base directory of the data folder
lib.baseDir = path.join(__dirname, "/../.data/");

//Write the data to a file

lib.create = (dir, file, data, callback) => {
  //Open the file for writing
  fs.open(
    lib.baseDir + dir + "/" + file + ".json",
    "wx",
    (err, fileDescriptor) => {
      if (!err && fileDescriptor) {
        //Convert data to a string
        let stringData = JSON.stringify(data);

        //Write to file and close it

        fs.writeFile(fileDescriptor, stringData, (err) => {
          if (!err) {
            fs.close(fileDescriptor, (err) => {
              if (!err) {
                callback(false);
              } else {
                callback("Error closing File");
              }
            });
          }
        });
      } else {
        callback("Could not create file.  It may already exist");
      }
    }
  );
};

// Read data from a file

lib.read = (dir, file, callback) => {
  fs.readFile(lib.baseDir + dir + "/" + file + ".json", "utf8", (err, data) => {
      if(!err && data) {
          let parsedData = helpers.parseJsonToObject(data)
          callback(false, parsedData)
      }else {
          callback(err, data);

      }
  });
};



//Update a file

lib.update = (dir, file, data, callback) => {
  //Open the file for writing
  fs.open(
    lib.baseDir + dir + "/" + file + ".json",
    "r+",
    (err, fileDescriptor) => {
      if (!err && fileDescriptor) {
        //Convert data to a string
        let stringData = JSON.stringify(data);

        //Truncate the file

        fs.ftruncate(fileDescriptor, (err) => {
          if (!err) {
            //Write to file and close it

            fs.writeFile(fileDescriptor, stringData, (err) => {
              if (!err) {
                fs.close(fileDescriptor, (err) => {
                  if (!err) {
                    callback(false);
                  } else {
                    callback("Error closing File");
                  }
                });
              }
            });
          } else {
            callback("Error truncating file");
          }
        });
      } else {
        callback("Could not open file for updating.");
      }
    }
  );
};

// Delete a File
lib.delete = (dir, file, callback) => {
    fs.unlink(lib.baseDir + dir + "/" + file + ".json", (err) => {
        if (!err) {
            callback(false)
        } else {
            callback('Error deleting file')
        }
    })
}

// List all the items in a directory
lib.list = (dir, callback) => {
  fs.readdir(lib.baseDir + dir +'/', (err, data) => {
    if(!err && data && data.length >0) {
      let trimmedFileNames = []
      data.forEach((fileName) => {
        trimmedFileNames.push(fileName.replace('.json', ''))
      })
      callback(false, trimmedFileNames)

    }else {
      callback(err, data)
    }
  })
}

// Export the module
module.exports = lib;
