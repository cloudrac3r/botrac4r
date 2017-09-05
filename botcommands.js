module.exports = function(bot, cf, bf) {
    let availableFunctions = {
        roll: {
            aliases: ["roll", "dice", "random", "rng"],
            code: function(userID, channelID, command, d) {
                let min = parseInt(command.switches.min || command.numbers[0] || 1);
                let max = parseInt(command.switches.max || command.numbers[1] || 100);
                let result = cf.rint(min, max);
                let message = (command.switches.message || command.nonNumbers[0] || `a number`);
                bf.sendMessage(d.channel_id, `Choosing ${message} from ${min} to ${max}: **${result}**`);
            }
        }
    };
    return availableFunctions;
};