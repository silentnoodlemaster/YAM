"use strict";

/**
 * @event
 * Handles errors generated by the application.
 * @param {String} message Error message
 * @param {String} source File where the error occurred
 * @param {number} lineno Line containing the instruction that generated the error
 * @param {number} colno Column containing the statement that generated the error
 * @param {Error} error Application generated error
 */
window.onerror = function (message, source, lineno, colno, error) {
    window.API.log.error(`${message} at line ${lineno}:${colno}.\n${error.stack}`);

    window.API.invoke("require-messagebox", {
        type: "error",
        title: "Unhandled error",
        message: `${message} at line ${lineno}:${colno}.\n
        It is advisable to terminate the application to avoid unpredictable behavior.\n
        ${error.stack}\n
        Please report this error on https://github.com/MillenniumEarl/F95GameUpdater`,
        buttons: [{
            name: "close"
        }]
    });
};

/**
 * @event
 * Handles errors generated within non-catch promises.
 * @param {PromiseRejectionEvent} error 
 */
window.onunhandledrejection = function (error) {
    window.API.log.error(error.reason);

    window.API.invoke("require-messagebox", {
        type: "error",
        title: "Unhandled promise rejection",
        message: `${error.reason}.\n
        It is advisable to terminate the application to avoid unpredictable behavior.\n
        Please report this error on https://github.com/MillenniumEarl/F95GameUpdater`,
        buttons: [{
            name: "close"
        }]
    });
};

//#region Events
document.addEventListener("DOMContentLoaded", onDOMContentLoaded);

document.querySelector("#search-game-name").addEventListener("keyup", onSearchGameName);

document.querySelector("#user-info").addEventListener("login", login);

document.querySelector("#add-remote-game-btn").addEventListener("click", onAddRemoteGame);

document.querySelector("#add-local-game-btn").addEventListener("click", onAddLocalGame);

document.querySelector("#settings-password-toggle").addEventListener("click", onPasswordToggle);

document.querySelector("#settings-save-credentials-btn").addEventListener("click", onSaveCredentialsFromSettings);

document.querySelector("#main-language-select").addEventListener("change", updateLanguage);

document.querySelector("#main-navbar-games").addEventListener("click", openPage);

document.querySelector("#main-navbar-updated-threads").addEventListener("click", openPage);

document.querySelector("#main-navbar-recommendations").addEventListener("click", openPage);

document.querySelector("#main-navbar-settings").addEventListener("click", openPage);

//#region Events listeners

/**
 * Initialize and perform preliminary operations once the DOM is fully loaded.
 */
async function onDOMContentLoaded() {
    // This function runs when the DOM is ready, i.e. when the document has been parsed
    window.API.log.info("DOM loaded, initializing elements");
    await translateElementsInDOM();
    await listAvailableLanguages();

    // Initialize the navigator-tab
    const tabNavigator = document.getElementById("tab-navigator");
    // eslint-disable-next-line no-undef
    M.Tabs.init(tabNavigator, {});

    // Initialize the floating button
    const fabs = document.querySelectorAll(".fixed-action-btn");
    // eslint-disable-next-line no-undef
    M.FloatingActionButton.init(fabs, {
        direction: "left",
        hoverEnabled: false,
    });

    // Initialize the <select> for languages
    const selects = document.querySelectorAll("select");
    // eslint-disable-next-line no-undef
    M.FormSelect.init(selects, {});

    // Set link to logs directory
    const cacheDir = await window.API.invoke("user-data");
    const logsDir = window.API.join(cacheDir, "logs");
    document.getElementById("main-open-log-folder-btn").setAttribute("href", logsDir);

    // Set version value
    const appVersion = await window.API.invoke("app-version");
    const translation = await window.API.translate("MR app version", {
        "version": appVersion
    });
    document.getElementById("main-version").textContent = translation;

    // Login to F95Zone
    await login();

    // Load cards in the paginator
    const paginator = document.querySelector("card-paginator");
    paginator.playListener = gameCardPlay;
    paginator.updateListener = gameCardUpdate;
    paginator.deleteListener = gameCardDelete;
    await paginator.load();
    
    // Load credentials
    await loadCredentials();
}

