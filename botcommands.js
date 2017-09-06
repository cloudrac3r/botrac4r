module.exports = function(bot, cf, bf) {
    let availableFunctions = {
        roll: {
            aliases: ["roll", "dice", "random", "rng"],
            shortHelp: "Pick a random number.",
            reference: "[[min=]*minimumNumber*] [[max=]*maximumNumber*] [message]",
            longHelp: "The first number in the message (or the min= switch) is the lowest number that can be picked, defaulting to 1. The second number in the message (or the max= switch) is the highest number that can be picked. Any other text in the message will be used as the description of the roll.",
            code: function(userID, channelID, command, d) {
                let min = parseInt(command.switches.min || command.numbers[0] || 1); // Lowest and highest possible rolls
                let max = parseInt(command.switches.max || command.numbers[1] || 100);
                let result = cf.rint(min, max); // Pick the number
                let message = (command.switches.message || command.nonNumbers.join(" ") || `a number`); // Get the input message
                bf.sendMessage(d.channel_id, `Choosing ${message} from ${min} to ${max}: **${result}**`); // Send it all back
            }
        }
    };
    return availableFunctions;
};