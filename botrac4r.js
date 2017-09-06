#!/usr/local/bin/node

/// === REQUIRES, CONSTANTS AND GLOBALS ===

let cf = {}, bf = {}, bc = {}; // Common Functions, Bot Framework and Bot Commands
let modules = [ // Load these modules on startup and on change
    {
        filename: "./common.js",
        dest: "common"
    },{
        filename: "./commonbot.js",
        dest: "bot framework"
    },{
        filename: "./botcommands.js",
        dest: "bot commands"
    }
];

let token = require("./token.js"); // Bot token
//let cf = require("./common.js"); // Now loaded via module
let defaultPrefix = "."; // Bot prefixes and related, can be changed by user preferences
let defaultSeperator = " ";
let defaultAltSplit = ";";
let configurables;

let Discord = require("discord.io"); // Important libraries
let fs = require("fs");
let request = require("request");

let bot = new Discord.Client({ // Log in bot
    token: token,
    autorun: true
});
loadModules(); // Actually load the modules
let log = cf.log; // Shortcut to log
try { //TODO: Replace this with a database :angery:
    configurables = JSON.parse(fs.readFileSync("./configurables.json"));
} catch (e) {
    log("Restoring backup configurables copy");
    configurables = JSON.parse(fs.readFileSync("./configurables.json.bak"));
    fs.writeFileSync("./configurables.json", JSON.stringify(configurables));
}

//let bf = require("./commonbot.js")(bot, cf); // Common bot functions
//let bc = require("./botcommands.js")(bot, cf, bf); // Complete bot commands

let stdin = process.stdin; // Use the terminal to run JS code
stdin.on("data", function(input) {
    input = input.toString();
    //log(`Running "${input}"`);
    try { // Attempt to run input
        let output = eval(input);
        log(output, "responseInfo");
    } catch (e) { // Failed
        log("Error while running code:\n"+e, "responseError");
    }
});

// Load modules when function called and when their files are modified
function loadModules(module) {
    let mods = modules; // List of modules, defaults to global variable modules, overridden by function parameter
    if (module) mods = [module];
    mods.forEach(m => {
        console.log("Loading module "+m.filename);
        delete require.cache[require.resolve(m.filename)]; // Otherwise it loads from the cache and ignores file changes
        switch (m.dest) { // Do different things depending on its purpose
        case "common":
            Object.assign(cf, require(m.filename)); // Load it into common functions
            break;
        case "bot framework":
            Object.assign(bf, require(m.filename)(bot, cf)); // Load it into bot framework
            break;
        case "bot commands":
            Object.assign(bc, require(m.filename)(bot, cf, bf)); // Load it as bot commands
            break;
        }
        if (!m.watched) { // If file isn't already being watched,
            m.watched = true;
            fs.watchFile(m.filename, {interval: 2007}, function() { // watch it.
                bf.sendMessage("176580265294954507", "Reloading "+m.filename);
                loadModules(m);
            });
        }
    });
}

bot.on("ready", function() { // Once the bot connects
    log(`Logged in as ${bot.username} (${bot.id})`, "info");
});

bot.on("message", function(user, userID, channelID, message, event) {
    let data = event.d;
    //let id = event.d.id;
    //let mentions = event.d.mentions;
    //log(event, "info");
    if (message.startsWith(defaultPrefix)) { // If the message starts with the bot prefix
        let mp = message.slice(defaultPrefix.length).split(defaultSeperator);
        for (let c in bc) { // Find a bot command whose alias matches
            if (bc[c].aliases.includes(mp[0])) {
                bc[c].code(userID, channelID, cf.carg(mp.slice(1).join(defaultSeperator), defaultSeperator, defaultAltSplit), data); // Call it
            }
        }
    }
});