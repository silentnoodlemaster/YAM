// Require all the public npm 
// modules to add to the snapshot
// Do not include core modules
// i.e. path or fs

require("electron-updater");
require("electron-store");
// require("f95api"); Error with variables with # in the name (private)
require("simple-image-downloader");
require("imagemin");
require("imagemin-webp");
require("imagemin-gifsicle");