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
                bf.sendMessage(channelID, `Choosing ${message} from ${min} to ${max}: **${result}**`); // Send it all back
            }
        },
        choose: {
            aliases: ["choose", "choice", "pick"],
            shortHelp: "Choose one items from a list.",
            reference: "[t=*title*] *item1* [*item2*] [*item3*] [*...*]",
            longHelp: "Put a series of words seperated by AS to choose exactly one of them.",
            code: function(userID, channelID, command, d) {
                if (command.altWords[0] == "") {
                    bf.sendMessage(channelID, "No choices were given, so I cannot choose.");
                    return;
                }
                let result = cf.rarray(command.altWords);
                let message = `From ${cf.listify(command.altWords, "nothing", "`")}, ${(command.switches.t ? command.switches.t+" is" : "I choose")}`;
                bf.sendMessage(channelID, `${message}: **${result}**`);
            }
        },
        menu: {
            aliases: ["menu"],
            code: function(userID, channelID, command, d) {
                bf.reactionMenu(channelID, "Test reaction menu", [
                    {emoji: "🙂", remove: "user", ignore: "that", actionType: "reply", actionData: "You clicked the slight smile."},
                    {emoji: "😄", remove: "user", ignore: "total", actionType: "reply", actionData: "You clicked the big smile."},
                    {emoji: "<:hippo:268962438181945345>", remove: "user", ignore: "that", actionType: "reply", actionData: "You clicked the hippo."},
                    {emoji: "📄", remove: "user", ignore: "that", actionType: "js", actionData: function(ev, r) {bf.sendMessage(r[Object.keys(r)[0]].channelID, "```"+cf.stringify(ev, true)+"```")}}
                ]);
                cf.log(bot);
            }
        },
        yesno: {
            aliases: ["yn", "yesno", "8ball"],
            shortHelp: "Answer a question with yes or no.",
            reference: "[*question*] [[yes=]*percentage*] [no=*percentage]",
            longHelp: "Supply a number to change the % chance of picking yes (default 50).",
            code: function(userID, channelID, command, d) {
                let words = [
                    ["yes"],
                    ["no"]
                ];
                let yesChance = (parseFloat(command.switches.yes) || 100-parseFloat(command.switches.no) || parseFloat(command.numbers[0]) || 50);
                cf.log(yesChance, "error");
                let question = (command.nonNumbers[0] ? `"${command.nonNumbers[0]}"` : "do something");
                let yn = (Math.random()*100 < yesChance ? 0 : 1);
                let response = cf.rarray(words[yn]);
                bf.sendMessage(channelID, `Deciding if you should ${question}: **${response}**`);
            }
        },
        setup: {
            aliases: ["configure", "prefix"],
            shortHelp: "Configure your prefix and split preferences.",
            reference: "\`*prefix*\` \`*split*\` \`*AS\`",
            code: function(userID, channelID, command, d) {
            }
        }
    };
    return availableFunctions;
};