/**
 * Displays games whose titles contain the value the user entered in the search box.
 * @param {KeyboardEvent} e
 */
function onSearchGameName(e) {
    // Search only if the user press "enter"
    if(e.key !== "Enter") return;

    // Obtain the text
    const searchText = document
        .getElementById("search-game-name")
        .value;

    document.querySelector("card-paginator").search(searchText);
}

/**
 * Adds an undetectable game on the PC via the game URL.
 */
async function onAddRemoteGame() {
    // The user select a single folder
    const gameFolderPaths = await selectGameDirectories(false);
    if (gameFolderPaths.length === 0) return;
    const gamePath = gameFolderPaths[0];

    // Ask the URL of the game
    const url = await window.API.invoke("url-input");
    if (!url) return;

    const translation = await window.API.translate("MR adding game from url");
    sendToastToUser("info", translation);

    // Find game version
    const unparsedName = window.API.getDirName(gamePath);
    const version = getGameVersionFromName(unparsedName);

    // Get game info and check if already installed
    const info = await window.F95.getGameDataFromURL(url);
    const entry = await window.GameDB.search({id: info.id});

    if(entry.lenght !== 0) {
        // This game is already present: ...
        const translation = await window.API.translate("MR game already listed", {
            "gamename": info.name
        });
        sendToastToUser("warning", translation);
        return;
    }

    // Add data to the parsed game info
    const converted = window.GIE.convert(info);
    converted.version = version;
    converted.gameDirectory = gamePath;

    // Save data to database
    await window.GameDB.insert(converted);

    // Game added correctly
    const translationSuccess = await window.API.translate("MR game successfully added", {
        "gamename": converted.name
    });
    sendToastToUser("info", translationSuccess);

    // Reload data in the paginator
    document.querySelector("card-paginator").reload();
}

/**
 * Add one or more games on the PC.
 */
async function onAddLocalGame() {
    // The user select a single folder
    const gameFolderPaths = await selectGameDirectories(true);
    if (gameFolderPaths.length === 0) return;

    // Obtain the data
    const translation = await window.API.translate("MR adding game from path");
    sendToastToUser("info", translation);
    await getGameFromPaths(gameFolderPaths);

    // Reload data in the paginator
    document.querySelector("card-paginator").reload();
}

/**
 * Show or hide the password when the user presses the appropriate button.
 */
function onPasswordToggle() {
    // Show/hide the password
    const input = document.getElementById("settings-password-txt");
    const icon = document.querySelector("#settings-password-toggle > i.material-icons");

    if (input.type === "password") {
        input.type = "text";
        icon.classList.remove("md-visibility");
        icon.classList.add("md-visibility_off");
    }
    else {
        input.type = "password";
        icon.classList.remove("md-visibility_off");
        icon.classList.add("md-visibility");
    }
}

/**
 * Save the credentials when the user changes them in the 'settings' tab.
 */
async function onSaveCredentialsFromSettings() {
    const credPath = await window.API.invoke("credentials-path");
    const username = document.getElementById("settings-username-txt").value;
    const password = document.getElementById("settings-password-txt").value;

    const credentials = {
        username: username,
        password: password,
    };
    const json = JSON.stringify(credentials);
    await window.IO.write(credPath, json);
    const translation = await window.API.translate("MR credentials edited");
    sendToastToUser("info", translation);
}

/**
 * Triggered when the user select a language from the <select> element.
 * Change the language for the elements in the DOM.
 */
async function updateLanguage() {
    // Parse user choice
    const e = document.getElementById("main-language-select");
    const selectedISO = e.options[e.selectedIndex].value;

    // Change language via IPC
    await window.API.changeLanguage(selectedISO);

    // Refresh strings
    await translateElementsInDOM();
}

/**
 * Select the tab with the specified ID in DOM.
 * @param {MouseEvent} e
 */
