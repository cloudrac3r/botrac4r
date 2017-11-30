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
let defaultPrefix = "."; // Bot prefixes and related, can be changed by user preferences
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
                bf.sendMessage("160197704226439168", "Loaded **"+m.filename+"**");
            }
        } catch (e) {
            if (bot.connected) {
                bf.sendMessage("160197704226439168", "Failed to load module **"+m.filename+"**: `"+e+"`");
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

bot.on("ready", function() {
    bot.setPresence({game: {name: ".help", type: 0}});
});

bot.once("allUsers", function() { // Once the bot connects
    log(`Logged in as ${bot.username} (${bot.id})`, "info");
});

bot.on("message", function(user, userID, channelID, message, event) {
    if (bot.users[userID].bot) return; // Ignore other bots
    let data = event.d;
    db.get("SELECT prefix, seperator, altSeperator FROM Users WHERE userID = ?", userID, function(err, dbr) {
        if (!dbr) {
            //bf.sendMessage(channelID, "<@"+userID+"> I don't have information stored for you, so you'll be set up to use "+bot.username+" with the default settings. There will be a command at some point to change them.");
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
            if (mp[0] == "help") { // Exclusive help command because reasons
                let target;
                if (mp[1]) target = Object.keys(bc).map(c => bc[c]).filter(c => c.aliases.includes(mp[1]))[0];
                if (target) {
                    bf.sendMessage(channelID, `**${target.shortHelp}**\n`+
                                              `**Aliases**: ${target.aliases.join(", ")}\n`+
                                              `**Usage**: ${prefix}${mp[1]} ${target.reference}`+
                                              (target.longHelp ? "\n\n"+target.longHelp : ""));
                } else {
                    if (!bot.directMessages[channelID]) bf.sendMessage(channelID, "DM sent.");
                    bf.sendMessage(userID, bot.username+" uses things called *flags* and *switches*. "+
                                           "These are to make it easier for you to specify options in your command without having to remember which order the options must be given in.\n"+
                                           "Flags are used by prefixing a word with either a + or a -, e.g. `+timer`. This allows you to enable or disable a feature.\n"+
                                           "Switches are used by prefixing a word with another word connected with an equals sign, e.g. `size=4`. This allows you to specify that option anywhere in the command.\n"+
                                           "If you don't want to use flags or switches, you can usually use positional arguments instead.", function() {
                        bf.sendMessage(userID, "Here's the complete command list. Try **"+prefix+"help *command name*** for more details about a specific command.```\n"+cf.tableify([
                            Object.keys(bc).map(c => bc[c]).map(c => prefix+c.aliases[0]),
                            Object.keys(bc).map(c => bc[c]).map(c => c.shortHelp)
                        ], ["left", "left"])+"```");
                    });
                }
            }
        }
    });
});

bot.on("disconnect", function() {
    log("Disconnected from Discord, will reconnect automatically.", "info");
    bot.connect();
});