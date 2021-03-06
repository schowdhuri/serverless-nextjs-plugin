const fs = require("fs");
const path = require("path");
const walkDir = require("klaw");
const mime = require("mime");
const logger = require("../utils/logger");

const uploadStaticAssetsToS3 = ({
  staticAssetsPath,
  bucketName,
  providerRequest
}) => {
  return new Promise((resolve, reject) => {
    const uploadPromises = [];

    logger.log(`Uploading static assets to ${bucketName} ...`);

    walkDir(staticAssetsPath)
      .on("data", item => {
        const itemPath = item.path;
        const isFile = !fs.lstatSync(itemPath).isDirectory();
        const posixItemPath = item.path.replace(/\\/g, "/");

        if (isFile) {
          uploadPromises.push(
            providerRequest("S3", "upload", {
              ACL: "public-read",
              Bucket: bucketName,
              Key: path.posix.join(
                "_next",
                posixItemPath.substring(
                  posixItemPath.indexOf("/static"),
                  posixItemPath.length
                )
              ),
              ContentType: mime.getType(itemPath),
              Body: fs.createReadStream(itemPath)
            })
          );
        }
      })
      .on("end", () => {
        Promise.all(uploadPromises)
          .then(results => {
            logger.log("Upload finished");
            resolve(results.length);
          })
          .catch(() => {
            reject(new Error("File upload failed"));
          });
      });
  });
};

module.exports = uploadStaticAssetsToS3;
