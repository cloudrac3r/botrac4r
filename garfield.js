/* Requested by ThatOnettKid#7751. */
module.exports = function(input) {
    let {bot, cf, bf, db} = input;
    let gf = require("garfield");
    let availableFunctions = {
        garfield: {
            aliases: ["garfield"],
            shortHelp: "Fetch a garfield comic strip",
            reference: "[random] [year=*year* month=*month* date=*date*]",
            longHelp: "",
            eris: true,
            code: function(msg, command) {
                if (command.switches.day) command.switches.date = command.switches.day;
                if (command.switches.year) if (command.switches.year.length == 2) {
                    if (parseInt(command.switches.year) > 70) {
                        command.switches.year = "19"+command.switches.year;
                    } else {
                        command.switches.year = "20"+command.switches.year;
                    }
                }
                if (command.switches.year && command.switches.month && command.switches.date) {
                    let date = new Date(command.switches.year+"-"+command.switches.month+"-"+command.switches.date+" 12:00 AM +0:00");
                    if (date.toUTCString() == "Invalid Date") {
                        bf.sendMessage(msg.channel, "That's not a valid date.", {mention: msg.author});
                    } else {
                        bf.sendMessage(msg.channel, "Garfield comic strip for that date: "+gf.request(date.getUTCFullYear(), date.getUTCMonth()+1, date.getUTCDate()), {mention: msg.author});
                    }
                } else if (command.regularWords.includes("random")) {
                    bf.sendMessage(msg.channel, "Random Garfield comic strip: "+gf.random(), {mention: msg.author});
                } else {
                    bf.sendMessage(msg.channel, "Latest Garfield comic strip: "+gf.latest(), {mention: msg.author});
                }
            }
        }
    };
    return availableFunctions;
}