function openPage(e) {
    // Get the ID of the div to show
    let id = "main-games-tab";
    if (e.target.id === "main-navbar-games") id = "main-games-tab";
    else if (e.target.id === "main-navbar-updated-threads") id = "main-updated-threads-tab";
    else if (e.target.id === "main-navbar-recommendations") id = "main-recommendations-tab";
    else if (e.target.id === "main-navbar-settings") id = "main-settings-tab";

    // Hide all elements with class="tabcontent" by default
    const tabcontent = document.getElementsByClassName("tabcontent");

    // Use requestAnimationFrame to reduce rendering time
    // see: https://stackoverflow.com/questions/37494330/display-none-in-a-for-loop-and-its-affect-on-reflow
    window.requestAnimationFrame(function () {
        // Hide the unused tabs
        for (let i = 0; i < tabcontent.length; i++) {
            tabcontent[i].style.display = "none";
        }

        // Show the specific tab content
        document.getElementById(id).style.display = "block";

        // Hide/show the add game button
        const fab = document.querySelector("#fab-add-game-btn");
        if (id === "main-games-tab" && window.F95.logged) fab.style.display = "block";
        else fab.style.display = "none";
    });
}
//#endregion

//#endregion Events

//#region Private methods

//#region Language
/**
 * @private
 * Translate the DOM elements in the current language.
 */
async function translateElementsInDOM() {
    // Get only the localizable elements
    const elements = document.querySelectorAll(".localizable");

    // Translate elements
    for (const e of elements) {
        // Select the element to translate
        const toTranslate = e.childNodes.length === 0 ? 
            // Change text if no child elements are presents...
            e: 
            // ... or change only the last child (the text)
            e.childNodes[e.childNodes.length - 1]; 

        // Translate
        toTranslate.textContent = await window.API.translate(e.id);
    }
}

/**
 * @private
 * Select all the available languages for the app and create a <select>.
 */
async function listAvailableLanguages() {
    // Read all the available languages
    const cwd = await window.API.invoke("cwd");
    const langs = await window.IO.filter(
        "*.json",
        window.API.join(cwd, "resources", "lang")
    );
    const currentLanguageISO = (await window.API.currentLanguage()).toUpperCase();

    for (const lang of langs) {
        const iso = lang.replace(".json", "");

        // Create <option> for the combobox
        const option = document.createElement("option");
        option.setAttribute("class", "left"); // Icons on the left
        option.setAttribute("value", iso);
        const flagPath = window.API.join(
            cwd,
            "resources",
            "images",
            "flags",
            `${iso}.webp`
        );
        option.setAttribute("data-icon", flagPath);
        option.textContent = iso.toUpperCase();

        // If current language make the option selected
        if (currentLanguageISO === iso.toUpperCase())
            option.setAttribute("selected", "");

        // Add the option
        document.getElementById("main-language-select").appendChild(option);
    }
}
//#endregion Language

//#region Utility
/**
 * @private
 * Remove all the special characters from a string.
 * It remove all the characters (spaced excluded) that have the same "value" in upper and lower case.
 * @param {String} str String to parse
 * @param {String[]} allowedChars List of allowed special chars
 * @returns {String} Parsed string
 */
function removeSpecials(str, allowedChars) {
    const lower = str.toLowerCase();
    const upper = str.toUpperCase();

    if (!allowedChars) allowedChars = [];

    let res = "";
    for (let i = 0; i < lower.length; ++i) {
        if (lower[i] !== upper[i] || lower[i].trim() === "" || allowedChars.includes(lower[i]))
            res += str[i];
    }
    return res.trim();
}

/**
 * @private
 * Given a game name, remove all the special characters and various tag (*[tag]*).
 * @param {String} name
 * @returns {String}
 */
