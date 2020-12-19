/* Based on: https://github.com/inkdropapp/electron-v8snapshots-example/blob/master/tools/create-v8-snapshots.js
 */

"use strict";

// Core modules
const path = require("path");
const fs = require("fs");
const childProcess = require("child_process");
const promisify = require("util").promisify;

// Public modules from npm
const vm = require("vm");
const electronLink = require("electron-link");

// Modules from file
const {deleteFolderRecursive} = require("../app/src/scripts/io-operations.js");

// Promisified functions
const awritefile = promisify(fs.writeFile);
const aexefile = promisify(childProcess.execFile);

// Name of the modules to exclude from the snapshot (usually all the modules that give a warning)
const excludedModules = new Set(["graceful-fs", "signal-exit", "ignore", "atomically", "fast-glob", "@nodelib", "glob", "globby", "execa", "cwebp-bin", "fs-extra", "gifsicle", "temp-dir", "supports-color", "debug"]);
const coreModules = new Set(["electron", "atom", "shell", "WNdb", "lapack", "remote"]);

// Global variables
const verbose = false;
const baseDirPath = path.resolve(__dirname, "..");

//#region Utils functions
/**
 * @private
 * Get the name of the module with the given path.
 * @param {String} modulePath Path to the module
 */
function extractNodeModuleName(modulePath) {
    const segments = modulePath.split(path.sep);
    const index = segments.lastIndexOf("node_modules");
    return index === -1 ? null : segments[index + 1];
}

/**
 * @private
 * Return `true` if the module is to exclude from the snapshot.
 * @param {Object} args 
 * @param {String} args.requiredModulePath Path of the required module
 * @param {String} args.requiringModulePath Well, missing documentation on original project
 */
function verifyModuleExclusion(args) {
    // Local variables
    let returnValue = true; // By default exclude the module

    // First check if the module script exists
    const scriptExists = fs.existsSync(args.requiredModulePath);
    if (scriptExists) {
        // Parse the module name from the arguments
        const modulePath = args.requiredModulePath;
        const moduleName = extractNodeModuleName(modulePath);

        const exclude = coreModules.has(moduleName) || excludedModules.has(moduleName);
        returnValue = exclude;
        if (verbose) console.log(`Processing: ${moduleName}/${path.basename(modulePath)}. Excluded: ${exclude}`);
    }
    return returnValue;
}

/**
 * @private
 * Create the linked script for the required modules in `snapshot.js`.
 * @returns {Promise<String>} The resulting snapshot script
 */
async function createLinkedScript() {
    const result = await electronLink({
        baseDirPath: baseDirPath,
        mainPath: path.join(baseDirPath, "tools", "snapshot.js"),
        cachePath: path.join(baseDirPath, "cache"),
        shouldExcludeModule: args => verifyModuleExclusion(args)
    });
    
    return result.snapshotScript;
}

/**
 * @private
 * Save the script to disk.
 * @param {String} path Save path
 * @param {String} script Script content
 */
async function saveSnapshotScript(path, script) {
    await awritefile(path, script);
}

/**
 * @private
 * Test the snapshot script in an empty V8 environment.
 * @param {String} script Script content
 * @param {String} path Path to the script on disk
 */
function testSnapshotScript(script, path) {
    try {
        vm.runInNewContext(script, undefined, {
            filename: path,
            displayErrors: true
        });
        return true;
    }
    catch (e) {
        console.error(`Script validation failed with: ${e}`);
        return false;
    }
}

/**
 * @privateCreate the V8 snapshot.
 * @param {String} src Path to the linked script
 * @param {String} dest Destination of the snapshot
 */
async function createV8Snapshot(src, dest) {
    // Local variables
    const command = path.resolve(
        __dirname,
        "..",
        "node_modules",
        ".bin",
        "mksnapshot" + (process.platform === "win32" ? ".cmd" : "")
    );
    const parameters = [src, "--output_dir", dest];

    await aexefile(command, parameters);
}
//#endregion Utils functions

async function main() {
    // Local variables
    const cacheDir = path.join(baseDirPath, "cache");
    const snapshotScriptPath = path.join(cacheDir, "snapshot.js");

    // Check if the cache is already present and delete it
    if (fs.existsSync(cacheDir)) {
        console.log("Cache already present, deleting...");
        await deleteFolderRecursive(cacheDir);
    }

    console.log("Creating a linked script...");
    const snapshotScript = await createLinkedScript();

    console.log("Saving script to disk...");
    await saveSnapshotScript(snapshotScriptPath, snapshotScript);

    // Verify if we will be able to use this in `mksnapshot`
    console.log("Verifying snapshot...");
    if(testSnapshotScript(snapshotScript, snapshotScriptPath)) {
        console.log(`Generating startup blob in "${cacheDir}"`);
        await createV8Snapshot(snapshotScriptPath, cacheDir);
    }
}

main().catch(err => console.error(err));
