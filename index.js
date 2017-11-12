var async = require("async");
var AWS = require("aws-sdk");

var im = require("gm").subClass({imageMagick: true});
var s3 = new AWS.S3();

var CONFIG = require("./config.json");

function getImageType(objectContentType) {
  if (objectContentType === "image/jpeg") {
    return "jpeg";
  } else if (objectContentType === "image/png") {
    return "png";
  } else {
    //throw new Error("unsupported objectContentType " + objectContentType);
    return "jpeg";
  }
}

function cross(left, right) {
  var res = [];
  var resTmp = []
  Object.keys(left).forEach(function(key) {
    right.forEach(function(r) {
      var ob = {}
      ob[key] = left[key]
      resTmp.push([ob, "images"]);
      res.push([ob, r]);
    });
  });
  console.log("resTmp ", JSON.stringify(resTmp));
  return res;
}

exports.handler = function(event, context) {
  console.log("event ", JSON.stringify(event));
  async.mapLimit(event.Records, CONFIG.concurrency, function(record, cb) {
    var originalKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
    s3.getObject({
      "Bucket": record.s3.bucket.name,
      "Key": originalKey
    }, function(err, data) {
      if (err) {
        cb(err);
      } else {
        cb(null, {
          "originalKey": originalKey,
          "contentType": data.ContentType,
          "imageType": getImageType(data.ContentType),
          "buffer": data.Body,
          "record": record
        });
      }
    });
  }, function(err, images) {
    if (err) {
      context.fail(err);
    } else {
      //console.log("images: " + JSON.stringify(images));
      entidad = images[0].originalKey.split('/')[1]
      console.log("entidad: " + entidad);
      var resizePairs = cross(CONFIG['sizes'][entidad], images);
      // console.log("resizePairs: " + resizePairs);
      // console.log("resizePairs: ", JSON.stringify(resizePairs));
      //var resizePairs = cross(CONFIG.sizes, images);
      async.eachLimit(resizePairs, CONFIG.concurrency, function(resizePair, cb) {
        // var config = Object.values(resizePair)
        var config = resizePair[0];
        var configSize = Object.keys(config)[0];
        var configValue = config[configSize];
        // var config = resizePair[0];
        var image = resizePair[1];
        console.log("configValue: ", configValue.split(','));
        im(image.buffer).resize(configValue.split(',')).toBuffer(image.imageType, function(err, buffer) {
          if (err) {
            cb(err);
          } else {
            //destBucket = record.s3.bucket.name;
            //destBucket = "devbucket";
            destBucket = CONFIG['destBucket'];
            console.log("destBucket: " + destBucket);
            carpeta = image.originalKey.split('/')[1]
            destKey =  carpeta  + "/" + configSize + "/" + image.originalKey.split('/').pop();
            console.log("destKey: " + destKey);
            if (destKey.split('.').pop()!='jpg') {
              destKey += ".jpg"
            }
            console.log("destKey: " + destKey);
            s3.putObject({
              "Bucket": destBucket,
              "Key": destKey,
              "Body": buffer,
              "ACL": 'public-read',
              "ContentType": "image/jpeg"
            }, function(err) {
              cb(err);
            });
          }
        });
      }, function(err) {
        if (err) {
          context.fail(err);
        } else {
          context.succeed();
        }
      });
    }
  });
};
