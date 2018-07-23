#!/usr/local/bin/node

//process.on("unhandledRejection", err => { throw err });

/// === REQUIRES, CONSTANTS AND GLOBALS ===

let cf = {}; let bf = {}; let bc = {}; // Common Functions, Bot Framework and Bot Commands
const events = require("events");
let reloadEvent = new events.EventEmitter();
let modules = [ // Load these modules on startup and on change
    {
        filename: __dirname+"/common.js",
        dest: "common"
    },{
        filename: __dirname+"/commonbot.js",
        dest: "bot framework"
    },{
        filename: __dirname+"/botcommands.js",
        dest: "bot commands"
    },{
        filename: __dirname+"/names.js",
        dest: "bot framework"
    },{
        filename: __dirname+"/garfield.js",
        dest: "bot commands"
    },{
        filename: __dirname+"/remind.js",
        dest: "bot commands"
    },{
        filename: __dirname+"/pinarchive/pinarchive.js",
        dest: "bot commands"
    },{
        filename: __dirname+"/spoiler.js",
        dest: "bot commands"
    },{
        filename: __dirname+"/images.js",
        dest: "bot commands"
    },{
        filename: __dirname+"/timezone/timezone.js",
        dest: "bot commands"
    },{
        filename: __dirname+"/only-cloud-cares.js",
        dest: "bot commands"
    },{
        filename: __dirname+"/lock.js",
        dest: "bot commands"
    },{
        filename: __dirname+"/onuw.js",
        dest: "bot commands"
    },{
        filename: __dirname+"/rpg/main.js",
        dest: "bot commands"
    },{
        filename: __dirname+"/todo.js",
        dest: "bot commands"
    },{
        filename: __dirname+"/imageconvert.js",
        dest: "bot commands"
    },{
        filename: __dirname+"/waitfor.js",
        dest: "bot commands"
    }/*,{
        filename: __dirname+"/pets/pet.js",
        dest: "bot commands"
    },{
        filename: __dirname+"/beans/beans.js",
        dest: "bot commands"
    }*/
];

let token = require(__dirname+"/token.js"); // Bot token
//let cf = require("./common.js"); // Now loaded via module
let defaultPrefix = "."; // Bot prefixes and related, can be changed by user preferences
let defaultSeperator = " ";
let defaultAltSplit = ";";
let defaultMentionPref = 1;
let configurables;

let Discord = require("eris", {getAllUsers: true}); // Switch to a fork of discord.io with gateway v6 support
let fs = require("fs");
let request = require("request");
let sqlite = require("sqlite3");
let db = new sqlite.Database(__dirname+"/botrac4r.db");

let bot = new Discord(token); // Log in bot
function log(data, type) {
    if (cf.log) cf.log(data, type);
    else console.log(data);
}

const destinations = {
    "common": filename => Object.assign(cf, require(filename)),
    "bot framework": filename => Object.assign(bf, require(filename)({Discord, bot, cf, db, reloadEvent, loadModule})),
    "bot commands": filename => Object.assign(bc, require(filename)({Discord, bot, cf, bf, db, reloadEvent, loadModule}))
}

let stdin = process.stdin; // Use the terminal to run JS code
stdin.on("data", function(input) {
    input = input.toString();
    //log(`Running "${input}"`);
    try { // Attempt to run input
        let output = eval(input);
        log(output, "responseInfo");
    } catch (e) { // Failed
        log("Error in eval.\n"+e.stack, "responseError");
    }
});

// Load modules on bot start and when they are modified
function loadModule(m) {
    try {
        reloadEvent.emit(m.filename); // Allow the module to detect the reload
        delete require.cache[require.resolve(m.filename)]; // Otherwise it loads from the cache and ignores file changes
        destinations[m.dest](m.filename); // Load it!
        log("Loading module "+m.filename, "info"); // If we got here: success!
    } catch (e) {
        log("Failed to reload module "+m.filename+"\n"+e.stack, "error"); // If we got here: error.
    }
}
function watchModule(m) {
    fs.watchFile(m.filename, {interval: 2000}, () => {
        loadModule(m);
    });
}
(function loadModules() {
    modules.forEach(m => {
        loadModule(m);
        watchModule(m);
    });
})();

bot.on("ready", function() {
    bot.editStatus("online", {name: defaultPrefix + "help", type: 0});
});

bot.once("ready", function() { // Once the bot connects
    log(`Logged in as ${bot.user.username} (${bot.user.id})`, "info");
});

