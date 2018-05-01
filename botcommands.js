module.exports = function(input) {
    let {bot, cf, bf, db} = input;
    const prettyMs = require("pretty-ms");
    let availableFunctions = {
        /*menu: {
            aliases: ["menu"],
            eris: true,
            code: function(msg, command) {
                bf.reactionMenu(msg, [
                    {emoji: bf.buttons.minus, remove: "user", ignore: "total", actionType: "reply", actionData: "Boop"},
                    {emoji: bf.buttons.plus, remove: "user", actionType: "reply", actionData: "Bop"}
                ]);
            }
        },*/
        roll: {
            aliases: ["roll", "dice", "random", "rng"],
            shortHelp: "Pick a random number.",
            reference: "[[min=]*minimumNumber*] [[max=]*maximumNumber*] [message]",
            longHelp: "The first number in the message (or the min= switch) is the lowest number that can be picked, defaulting to 1.\n"+
                      "The second number in the message (or the max= switch) is the highest number that can be picked.\n"+
                      "Any other text in the message will be used as the description of what you are rolling for.",
            eris: true,
            code: function(msg, command) { // Lowest and highest possible rolls
                let min;
                if (command.switches.min) min = parseInt(command.switches.min);
                else if (command.numbers.length >= 2) min = parseInt(command.numbers[0]);
                else min = 1;
                let max;
                if (command.switches.max) max = parseInt(command.switches.max);
                else if (command.numbers.length == 1) max = parseInt(command.numbers[0]);
                else if (command.numbers.length >= 2) max = parseInt(command.numbers[1]);
                else max = 100;
                if (min > max) { // Swap order if min was actually the larger number
                    let t = min; min = max; max = t;
                }
                let result = cf.rint(min, max); // Pick the number
                let message = (command.switches.message || command.nonNumbers.join(" ") || "a number"); // Get the input message
                bf.sendMessage(msg.channel, `Choosing ${message} from ${min} to ${max}: **${result}**`, {mention: msg.author}); // Send it all back
            }
        },
        choose: {
            aliases: ["choose", "choice", "pick"],
            shortHelp: "Choose one items from a list.",
            reference: "[+t *title*] *item1* [*item2*] [*item3*] [*...*]",
            longHelp: "Put a series of words seperated by AS to choose exactly one of them.",
            eris: true,
            code: function(msg, command) {
                if (command.altWords[0] == "") {
                    bf.sendMessage(msg.channel, "No choices were given, so I cannot choose.", {mention: msg.author});
                    return;
                }
                let result = cf.rarray(command.altWords);
                let title = command.flags.on.includes("t") ? command.altWords.shift() : "I choose";
                let intro = cf.listify(command.altWords.map(w => `❬${w}❭`), "nothing");
                let message = `From ${intro}, ${title}`;
                bf.sendMessage(msg.channel, `${message}: ❰**${result}**❱`, {mention: msg.author});
            }
        },
        temp: {
            aliases: ["temp", "temperature", "celsius", "farenheit"],
            shortHelp: "Convert a temperature from Celsius to Farenheit or vice-versa.",
            reference: "*temperature*",
            longHelp: "Put exactly one number without a unit and it will be converted in both directions.",
            eris: true,
            code: function(msg, command) {
                if (!command.numbers[0]) {
                    bf.sendMessage(msg.channel, "No temperature was given, so I cannot convert.", {mention: msg.author});
                    return;
                }
                let input = (parseFloat(command.numbers[0]).toFixed(1).length+"") < (parseFloat(command.numbers[0])+"").length ?
                    parseFloat(command.numbers[0]).toFixed(1)
                  : parseFloat(command.numbers[0]);
                let CtoF = (input*1.8+32).toFixed(1);
                let FtoC = ((input-32)/1.8).toFixed(1);
                let response = (command.nonNumbers.join(command.split) ?
                    "​"+command.nonNumbers.join(command.split)+": "+input+"°C = **"+CtoF+"°F** / "+input+"°F = **"+FtoC+"°C**." // Zero-width space
                  : input+"°C = **"+CtoF+"°F** and "+input+"°F = **"+FtoC+"°C**.");
                bf.sendMessage(msg.channel, response, {mention: msg.author});
            }
        },
        yesno: {
            aliases: ["yn", "yesno", "8ball"],
            shortHelp: "Answer a question with yes or no.",
            reference: "[*question*] [[yes=]*percentage*] [no=*percentage*]",
            longHelp: "Supply a number to change the percentage chance of picking yes. Default chance is 50. (Supply numbers without the % sign.)",
            eris: true,
            code: function(msg, command) {
                let words = [
                    ["yes"],
                    ["no"]
                ];
                let yesChance = ((parseFloat(command.switches.yes) >= 0 && parseFloat(command.switches.yes) <= 100 ? parseFloat(command.switches.yes)+"" : false)
                 || (parseFloat(command.switches.no) >= 0 && parseFloat(command.switches.no) <= 100 ? 100-parseFloat(command.switches.no)+"" : false)
                 || (parseFloat(command.numbers[0]) >= 0 && parseFloat(command.numbers[0]) <= 100 ? parseFloat(command.numbers[0])+"" : false)
                 || 50);
                //cf.log(yesChance, "error");
                let question = (command.nonNumbers[0] ? command.nonNumbers.join(command.split) : "Deciding if you should do something");
                let yn = (Math.random()*100 < yesChance ? 0 : 1);
                let response = cf.rarray(words[yn]);
                bf.sendMessage(msg.channel, `​${question}: **${response}** *(luck: ${yesChance}%)*`, {mention: msg.author}); //SC: U+200B zero-width space
            }
        },
        setup: {
            aliases: ["configure", "setup", "prefix", "option", "options", "settings"],
            shortHelp: "Configure your prefix and split preferences.",
            reference: "",
            longHelp: "A menu will appear allowing you to change settings.",
            eris: true,
            code: function(msg, command) {
                let userID = msg.author.id;
                db.get("SELECT * FROM Users WHERE userID=?", userID, (err,dbr) => {
                    bf.reactionMenu(msg.channel, "**Settings menu**\n"+
                                               `${bf.buttons["1"]} Prefix (currently \`${dbr.prefix.replace(/`/g, "ˋ")}\`)\n`+ //SC: IPA modifier grave U+02CB
                                               `${bf.buttons["2"]} Prefix plus space (currently **${(dbr.prefix.endsWith(" ") ? "using a space" : "not using a space")}**)\n`+
                                               `${bf.buttons["3"]} Regex prefix (currently a **${(dbr.isRegex ? "regex" : "string")}**)\n`+
                                               `${bf.buttons["4"]} Mentions (currently **${(dbr.mention ? "on" : "off")}**)\n`+
                                               `${bf.buttons["5"]} HookTube links (currently **${(dbr.hooktube ? "on" : "off")}**)`, [
                        {emoji: bf.buttons["1"], allowedUsers: [userID], remove: "user", actionType: "js", actionData: () => {
                            bf.messageMenu(msg.channel, "What would you like your new prefix to be?", userID, undefined, msg => {
                                new Promise((resolve, reject) => {
                                    if (dbr.isRegex) {
                                        try {
                                            new RegExp(msg.content);
                                            resolve();
                                        } catch (e) {
                                            bf.sendMessage(msg.channel, "Your prefix is set as a regular expression, but what you typed is not valid.");
                                        }
                                    } else {
                                        resolve();
                                    }
                                }).then(() => {
                                    db.run("UPDATE Users SET prefix=? WHERE userID=?", [msg.content, userID], (err) => {
                                        if (!err) {
                                            bf.addReaction(msg, "✅");
                                            dbr.prefix = msg.content;
                                        } else {
                                            bf.addReaction(msg, "❎");
                                        }
                                    });
                                });
                            });
                        }},
                        {emoji: bf.buttons["2"], allowedUsers: [userID], remove: "user", actionType: "js", actionData: () => {
                            if (!dbr.prefix.endsWith(" ")) {
                                bf.sendMessage(msg.channel, "A space will be appended to your current prefix.", (err, id) => {
                                    db.run("UPDATE Users SET prefix=? WHERE userID=?", [dbr.prefix+" ", userID], (err) => {
                                        if (!err) {
                                            bf.addReaction(msg, "✅");
                                            dbr.prefix += " ";
                                        } else {
                                            bf.addReaction(msg, "❎");
                                        }
                                    });
                                });
                            } else {
                                bf.sendMessage(msg.channel, "Ending spaces will be removed from your current prefix.", (err, id) => {
                                    db.run("UPDATE Users SET prefix=? WHERE userID=?", [dbr.prefix.replace(/ *$/, ""), userID], (err) => {
                                        if (!err) {
                                            bf.addReaction(msg, "✅");
                                            dbr.prefix = dbr.prefix.replace(/ *$/, "");
                                        } else {
                                            bf.addReaction(msg, "❎");
                                        }
                                    });
                                });
                            }
                        }},
                        {emoji: bf.buttons["3"], allowedUsers: [userID], remove: "user", actionType: "js", actionData: function() {
                            let id;
                            function setRegexPref(value) {
                                db.run("UPDATE Users SET isRegex=? WHERE userID=?", [value, userID], (err) => {
                                    if (!err) {
                                        bf.addReaction(msg, "✅");
                                        dbr.isRegex = value;
                                    } else {
                                        bf.addReaction(msg, "❎");
                                    }
                                });
                            }
                            try {
                                new RegExp(dbr.prefix);
                                bf.reactionMenu(msg.channel, "Would you like your prefix to be a regular expression instead of a string?", [
                                    {emoji: bf.buttons["yes"], allowedUsers: [userID], ignore: "total", actionType: "js", actionData: () => setRegexPref(1)},
                                    {emoji: bf.buttons["no"], allowedUsers: [userID], ignore: "total", actionType: "js", actionData: () => setRegexPref(0)}
                                ], (err,mid) => id = mid);
                            } catch (e) {
                                bf.sendMessage(msg.channel, "Your current prefix is not a valid regular expression and so this option cannot be set.");
                            }
                        }},
                        {emoji: bf.buttons["4"], allowedUsers: [userID], remove: "user", actionType: "js", actionData: function() {
                            let id;
                            function setMentionPref(pref) {
                                db.run("UPDATE Users SET mention=? WHERE userID=?", [pref, userID], function(err, dbr) {
                                    if (!err) bf.addReaction(msg, "✅");
                                    else bf.addReaction(msg, "❎");
                                });
                            }
                            bf.reactionMenu(msg.channel, "Would you like to be mentioned at the start of command responses?", [
                                {emoji: bf.buttons["yes"], allowedUsers: [userID], ignore: "total", actionType: "js", actionData: () => setMentionPref(1)},
                                {emoji: bf.buttons["no"], allowedUsers: [userID], ignore: "total", actionType: "js", actionData: () => setMentionPref(0)}
                            ], (err,mid) => id = mid);
                        }},
                        {emoji: bf.buttons["5"], allowedUsers: [userID], remove: "user", actionType: "js", actionData: function() {
                            function setHooktubePref(msg, pref) {
                                db.run("UPDATE Users SET hooktube=? WHERE userID=?", [pref, userID], function(err, dbr) {
                                    if (!err) bf.addReaction(msg, "✅");
                                    else bf.addReaction(msg, "❎");
                                });
                            }
                            bf.reactionMenu(msg.channel, "Would you like to be able to get a HookTube link  to the same video every time you post a YouTube link?", [
                                {emoji: bf.buttons["yes"], allowedUsers: [userID], ignore: "total", actionType: "js", actionData: msg => setHooktubePref(msg, 1)},
                                {emoji: bf.buttons["no"], allowedUsers: [userID], ignore: "total", actionType: "js", actionData: msg => setHooktubePref(msg, 0)}
                            ]);
                        }}
                    ]);
                });
            }
        },
        flag: {
            aliases: ["flag"],
            shortHelp: "Create a miniature US flag using emojis.",
            reference: "blue=*blueEmoji* red=*redEmoji* white=*whiteEmoji* [[size=]*size*]",
            longHelp: "Supply three different emojis along with their colours using command switches, and an optional size.",
            eris: true,
            code: function(msg, command) {
                let error = [];
                let colours = ["blue", "red", "white"];
                let size = parseInt(command.numbers[0]) || parseInt(command.switches.size) || 3;
                let template = "";
                colours.forEach(c => {
                    if (!command.switches[c]) {
                        error.push(c);
                    }
                });
                if (error.length) {
                    bf.sendMessage(msg.channel, "You did not specify "+cf.listify(error)+" in your command.", {mention: msg.author});
                    return;
                }
                switch (size) {
                case 1:
                    template =  "*-"+
                                "--";
                    break;
                case 2:
                    template =  " * ---\n"+
                                "* *   \n"+
                                " * ---\n"+
                                "      \n"+
                                "------";
                    break;
                case 3:
                    template =  "* * -----\n"+
                                " * *     \n"+
                                "* * -----\n"+
                                " * *     \n"+
                                "---------\n"+
                                "         \n"+
                                "---------";
                    break;
                case 4:
                    template =  " * * ------\n"+
                                "* * *      \n"+
                                " * * ------\n"+
                                "* * *      \n"+
                                "-----------\n"+
                                "           \n"+
                                "-----------\n"+
                                "           \n"+
                                "-----------";
                    break;
                }
                let output = "Here is your flag. Fly it proudly. ✋😤\n"+template.replace(/\*/g, command.switches.blue).replace(/-/g, command.switches.red).replace(/ /g, command.switches.white);
                bf.sendMessage(msg.channel, output, {mention: msg.author, characterLimit:
                    "Unfortunately, that flag uses more than Discord's character limit of "+bf.messageCharacterLimit+" characters. Here's spme things you can do to get around this:\n"+
                    "• Decrease the size of the flag\n"+
                    "• Swap out some custom emojis in favour of regular emojis\n"+
                    "• Stop shitposting"
                });
            }
        },
        "invite": {
            aliases: ["invite"],
            shortHelp: "Add botrac4r to a server",
            reference: "",
            longHelp: "",
            eris: true,
            code: function(msg, command) {
                bf.sendMessage(msg.channel, "You can use this link to add botrac4r to any server: <https://discordapp.com/oauth2/authorize?client_id=353703396483661824&scope=bot>\n"+
                                            "To work properly, it will need additional permissions. Giving it Administrator will give it all the permissions it needs, though you can probably get by with just Manage Messages.");
            }
        },
        "uptime": {
            aliases: ["uptime", "stats"],
            shortHelp: "See how long botrac4r has been running",
            reference: "",
            longHelp: "This time is reset whenever the bot goes offline and comes back online, or a full restart is performed (full restarts are silent).",
            eris: true,
            code: function(msg, command) {
                bf.sendMessage(msg.channel, "Bot uptime: "+prettyMs(process.uptime()*1000), {mention: msg.author});
            }
        },
        "vote": {
            aliases: ["vote", "poll"],
            shortHelp: "Ask people to vote on something",
            reference: "[*question*]",
            longHelp: "Reactions will be added to your message allowing people to vote on a decision.\n"+
                      "Putting numbers in your message will add those numbers as a reaction, in order to allow people to choose from a set of options.\n"+
                      "Polls do not automatically end; you must scroll back up and count reactions manually to see who voted for what.",
            eris: true,
            code: function(msg, command) {
                let reactions = [bf.buttons["yes"], bf.buttons["no"], bf.buttons["point down"]];
                for (let i = 0; i <= 9; i++) {
                    if (command.input.match(new RegExp("(^|\\D)"+i+"($|\\D)"))) {
                        reactions.push(bf.buttons[i.toString()]);
                    }
                }
                bf.addReactions(msg, reactions);
            }
        }
    };
    return availableFunctions;
};
