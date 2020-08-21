const fs = require("fs");

// delete old picture files when the product is deleted
// or when a picture of a product is changed
const deleteFile = (filePath) => {
  // checks if file exists at the path
  fs.stat("foo.txt", function (err, stat) {
    // if file exists,
    if (err == null) {
      // deletes the file at the path passed in
      fs.unlink(filePath, (err) => {
        if (err) {
          throw err;
        }
      });
    }
    // file does not exist, just return
    else if (err.code === "ENOENT") {
      return;
    }
    // some other error occured
    else {
      throw err;
    }
  });
};

exports.deleteFile = deleteFile;
