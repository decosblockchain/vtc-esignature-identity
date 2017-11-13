const MongoClient = require('mongodb').MongoClient;
const connectString = "mongodb://" + (process.env.MONGO_HOST || "mongodb") + ":27017/vtc-esignature";

class MongoConnector {
  static connect(callback, retries) {
    if(!retries) retries = 0;
    MongoClient.connect(connectString, function(error, db) {
      if(!error) {
        callback(error, db);
      } else {
        console.log("Got error while connecting to MongoDB");
        if(retries > 10) {
          console.log("Retried for 10 times. Cancelling try and forwarding error");
          console.error(error);
          callback(error, null);
        } else {
          console.warn(error);
          console.log("Retrying after 1 second");
          setTimeout(function() {
            MongoConnector.connect(callback, ++retries);
          }, 1000);
        }
      }
    });
  }

  static connectFromController(res, callback) {
    MongoConnector.connect((err, db) => {
      if(err) { res.sendStatus(500); }
      else { callback (db); }
    });
  }
}

module.exports = { MongoConnector };