module.exports = function(input) {
    let {bot, cf, bf, db} = input;
    let availableFunctions = {
        roll: {
            aliases: ["roll", "dice", "random", "rng"],
            shortHelp: "Pick a random number.",
            reference: "[[min=]*minimumNumber*] [[max=]*maximumNumber*] [message]",
            longHelp: "The first number in the message (or the min= switch) is the lowest number that can be picked, defaulting to 1. The second number in the message (or the max= switch) is the highest number that can be picked. Any other text in the message will be used as the description of the roll.",
            code: function(userID, channelID, command, d) { // Lowest and highest possible rolls
                let min = isNaN(parseInt(command.switches.min)) ?
                    (isNaN(parseInt(command.numbers[0])) ? 1 : parseInt(command.numbers[0]))
                  : (parseInt(command.switches.min));
                let max = isNaN(parseInt(command.switches.max)) ?
                    (isNaN(parseInt(command.numbers[1])) ? 100 : parseInt(command.numbers[1]))
                  : (parseInt(command.switches.max));
                if (min > max) { // Swap order if min was actually the larger number
                    let t = min; min = max; max = t;
                }
                let result = cf.rint(min, max); // Pick the number
                let message = (command.switches.message || command.nonNumbers.join(" ") || "a number"); // Get the input message
                bf.sendMessage(channelID, `Choosing ${message} from ${min} to ${max}: **${result}**`, {mention: userID}); // Send it all back
            }
        },
        choose: {
            aliases: ["choose", "choice", "pick"],
            shortHelp: "Choose one items from a list.",
            reference: "[+t *title*] *item1* [*item2*] [*item3*] [*...*]",
            longHelp: "Put a series of words seperated by AS to choose exactly one of them.",
            code: function(userID, channelID, command, d) {
                if (command.altWords[0] == "") {
                    bf.sendMessage(channelID, "No choices were given, so I cannot choose.", {mention: userID});
                    return;
                }
                let result = cf.rarray(command.altWords);
                let title = command.flags.on.includes("t") ? command.altWords.shift() : "I choose";
                let message = `From ${cf.listify(command.altWords, "nothing", "`")}, ${title}`;
                bf.sendMessage(channelID, `${message}: **${result}**`, {mention: userID});
            }
        },
        temp: {
            aliases: ["temp", "temperature", "celsius", "farenheit"],
            shortHelp: "Convert a temperature from Celsius to Farenheit or vice-versa.",
            reference: "*temperature*",
            longHelp: "Put exactly one number without a unit and it will be converted in both directions.",
            code: function(userID, channelID, command, d) {
                if (!command.numbers[0]) {
                    bf.sendMessage(channelID, "No temperature was given, so I cannot convert.", {mention: userID});
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
                bf.sendMessage(channelID, response, {mention: userID});
            }
        },
        yesno: {
            aliases: ["yn", "yesno", "8ball"],
            shortHelp: "Answer a question with yes or no.",
            reference: "[*question*] [[yes=]*percentage*] [no=*percentage*]",
            longHelp: "Supply a number to change the % chance of picking yes (default 50).",
            code: function(userID, channelID, command, d) {
                let words = [
                    ["yes"],
                    ["no"]
                ];
                let yesChance = ((parseFloat(command.switches.yes) >= 0 && parseFloat(command.switches.yes) <= 100 ? parseFloat(command.switches.yes)+"" : false)
                 || (parseFloat(command.switches.no) >= 0 && parseFloat(command.switches.no) <= 100 ? 100-parseFloat(command.switches.no)+"" : false)
                 || (parseFloat(command.numbers[0]) >= 0 && parseFloat(command.numbers[0]) <= 100 ? parseFloat(command.numbers[0])+"" : false)
                 || 50);
                cf.log(yesChance, "error");
                let question = (command.nonNumbers[0] ? command.nonNumbers.join(command.split) : "do something");
                let yn = (Math.random()*100 < yesChance ? 0 : 1);
                let response = cf.rarray(words[yn]);
                bf.sendMessage(channelID, `Deciding if you should ${question}: **${response}** *(luck: ${yesChance}%)*`, {mention: userID});
            }
        },
        setup: {
            aliases: ["configure", "setup", "prefix", "option", "options"],
            shortHelp: "Configure your prefix and split preferences.",
            reference: "",
            longHelp: "A menu will appear allowing you to change settings.",
            code: function(userID, channelID, command, d) {
                db.get("SELECT * FROM Users WHERE userID=?", [userID], (err,dbr) => {
                    bf.reactionMenu(channelID, "**Settings menu**\n"+
                                               `${bf.buttons["1"]} Prefix (currently "${dbr.prefix}")\n`+
                                               `${bf.buttons["2"]} Prefix plus space (currently **${(dbr.prefix.endsWith(" ") ? "using a space" : "not using a space")}**)\n`+
                                               `${bf.buttons["3"]} Mentions (currently **${(dbr.mention ? "on" : "off")}**)\n`, [
                        {emoji: bf.buttons["1"], allowedUsers: [userID], remove: "user", actionType: "js", actionData: () => {
                            bf.messageMenu(channelID, "What would you like your new prefix to be?", userID, undefined, (message, event) => {
                                db.run("UPDATE Users SET prefix=? WHERE userID=?", [message, userID], (err) => {
                                    if (!err) {
                                        bf.addReaction(channelID, event.d.id, "✅");
                                        dbr.prefix = message;
                                    }
                                });
                            })}},
                        {emoji: bf.buttons["2"], allowedUsers: [userID], remove: "user", actionType: "js", actionData: () => {
                            if (!dbr.prefix.endsWith(" ")) {
                                bf.sendMessage(channelID, "A space will be appended to your current prefix.", (err, id) => {
                                    db.run("UPDATE Users SET prefix=? WHERE userID=?", [dbr.prefix+" ", userID], (err) => {
                                        if (!err) {
                                            bf.addReaction(channelID, id, "✅");
                                            dbr.prefix += " ";
                                        }
                                    });
                                });
                            } else {
                                bf.sendMessage(channelID, "Ending spaces will be removed from your current prefix.", (err, id) => {
                                    db.run("UPDATE Users SET prefix=? WHERE userID=?", [dbr.prefix.replace(/ *$/, ""), userID], (err) => {
                                        if (!err) {
                                            bf.addReaction(channelID, id, "✅");
                                            dbr.prefix = dbr.prefix.replace(/ *$/, "");
                                        }
                                    });
                                });
                            }}},
                        {emoji: bf.buttons["3"], allowedUsers: [userID], remove: "user", actionType: "js", actionData: function() {
                            let id;
                            function setMentionPref(pref) {
                                db.run("UPDATE Users SET mention=? WHERE userID=?", [pref, userID], function(err, dbr) {
                                    if (!err) bf.addReaction(channelID, id, "✅");
                                });
                            }
                            bf.reactionMenu(channelID, "Would you like to be mentioned at the start of command responses?", [
                                {emoji: bf.buttons["yes"], allowedUsers: [userID], ignore: "total", actionType: "js", actionData: () => setMentionPref(1)},
                                {emoji: bf.buttons["no"], allowedUsers: [userID], ignore: "total", actionType: "js", actionData: () => setMentionPref(0)}
                            ], (err,mid) => id = mid);
                        }}
                    ]);
                });
            }
        },
        flag: {
            aliases: ["flag"],
            shortHelp: "Create a representation of the US flag using emojis.",
            reference: "blue=*blueEmoji* red=*redEmoji* white=*whiteEmoji* [[size=]*size*]",
            longHelp: "Supply three different emojis along with their colours using command switches, and an optional size.",
            code: function(userID, channelID, command, d) {
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
                    bf.sendMessage(channelID, "You did not specify "+cf.listify(error)+" in your command.", {mention: true});
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
                bf.sendMessage(channelID, output, {mention: userID, characterLimit:
                    "Unfortunately, that flag uses more than Discord's character limit of "+bf.messageCharacterLimit+" characters. Here's what you can do instead:\n"+
                    "• Decrease the size of the flag\n"+
                    "• Swap out some custom emojis in favour of regular emojis\n"+
                    "• Stop shitposting"
                });
            }
        },
        "invite": {
            aliases: ["invite"],
            shortHelp: "Add "+bot.username+" to a server",
            reference: "",
            longHelp: "",
            code: function(userID, channelID, command, d) {
                bf.sendMessage(channelID, "You can use this link to add "+bot.username+" to any server: <https://discordapp.com/oauth2/authorize?client_id=353703396483661824&scope=bot>\nTo work properly, it will need additional permissions. Giving it Administrator will give it all the permissions it needs.");
            }
        }
    };
    return availableFunctions;
};