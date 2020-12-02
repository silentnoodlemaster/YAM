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

//#region Private methods
/**
 * Send an IPC message to the main process by returning 
 * the button pressed by the user and the selected checkboxes.
 * @param {MouseEvent} e 
 */
function onButtonClick(e) {
    // Get all the selected checkboxes
    const css = "input[type='checkbox'][checked='checked']";
    const checkboxes = document.querySelectorAll(css);
    const selected = Array.from(checkboxes).map(c => c.id);

    // Return value
    const dict = {
        button: e.target.id,
        checkboxes: selected
    };
    window.API.send("window-close", dict);
}

/**
 * Set a icon for the type of messagebox.
 * @param {String} type `error`/`warning`/`info`
 */
async function setIcon(type) {
    // Local variables
    const cwd = await window.API.cwd();
    const imagesPath = window.API.join(cwd, "resources", "images");
    const iconElement = document.getElementById("icon");

    switch (type) {
    case "info":
        iconElement.setAttribute("src", window.API.join(imagesPath, "info.webp"));
        break;
    case "warning":
        iconElement.setAttribute("src", window.API.join(imagesPath, "warning.webp"));
        break;
    case "error":
        iconElement.setAttribute("src", window.API.join(imagesPath, "error.webp"));
        break;
    default:
        throw new Error(`${type} is a invalid type icon`);
    }
}

/**
 * Resize the window to fit the content of the body.
 */
function fitContent() {
    // Get the elements in the page
    const container = document.querySelector(".container");
    const header = container.querySelector(".header");
    const roundedContainer = container.querySelector(".rounded-container");
    const checkboxesContainer = container.querySelector(".checkboxes-container");
    const buttonsContainer = container.querySelector(".buttons-container");

    // Get the size of the computed elements in the page
    const [hW, hH] = [header.scrollWidth, header.scrollHeight];
    const [rcW, rcH] = [roundedContainer.scrollWidth, roundedContainer.scrollHeight];

    let ccW = 0, ccH = 0;
    for(const checkbox of checkboxesContainer.querySelectorAll("label")) {
        // The checkboxes are arranged on a single column
        if (checkbox.scrollWidth > ccW) ccW = checkbox.scrollWidth;
        ccH += checkbox.scrollHeight;
    }

    const MAX_WIDTH = 700; // Defined in app/src/scripts/window-creator.js
    let bcW = 0, bcH = 0, rowWidth = 0;
    for (const button of buttonsContainer.querySelectorAll("a.btn")) {
        rowWidth += button.scrollWidth;

        // Set the height for at least one row of buttons
        if (bcH === 0) bcH = button.scrollHeight;

        if(rowWidth > MAX_WIDTH) {
            // Set the container width
            if(rowWidth > bcW) bcW = rowWidth;
            
            // All the buttons have the same height (36px)
            bcH += button.scrollHeight;

            // Reset the single oine width
            rowWidth = 0;
        }
    }

    // Calculate the final sizes
    const PADDING = 10;
    const partialWidth = Math.max(hW, rcW, ccW, bcW);
    const height = hH + rcH + ccH + bcH + 4 * PADDING; // 3*"PADDING_TOP" + 1*"PADDING_BOTTOM"

    // The container (with class "container") has a width of 90%
    // So the real width => partialWidth : 90% = realWidth : 100%
    const realWidth = Math.ceil((partialWidth * 10) / 9);

    window.API.send("window-resize", realWidth, height);
}

/**
 * Create a list of buttons to add to the DOM.
 * @param {Object[]} options Options for a button
 * @param {String} options.name 
 * Name of the button, it will be returned when the user click on it. 
 * If it's a default name the others properties will be automatically set.
 * Default names are: `close`, `remove-only`, `delete`, `cancel`.
 * @param {String} [options.text] 
 * The text to show on the button.  
 * Overwrite the `default` options if specified.
 * @param {String} [options.color] 
 * Hexadecimal color of the text for the button.
 * Overwrite the `default` options if specified.
 * @param {String} [options.background] 
 * Hexadecimal color of the background of the button.
 * Overwrite the `default` options if specified.
 * @param {String} [options.icon] 
 * Name of the icon to be shown on the left of the 
 * button chosen from the material design icons.
 * Overwrite the `default` options if specified.
 * @param {String[]} [options.classes] 
 * List of CSS classes to add to the button.
 * Overwrite the `default` options if specified.
 * @returns List of buttons to add to the page
 */