function cleanGameName(name) {
    // Remove special chars except for version and specific tag chars
    name = removeSpecials(name, [
        "-",
        "[",
        "]",
        ".",
        "0",
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
    ]);

    // Remove mod tag and version
    const rxTags = /\[(.*?)\]/g;
    const rxSpecials = /[/\\?%*:|"<>]/g;
    name = name.replace(rxTags, "").replace(rxSpecials, "").trim();

    return name;
}

/**
 * @private
 * Show a toast in the top-right of the screen.
 * @param {String} type Type of message (*error/warning/...*)
 * @param {String} message Message to the user
 */
function sendToastToUser(type, message) {
    // Select various data based on the type of message
    let icon = "info";
    let htmlColor = "blue";
    let timer = 3000;
    if (type === "error") {
        icon = "error_outline";
        htmlColor = "red";
        timer = 15000;
    } else if (type === "warning") {
        icon = "warning";
        htmlColor = "orange";
        timer = 10000;
    }

    const htmlToast = `<i class='material-icons md-${icon}' style='padding-right: 10px'></i><span>${message}</span>`;
    // eslint-disable-next-line no-undef
    M.toast({
        html: htmlToast,
        displayLength: timer,
        classes: htmlColor,
    });
}

/**
 * @private
 * Get the `n` elements most frequents in `arr`.
 * @param {Array} arr 
 * @param {Number} n 
 */
function mostFrequent(arr, n) {
    // Create an dict where the value is the number
    // of times the key is in the array (arr)
    const countDict = {};
    for(const e of arr) {
        if (e in countDict) countDict[e] += 1;
        else countDict[e] = 1;
    }

    // Create items array
    const items = Object.keys(countDict).map(function (key) {
        return [key, countDict[key]];
    });

    // Sort the array based on the second element
    items.sort(function (first, second) {
        return second[1] - first[1];
    });

    // Return the first n elements
    const min = Math.min(n, items.length);
    const returnElements = items.slice(0, min);
    return returnElements.map(e => e[0]);
}
//#endregion Utility

//#region Authentication
/**
 * @private
 * Load credentials in the settings input fields.
 */
async function loadCredentials() {
    // Check path
    const credPath = await window.API.invoke("credentials-path");
    const exists = await window.IO.pathExists(credPath);
    if (!exists) return;

    // Parse credentials
    const json = await window.IO.read(credPath);
    const credentials = JSON.parse(json);

    // Set values
    document.getElementById("settings-username-txt").value = credentials.username;
    document.getElementById("settings-password-txt").value = credentials.password;

    // "Select" the textboxes to not overlap textual values and placeholder text
    document
        .querySelector("label[for='settings-username-txt']")
        .classList.add("active");
    document
        .querySelector("label[for='settings-password-txt']")
        .classList.add("active");
}

/**
 * @private
 * It checks if a network connection is available
 * and notifies the main process to perform
 * the login procedure.
 */
async function login() {
    // Show the spinner in the avatar component
    document.getElementById("user-info").showSpinner();

    // Check network connection
    const online = await window.API.isOnline();
    if (!online) {
        window.API.log.warn("No network connection, cannot login");
        const translation = await window.API.translate("MR no network connection");
        sendToastToUser("warning", translation);

        // Hide spinner
        document.getElementById("user-info").hideSpinner();
        return;
    }

    // Request user input
    window.API.log.info("Send API to main process for auth request");
    const result = await window.API.invoke("login-required");

    window.API.log.info(`Authentication result: ${result}`);
    if (result !== "AUTHENTICATED") {
        // Hide "new game" button
        document.querySelector("#fab-add-game-btn").style.display = "none";

        // Hide spinner
        document.getElementById("user-info").hideSpinner();
        return;
    }

    // Load data (session not shared between windows)
    try {
        // Check path
        const credPath = await window.API.invoke("credentials-path");
        if (!window.IO.pathExists(credPath)) return;

        // Parse credentials
        const json = await window.IO.read(credPath);
        const credentials = JSON.parse(json);

        const res = await window.F95.login(credentials.username, credentials.password);
        if (!res.success) return;

        const translation = await window.API.translate("MR login successful");
        sendToastToUser("info", translation);

        // Show "new game" button
        document.querySelector("#fab-add-game-btn").style.display = "block";

        // Load user data
        getUserDataFromF95();
    } catch (e) {
        // Send error message
        const translation = await window.API.translate("MR cannot login", {
            "error": e
        });
        sendToastToUser("error", translation);
        window.API.log.error(`Cannot login: ${e}`);
    }
}
//#endregion Authentication

//#region Adding game
/**
 * @private
 * Let the user select one (or more) directory containing games.
 * @param {Boolean} multipleSelection If the user can select more than one directory
 * @returns {Promise<String[]>} List of directories
 */
async function selectGameDirectories(multipleSelection) {
    // Local variables
    const props = multipleSelection ? ["openDirectory", "multiSelections"] : ["openDirectory"];

    // The user selects one (or more) folders
    const openDialogOptions = {
        title: await window.API.translate("MR select game directory"),
        properties: props,
    };
    const data = await window.API.invoke("open-dialog", openDialogOptions);

    // No folder selected
    if (data.filePaths.length === 0) {
        const translation = await window.API.translate("MR no directory selected");
        sendToastToUser("warning", translation);
        return [];
    }

    // Check if the game(s) is already present
    const gameFolderPaths = await getUnlistedGamesInArrayOfPath(data.filePaths);
    if (gameFolderPaths.length === 0) return [];
    else return gameFolderPaths;
}

/**
 * @event
 * Start the game when the user presses the button.
 * @param {CustomEvent} e Contains the path to the game executable with the name `launcher`
 */
async function gameCardPlay(e) {
    if (!e.target) return;
    const launcherPath = e.detail.launcher;

    // Check if the path exists
    const exists = await window.IO.pathExists(launcherPath);
    if (!exists) {
        const translation = await window.API.translate("MR cannot find game path");
        window.API.log.error(`Cannot find game path: ${launcherPath}`);
        sendToastToUser("error", translation);
        return;
    }

    // Launch the game
    window.API.send("exec", launcherPath);
}

/**
 * @event
 * Start the game update process when the user presses the button.
 * @param {CustomEvent} e Contains the following information: 
 * `name`, `version`, `changelog`, `url`, `gameDirectory`
 */
async function gameCardUpdate(e) {
    if (!e.target) return;

    // Let the user update the game
    const finalized = await window.API.invoke("update-messagebox", {
        title: e.detail.name,
        version: e.detail.version,
        changelog: e.detail.changelog,
        url: e.detail.url,
        folder: e.detail.gameDirectory
    });

    // The user didn't complete the procedure
    if (!finalized) return;

    // Finalize the update
    const result = await e.target.update();
    if (result) return;

    const translationError = await window.API.translate("MR error finalizing update");
    sendToastToUser("error", translationError);
    window.API.log.error(
        "Cannot finalize the update, please check if another directory of the game exists"
    );
}

/**
 * @event
 * Start the procedure for deleting the game, 
 * allowing you to copy the game saves if possible.
 * @param {CustomEvent} e Contains the following information: 
 * `name`, `savePaths`
 */
async function gameCardDelete(e) {
    if (!e.target) return;
    
    // Prepare the options for the confirmation dialog
    const dialogOptions = {
        type: "warning",
        title: await window.API.translate("MR confirm deletion"),
        message: await window.API.translate("MR message confirm deletion"),
        buttons: [
            {name: "remove-only"},
            {name: "delete"},
            {name: "cancel"},
        ],
    };

    // Check for savegames
    const savesExists = e.detail.savePaths.length !== 0 ? true : false;
    if (savesExists) {
        // Add option for save savegames
        dialogOptions.checkboxes = [
            {name: "preserve-savegame"},
        ];
    }

    // Propt user
    const data = await window.API.invoke("require-messagebox", dialogOptions);
    if (!data) return;

    // Cancel button
    if (data.button === "cancel") return;

    // Copy saves
    const copySaves = savesExists ? data.checkboxes.includes("preserve-savegame") : false;
    if (copySaves && e.detail.savePaths && e.detail.name) {
        // Create the directory
        const exportedSavesDir = await window.API.invoke("savegames-data-dir");
        const gameDirectory = window.API.join(exportedSavesDir, cleanGameName(e.detail.name));
        await window.IO.mkdir(gameDirectory);

        // Copy the saves
        for (const path of e.detail.savePaths) {
            const name = window.API.getDirName(path);
            const newName = window.API.join(gameDirectory, name);
            await window.IO.copy(path, newName);
        }
    }

    // Delete also game files
    if (data.button === "delete") {
        const gameDirectory = e.detail.gameDirectory;
        await window.IO.deleteFolder(gameDirectory);
    }

    // Remove the game data
    await e.target.deleteData();

    // Reload data in the paginator
    document.querySelector("card-paginator").reload();

    // Notificate the user
    const translation = await window.API.translate("MR game removed", {gamename: e.detail.name}); 
    sendToastToUser("info", translation);
}

/**
 * @private
 * Given a directory listing, it gets information about the games contained in them.
 * @param {String[]} paths Path of the directories containg games
 */
async function getGameFromPaths(paths) {
    // Parse the game dir name(s)
    for (const path of paths) {
        try {
            await getGameFromPath(path);
        }
        catch (error) {
            // Send error message
            window.API.invoke("require-messagebox", {
                type: "error",
                title: "Unexpected error",
                message: `Cannot retrieve game data (${path}), unexpected error: ${error}`,
                buttons: [{
                    name: "close"
                }]
            });
            window.API.log.error(
                `Unexpected error while retrieving game data from path: ${path}. ${error}`
            );
        }
    }
}

/**
 * @private
 * Given a directory path, parse the dirname, get the
 * game (if exists) info and add a *game-card* in the DOM.
 * @param {String} path Game directory path
 */
async function getGameFromPath(path) {
    // Get the directory name
    const unparsedName = window.API.getDirName(path);
    
    // Check if it is a mod
    const MOD_TAG = "[MOD]";
    const includeMods = unparsedName.toUpperCase().includes(MOD_TAG);

    // Get only the game title
    const name = cleanGameName(unparsedName);

    // Search and add the game
    const gamelist = await window.F95.getGameData(name, includeMods);

    // No game found, return
    if (gamelist.length === 0) {
        const key = "MR no game found";
        const translation = await window.API.translate(key, {
            "gamename": name
        });
        sendToastToUser("warning", translation);
        window.API.log.warn(`No results found for ${name}`);
        return;
    } 

    // Multiple games found, let the user decide
    let selectedGame = gamelist[0]; // By default is the only game in list
    if (gamelist.length > 1) {
        selectedGame = await requireUserToSelectGameWithSameName(unparsedName, gamelist);
        if(!selectedGame) return;
    }
    
    // Add data to the parsed game info
    const converted = window.GIE.convert(selectedGame);
    converted.version = getGameVersionFromName(unparsedName);
    converted.gameDirectory = path;

    // Save data to database
    await window.GameDB.insert(converted);

    // Game added correctly
    const translation = await window.API.translate("MR game successfully added", {
        "gamename": name
    });
    sendToastToUser("info", translation);
}

/**
 * @private
 * Given a non-parsed game name, extract the version if a tag **[v.version]** is specified.
 * @example [v.1.2.3.4], [V.somevalue]
 * @param {String} name
 */
function getGameVersionFromName(name) {
    // Local variables
    let version = "Unknown";
    const PREFIX_VERSION = "[V."; // i.e. namegame [v.1.2.3.4]

    // Search the version tag, if any
    if (name.toUpperCase().includes(PREFIX_VERSION)) {
        const startIndex = name.toUpperCase().indexOf(PREFIX_VERSION) + PREFIX_VERSION.length;
        const endIndex = name.indexOf("]", startIndex);
        version = name.substr(startIndex, endIndex - startIndex);
    }

    return version;
}

/**
 * @private
 * Check that the specified paths do not belong to games already in the application.
 * @param {String[]} paths List of game paths to check
 * @returns {Promise<String[]>} List of valid paths
 */
async function getUnlistedGamesInArrayOfPath(paths) {
    // Local variables
    const MAX_NUMBER_OF_PRESENT_GAMES_FOR_MESSAGES = 5;
    const gameFolderPaths = [];
    const alreadyPresentGames = [];

    // Check if the game(s) is (are) already present
    const games = await window.GameDB.search({});
    const listedGameNames = games.map(function(game) {
        const gamename = cleanGameName(game.name).replace(/[/\\?%*:|"<>]/g, " ").trim(); // Remove invalid chars
        return gamename.toUpperCase();
    });

    for (const path of paths) {
        // Get the clean game name
        const unparsedName = window.API.getDirName(path);
        const newGameName = cleanGameName(unparsedName).replace(/[/\\?%*:|"<>]/g, " ").trim(); // Remove invalid chars

        // Check if it's not already present and add it to the list
        if (!listedGameNames.includes(newGameName.toUpperCase())) gameFolderPaths.push(path);
        else alreadyPresentGames.push(newGameName);
    }

    if (alreadyPresentGames.length <= MAX_NUMBER_OF_PRESENT_GAMES_FOR_MESSAGES) {
        // List the game names only if there are few duplicated games
        for (const gamename of alreadyPresentGames) {
            // This game is already present: ...
            const translation = await window.API.translate("MR game already listed", {
                "gamename": gamename
            });
            sendToastToUser("warning", translation);
        }
    } else {
        const translation = await window.API.translate("MR multiple duplicate games", {
            "number": alreadyPresentGames.length
        });
        sendToastToUser("warning", translation);
    }

    return gameFolderPaths;
}

/**
 * @private
 * Let the user select their favorite game in case of multiple search results.
 * @param {String} desiredGameName Name of the game searched
 * @param {GameInfo[]} listOfGames List of games to choose from
 * @returns {Promise<GameInfo|null>} Game selected or `null` if the user has not selected anything
 */
async function requireUserToSelectGameWithSameName(desiredGameName, listOfGames) {
    // Local variables
    let buttonsList = [];
    let entryList = "";

    // Prepares the list of games to show to the user and buttons to show on the messagebox
    for(let i = 0; i < listOfGames.length; i++) {
        const game = listOfGames[i];
        entryList = entryList.concat(`${i + 1} - ${game.name} [${game.author}] [${game.version}]\n`);

        const button = {
            name: game.id,
            text: await window.API.translate("MR select game option", {
                "number": i + 1
            }),
            classes: ["neutral-button"]
        };
        buttonsList.push(button);
    }
    buttonsList.push({name: "close"}); // Add the default close button

    // Let the user select the preferred game
    const result = await window.API.invoke("require-messagebox", {
        type: "warning",
        title: await window.API.translate("MR same name games title"),
        message: await window.API.translate("MR same name games message", {
            "desiredGame": desiredGameName,
            "gamelist": entryList
        }),
        buttons: buttonsList
    });

    // Return the game selected or null if no game is selected
    if (result.button === "close") return null;
    else return listOfGames.find(x => x.id === parseInt(result.button));
}
//#endregion Adding game

//#region User Data
/**
 * @private
 * Obtain data of the logged user and show them in the custom element "user-info".
 */
async function getUserDataFromF95() {
    window.API.log.info("Retrieving user info from F95");

    // Retrieve user data
    const userdata = await window.F95.getUserData();

    // Check user data
    if (!userdata) {
        // Hide spinner
        document.getElementById("user-info").hideSpinner();

        // Send error message
        const translation = await window.API.translate("MR cannot retrieve user data");
        sendToastToUser("error", translation);
        window.API.log.error("Something wrong while retrieving user info from F95");
    }

    // Update component
    document.getElementById("user-info").userdata = userdata;
    
    // Update threads
    updatedThreads(userdata.watchedGameThreads);

    // Fetch recommended games
    const recommendContent = document.getElementById("main-recommendations-content");
    const games = await recommendGames();

    // Add cards
    games.map(function (game) {
        const card = document.createElement("recommended-card");
        card.info = game;
        recommendContent.appendChild(card);
    });
}
//#endregion User Data

//#region Watched Threads
/**
 * @private
 * Process and show games not installed but in user watchlist that have undergone updates.
 * @param {String[]} watchedThreads List of URLs of watched game threads
 */
async function updatedThreads(watchedThreads) {
    // Store the new threads and obtains info on the updates
    await syncDatabaseWatchedThreads(watchedThreads);

    // Obtains the updated threads to display to the user
    const updatedThreads = await getUpdatedThreads();

    // Prepare the threads tab
    window.requestAnimationFrame(() => prepareThreadUpdatesTab(updatedThreads));
}

/**
 * @private
 * Save the watched threads in the database and edit the updated threads.
 * @param {String[]} urlList List of URLs of watched game threads
 */
async function syncDatabaseWatchedThreads(urlList) {
    for (const url of urlList) {
        // Extract the ID from the thread
        const match = url.match(/\.[0-9]+/);
        if (!match) {
            window.API.log.warn(`Cannot find ID for ${url}`);
            continue;
        }
        const id = parseInt(match[0].replace(".", ""));

        // Check if the thread exists in the database
        const thread = await window.ThreadDB.search({
            id: id
        });

        if (thread.length === 0) {
            // The thread doesn't exists, insert
            const gameInfo = await window.F95.getGameDataFromURL(url);
            const threadInfo = window.TI.convert(gameInfo);
            await window.ThreadDB.insert(threadInfo);
        } else {
            // The game exists, check for updates
            if (thread[0].url === url) continue; // No update...

            // Update available
            const gameInfo = await window.F95.getGameDataFromURL(url);
            const threadInfo = window.TI.convert(gameInfo);
            threadInfo.updateAvailable = true;
            threadInfo.markedAsRead = false;
            await window.ThreadDB.write(threadInfo);
        }
    }
}

/**
 * @private
 * Obtains the updated and not read threads.
 * @return {Promise<ThreadInfo[]>} List of available threads
 */
async function getUpdatedThreads() {
    // Obtains the thread
    const threads = await window.ThreadDB.search({
        updateAvailable: true,
        markedAsRead: false
    }, {
        name: 1 // Order by name
    });

    // Excludes threads of installed games
    const result = [];
    for (const thread of threads) {
        const searchResult = await window.GameDB.search({
            id: thread.id
        });
        if (searchResult.length === 0) result.push(thread);
    }

    return result;
}

/**
 * @private
 * Show the available threads in the DOM
 * @param {ThreadInfo[]} threads List of threads to show
 */
async function prepareThreadUpdatesTab(threads) {
    // Local variables
    const visualizerTab = document.getElementById("main-updated-threads-tab");

    for (const thread of threads) {
        const threadVisualizer = document.createElement("thread-visualizer");
        threadVisualizer.info = thread;

        visualizerTab.appendChild(threadVisualizer);
    }
}
//#endregion Watched Threads

//#region Recommendations System
/**
 * @private
 * Gets the most frequent `n` tags among installed games.
 * @param {Number} n 
 * @returns {Promise<String[]>}
 */
async function getMostFrequentsInstalledTags(n) {
    // Local variables
    let tags = [];
    const games = await window.GameDB.search({});

    // Add game tags to local list
    for (const game of games) tags = tags.concat(game.tags);

    return mostFrequent(tags, n);
}

/**
 * @private
 * Gets the most frequent `n` tags among watched games.
 * @param {Number} n 
 * @returns {Promise<String[]>}
 */
async function getMostFrequentsThreadTags(n) {
    // Local variables
    let tags = [];
    const threads = await window.ThreadDB.search({});
    
    // Add game tags to local list
    for (const thread of threads) tags = tags.concat(thread.tags);

    return mostFrequent(tags, n);
}

/**
 * @private
 * It works out the games recommended for the user based on the games he follows and owns.
 * @returns {Promise<GameInfoExtended[]>}
 */
async function recommendGames() {
    // Local variables
    const MAX_TAGS = 5; // Because F95Zone allow for a max. of 5 tags
    const MAX_GAMES = 10; // A single page of games
    const MAX_FETCHED_GAMES = 15; // > MAX_GAMES
    const validGames = [];

    // Get most frequents tags
    const gameTags = await getMostFrequentsInstalledTags(MAX_TAGS);
    const threadTags = await getMostFrequentsThreadTags(MAX_TAGS);
    const unified = gameTags.concat(threadTags);
    const tags = mostFrequent(unified, MAX_TAGS);

    // Get the names of the installed games
    const installedGames = await window.GameDB.search({});
    const installedGameIDs = installedGames.map(g => g.id);

    do {
        // Get the games that match with tags
        const games = await window.F95.getLatestUpdates({
            tags: tags,
            sorting: "rating"
        }, MAX_FETCHED_GAMES);

        for (const game of games) {
            if (!installedGameIDs.includes(game.id) && 
                !validGames.find(g => g.id === game.id) &&
                validGames.length < MAX_GAMES)
                validGames.push(game);
            else continue;
        }

        // Remove the last tag
        // This is necessary for the possible next do-while loop
        // that happens when there aren't enough recommendet games
        tags.pop();
    }
    while(validGames.length < MAX_GAMES && tags.length > 0);

    // Convert and return the games
    return validGames.map(g => window.GIE.convert(g));
}
//#endregion Recommendations System

//#endregion Private methods