bot.on("messageCreate", checkMessage);
bot.on("messageUpdate", (newm, oldm) => {
    if (oldm == null || newm.content == undefined) return;
    if (newm.editedTimestamp && oldm.editedTimestamp != newm.editedTimestamp) checkMessage(newm);
});
function checkMessage(msg) {
    if (!msg.content) return;
    let message = msg.content;
    if (!bot.users.get(msg.author.id)) return; // Ignore "fake users"
    if (msg.author.bot) return; // Ignore other bots
    if (message == defaultPrefix+"configure") {
        bc.setup.code(msg);
        return;
    }
    db.get("SELECT * FROM Users WHERE userID = ?", msg.author.id, function(err, dbr) {
        if (!dbr) {
            //bf.sendMessage(channelID, "<@"+userID+"> I don't have information stored for you, so you'll be set up to use "+bot.username+" with the default settings. There will be a command at some point to change them.");
            dbr = {prefix: defaultPrefix, isRegex: 0, seperator: defaultSeperator, altSeperator: defaultAltSplit};
            db.run("INSERT INTO Users VALUES (?, ?, 0, ?, ?, ?, 0)", [msg.author.id, defaultPrefix, defaultSeperator, defaultAltSplit, defaultMentionPref]);
        }
        let { prefix, seperator, altSeperator, isRegex } = dbr;
        //log(event, "info");
        let mp;
        let noncommand;
        if (isRegex) {
            if (message.match(prefix)) mp = message.split(message.match(prefix)[0]).join("").split(seperator);
        } else {
            if (message.startsWith(prefix)) {
                let match = message.slice(prefix.length).match(new RegExp(`^(.*?)(?:${seperator}|\n)(.*)$`, "ms"));
                if (match) {
                    mp = [match[1]].concat(match[2].split(seperator));
                    noncommand = match[2];
                } else {
                    mp = [message.slice(prefix.length)];
                    noncommand = "";
                }
            }
        }
        if (mp && mp[0]) {
            if (mp[0].includes("\n")) {
                let word = mp.shift();
                mp.unshift(...word.split("\n"));
            }
            Object.values(bc).forEach(command => { // Find a bot command whose alias matches
                if (command.aliases.includes(mp[0])) {
                    if (command.eris) {
                        command.code(msg, cf.carg(mp.slice(1).join(seperator), prefix, seperator, defaultAltSplit, mp[0]));
                    } else {
                        command.code(msg.author.id, msg.channel, cf.carg(mp.slice(1).join(seperator), prefix, seperator, defaultAltSplit, mp[0]), {d: msg});
                    }
                }
            });
            if (mp[0] == "help") { // Exclusive help command because reasons
                let target;
                if (mp[1]) target = Object.keys(bc).map(c => bc[c]).filter(c => c.aliases.includes(mp[1]))[0];
                if (target) {
                    bf.sendMessage(msg.channel, `**${target.shortHelp}**\n`+
                                                `**Aliases**: ${target.aliases.join(", ")}\n`+
                                                `**Usage**: ${prefix}${mp[1]} ${target.reference}`+
                                                (target.longHelp ? "\n\n"+target.longHelp : ""));
                } else {
                    let commands = Object.values(bc).filter(c => !c.hidden);
                    if (!bf.isDMChannel(msg.channel)) bf.sendMessage(msg.channel, "DM sent.");
                    bf.sendMessage(msg.author.id,
                        "Here's the complete command list. Try **"+prefix+"help *command name*** for more details about a specific command.```\n"+cf.tableify([
                            commands.map(c => prefix+c.aliases[0]),
                            commands.map(c => c.shortHelp)
                        ], ["left", "left"])+"```"
                    ).then(() => bf.sendMessage(msg.author.id,
                        "For some commands, "+bot.user.username+" allows you to use things called **flags** and **switches**.\n"+
                        "Flags are used by prefixing a word with either a + or a -, e.g. `+timer`. This allows you to enable or disable a specific option.\n"+
                        "Switches are used by connecting two words with an equals sign, e.g. `size=4`. This allows you to specify a certain value for an option.\n"+
                        "The whole point of flags and switches is that they can be used **anywhere in the command** rather than needing to be in a specific order. "+
                        "This is very helpful if you often forget the correct order for words in a certain command.\n"+
                        "If you don't want to use flags or switches, you can usually use positional arguments instead."
                    ));
                }
            }
        }
    });
}

bot.connect();
