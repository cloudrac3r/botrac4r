#!/usr/local/bin/node

/// === REQUIRES, CONSTANTS AND GLOBALS ===

let cf = {}; let bf = {}; let bc = {}; // Common Functions, Bot Framework and Bot Commands
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
    },{
        filename: "./onuw.js",
        dest: "bot commands"
    },{
        filename: "./pinarchive/pinarchive.js",
        dest: "bot commands"
    },{
        filename: "./timezone/timezone.js",
        dest: "bot commands"
    }
];

let token = require("./token.js"); // Bot token
//let cf = require("./common.js"); // Now loaded via module
let defaultPrefix = "v!"; // Bot prefixes and related, can be changed by user preferences
let defaultSeperator = " ";
let defaultAltSplit = ";";
let defaultMentionPref = 1;
let configurables;

let Discord = require("discord.io-gateway_v6"); // Switch to a fork of discord.io with gateway v6 support
let fs = require("fs");
let request = require("request");
let sqlite = require("sqlite3");
let db = new sqlite.Database("./botrac4r.db");

let bot = new Discord.Client({ // Log in bot
    token: token,
    autorun: true
});
loadModules(); // Actually load the modules
let log = cf.log; // Shortcut to log

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
        try {
            delete require.cache[require.resolve(m.filename)]; // Otherwise it loads from the cache and ignores file changes
            switch (m.dest) { // Do different things depending on its purpose
            case "common":
                Object.assign(cf, require(m.filename)); // Load it into common functions
                break;
            case "bot framework":
                Object.assign(bf, require(m.filename)({bot: bot, cf: cf, db: db})); // Load it into bot framework
                break;
            case "bot commands":
                Object.assign(bc, require(m.filename)({bot: bot, cf: cf, bf: bf, db: db})); // Load it as bot commands
                break;
            }
            if (bot.connected) {
                bf.sendMessage("244613376360054794", "Loaded **"+m.filename+"**");
            }
        } catch (e) {
            if (bot.connected) {
                bf.sendMessage("244613376360054794", "Failed to load module **"+m.filename+"**: `"+e+"`");
            }
            console.log("Failed to reload module "+m.filename+"\n"+e);
        }
        if (!m.watched) { // If file isn't already being watched,
            m.watched = true;
            fs.watchFile(m.filename, {interval: 2007}, function() { // watch it.
                loadModules(m);
            });
        }
    });
}

bot.once("ready", function() {
    log("Loading users", "info");
    bot.getAllUsers();
});

bot.once("allUsers", function() { // Once the bot connects
    log(`Logged in as ${bot.username} (${bot.id})`, "info");
});

bot.on("message", function(user, userID, channelID, message, event) {
    if (bot.users[userID].bot && userID != "238459957811478529") return; // Ignore all bots except for botrac3r //TODO: change
    let data = event.d;
    db.get("SELECT prefix, seperator, altSeperator FROM Users WHERE userID = ?", userID, function(err, dbr) {
        if (!dbr) {
            bf.sendMessage(channelID, "<@"+userID+"> I don't have information stored for you, so you'll be set up to use "+bot.username+" with the default settings. There will be a command at some point to change them.");
            dbr = {prefix: defaultPrefix, seperator: defaultSeperator, altSeperator: defaultAltSplit};
            db.run("INSERT INTO Users VALUES (?, ?, ?, ?, ?)", [userID, defaultPrefix, defaultSeperator, defaultAltSplit, defaultMentionPref]);
        }
        let { prefix, seperator, altSeperator } = dbr;
        //log(event, "info");
        if (message.startsWith(prefix)) { // If the message starts with the bot prefix
            let mp = message.slice(prefix.length).split(seperator);
            for (let c in bc) { // Find a bot command whose alias matches
                if (bc[c].aliases.includes(mp[0])) {
                    bc[c].code(userID, channelID, cf.carg(mp.slice(1).join(seperator), prefix, seperator, defaultAltSplit, mp[0]), data); // Call it
                }
            }
        }
    });
});

bot.on("disconnect", function() {
    log("Disconnected from Discord, will reconnect automatically.", "info");
    bot.connect();
});