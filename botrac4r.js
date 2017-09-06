#!/usr/local/bin/node

/// === REQUIRES, CONSTANTS AND GLOBALS ===

let cf = {}, bf = {}, bc = {};
let modules = [
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
//let cf = require("./common.js"); // Common functions
let defaultPrefix = ".";
let defaultSeperator = " ";
let defaultAltSplit = ";";
let configurables;

let Discord = require("discord.io");
let fs = require("fs");
let request = require("request");

let bot = new Discord.Client({ // Log in bot
    token: token,
    autorun: true
});
loadModules();
let log = cf.log; // Shortcut to log
try {
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

function loadModules(module) {
    let mods = modules;
    if (module) mods = [module];
    mods.forEach(m => {
        console.log("Loading module "+m.filename);
        delete require.cache[require.resolve(m.filename)];
        switch (m.dest) {
        case "common":
            Object.assign(cf, require(m.filename));
            break;
        case "bot framework":
            Object.assign(bf, require(m.filename)(bot, cf));
            break;
        case "bot commands":
            Object.assign(bc, require(m.filename)(bot, cf, bf));
            break;
        }
        if (!m.watched) {
            m.watched = true;
            fs.watchFile(m.filename, {interval: 2007}, function() {
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
    if (message.startsWith(defaultPrefix)) {
        let mp = message.slice(defaultPrefix.length).split(defaultSeperator);
        for (let c in bc) {
            if (bc[c].aliases.includes(mp[0])) {
                bc[c].code(userID, channelID, cf.carg(mp.slice(1).join(defaultSeperator), defaultSeperator, defaultAltSplit), data);
            }
        }
    }
});