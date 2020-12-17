"use strict";

// Core modules
import { join } from "path";

// Public modules from npm
import { app } from "electron";

/**
 * Class containing variables shared between modules.
 */
class Shared {
    //#region Private static properties
    /**
     * Base directory where to save the application cache.
     * @type String
     */
    static _cacheDir: string = join(app.getPath("userData"), "appcache");
    /**
     * Name of the directory containing the preview of the games.
     * @type String
     */
    static _previewDirName: string = "preview";
    /**
     * Name of the directory containing the exported game saves.
     * @type String
     */
    static _exportedGameSavesDirName: string = "gamesaves";
    /**
     * Name of the file to save the credentials for accessing the F95Zone portal.
     * @type String
     */
    static _credentialsName: string = "credentials.json";
    /**
     * Name of the database containing the data of the games.
     * @type String
     */
    static _gameDbName: string = "games.db";
    /**
     * Name of the database containing the data of the threads.
     * @type String
     */
    static _threadDbName: string = "threads.db";
    /**
     * Name of the database containing the data of the game updates.
     * @type String
     */
    static _updateDbName: string = "updates.db";
    //#endregion Private static properties

    //#region Getters
    /**
     * Base directory where to save the application cache.
     * @returns {String}
     */
    static get cacheDir(): string {
        return this._cacheDir;
    }
    /**
     * Path to directory containing the preview of the games.
     * @returns {String}
     */
    static get previewDir(): string {
        return join(this._cacheDir, this._previewDirName);
    }
    /**
     * Path to directory containing the exported game saves.
     * @returns {String}
     */
    static get exportedGameSavesDirName(): string {
        return join(this._cacheDir, this._exportedGameSavesDirName);
    }
    /**
     * Path to file containing the credentials for accessing the F95Zone portal.
     * @returns {String}
     */
    static get credentialsPath(): string {
        return join(this._cacheDir, this._credentialsName);
    }

    /**
     * Path to database containing the data of the games.
     * @returns {String}
     */
    static get gameDbPath(): string {
        return join(this._cacheDir, this._gameDbName);
    }

    /**
     * Path to database containing the data of the threads.
     * @returns {String}
     */
    static get threadDbPath(): string {
        return join(this._cacheDir, this._threadDbName);
    }

    /**
     * Path to database containing the data of the game updates.
     * @returns {String}
     */
    static get updateDbPath(): string {
        return join(this._cacheDir, this._updateDbName);
    }
    //#endregion Getters

    //#region Setters
    static set cacheDir(val) {
        this._cacheDir = val;
    }
    //#endregion Setters
}

module.exports = Shared;