async function createButtons(options) {
    // Local variables
    const defaultButtons = ["close", "remove-only", "delete", "cancel"];
    const buttons = [];

    // Load the file containing the data for the default buttons
    const cwd = await window.API.cwd();
    const path = window.API.join(cwd, "resources", "default-buttons.json");
    const data = await window.IO.read(path);
    const defaults = JSON.parse(data);

    for(const o of options) {
        // Create base button
        const button = document.createElement("a");
        button.classList.add("waves-effect", "waves-light", "btn", "truncate");
        button.id = o.name;
        button.onclick = onButtonClick;

        // Create base icon
        const icon = document.createElement("i");
        icon.classList.add("material-icons", "left");

        // Is the button a default one?
        if(defaultButtons.includes(o.name)) {
            const defaultData = defaults[o.name];

            // Set the default data
            button.text = await window.API.translate(`default-button-${defaultData.name}`);
            button.style.color = defaultData.color;
            button.style.backgroundColor = defaultData.background;
            button.classList.add(...defaultData.classes);
            icon.classList.add(`md-${defaultData.icon}`);
        }

        // Set the button's options, if the button is a default button
        // the previous settings will be overwritten
        if (o.text) button.text = o.text;
        if (o.color) button.style.color = o.color;
        if (o.background) button.style.backgroundColor = o.background;
        if (o.classes) button.classList.add(...o.classes);
        if (o.icon) icon.classList.add(`md-${o.icon}`);

        // Add the icon to the button as first child
        button.prepend(icon);
        buttons.push(button);
    }

    return buttons;
}

/**
 * Create a list of checkboxes to add to the DOM.
 * @param {Object[]} options Options for a checkbox
 * @param {String} options.name
 * Name of the checkbox, it will be returned when the user click 
 * on a button if it is checked. 
 * If it's a default name the others properties will be automatically set.
 * Default names are: `preserve-savegame`.
 * @param {String} [options.text]
 * The text to show on the checkbox.  
 * Overwrite the `default` options if specified.
 * @param {Boolean} [options.checked]
 * The value assumed by the checkbox.
 * Overwrite the `default` options if specified.
 * @returns List of checkboxes to add to the page
 */
async function createCheckboxes(options) {
    // Local variables
    const defaultCheckboxes = ["preserve-savegame"];
    const checkboxes = [];

    // Load the file containing the data for the default buttons
    const cwd = await window.API.cwd();
    const path = window.API.join(cwd, "resources", "default-checkboxes.json");
    const data = await window.IO.read(path);
    const defaults = JSON.parse(data);

    // A checkbox is defined as:
    /*
    <label>
        <input type="checkbox" checked="checked" />
        <span>Yellow</span>
    </label>
    */

    for(const o of options) {
        const label = document.createElement("label");
        const input = document.createElement("input");
        input.setAttribute("type", "checkbox");
        input.id = o.name;
        const span = document.createElement("span");

        // Is the checkbox a default one?
        if (defaultCheckboxes.includes(o.name)) {
            const defaultData = defaults[o.name];

            // Set the default data
            span.innerText = await window.API.translate(`default-checkbox-${defaultData.name}`);
            const checked = defaultData.checked ? "checked" : "";
            input.setAttribute("checked", checked);
        }

        // Set the checkbox's options, if the checkbox is a 
        // default checkbox the previous settings will be overwritten
        if (o.text) span.innerText = o.text;
        if (o.checked !== undefined) {
            const checked = o.checked ? "checked" : "";
            input.setAttribute("checked", checked);
        }

        // Prepare the checkbox
        label.append(input, span);
        checkboxes.push(label);
    }
    return checkboxes;
}

/**
 * Prepare the window.
 * @param {Object} args Arguments for the window
 * @param {String} args.title Title of the window
 * @param {String} args.message Message to show in the window
 * @param {String} args.type Type of messagebox: `error`/`warning`/`info`
 * @param {Object} args.buttons List of properties for the buttons to add to the window
 * @param {Object} args.checkboxes List of properties for the checkboxes to add to the window
 */
async function prepare(args) {
    // Set the data
    document.getElementById("title").textContent = args.title;
    document.getElementById("message").textContent = args.message;

    // Set the window icon
    await setIcon(args.type);

    // Create the buttons
    const buttonsContainer = document.querySelector(".buttons-container");
    const buttons = await createButtons(args.buttons);
    buttonsContainer.append(...buttons);

    // Create the checkboxes
    if(args.checkboxes) {
        const checkContainer = document.querySelector(".checkboxes-container");
        const checkboxes = await createCheckboxes(args.checkboxes);
        checkContainer.append(...checkboxes);
    }

    // Resize window to fit content
    fitContent();
}
//#endregion Private methods

//#region IPC

window.API.once("window-arguments", function (args) {
    window.requestAnimationFrame(() => prepare(args));
});

//#endregion IPC
