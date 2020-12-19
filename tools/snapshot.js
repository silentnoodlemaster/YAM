// Require all the public npm 
// modules to add to the snapshot
// Do not include core modules
// i.e. path or fs

require("electron-updater");
require("electron-store");
// require("electron-is-dev"); Gives warning
// require("f95api"); Error with variables with # in the name (private)
require("simple-image-downloader");
require("imagemin");
require("imagemin-webp");
require("imagemin-gifsicle");
require("i18next");
require("i18next-electron-language-detector");
require("string-similarity");
require("new-github-issue-url");
// require("nedb-promises"); Gives warning
require("ajv");