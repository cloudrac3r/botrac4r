module.exports = function(input) {
    let {bot, cf, bf, db} = input;
    let sqlite = require("sqlite3");
    let tzdb = new sqlite.Database(__dirname+"/timezone.db");
    let availableFunctions = {
        timezone: {
            aliases: ["timezone", "time", "localtime", "tz"],
            shortHelp: "Find the local time of another user",
            reference: "*@mention*",
            longHelp: "Mention a user, and if they have set their time zone, you will be told their local time.",
            eris: true,
            code: function(msg, command) {
                let target = msg.mentions[0];
                if (target) target = target.id;
                else target = msg.author.id;
                tzdb.get("SELECT UTCoffset FROM Users WHERE userID = ?", target, function(err, dbr) {
                    if (!dbr) {
                        bf.sendMessage(msg.channel, "That user has not set their time zone and therefore you cannot see their local time. Ask them to set their local time if you wish.", {mention: msg.author});
                    } else {
                        let [hourOffset, minuteOffset] = dbr.UTCoffset.split(":");
                        let time = new Date();
                        time.setUTCHours(time.getUTCHours()+parseInt(hourOffset));
                        time.setUTCMinutes(time.getUTCMinutes()+parseInt(minuteOffset));
                        bf.sendMessage(msg.channel, `The local time of ${bf.userToNick(target, bot.channelGuildMap[msg.channel.id])} is **${cf.getReadableTime(time, 2, true)}**.`, {mention: msg.author});
                    }
                });
            }
        },
        setTimezone: {
            aliases: ["settimezone", "settime", "settz", "stz", "setlocaltime", "slocaltime"],
            shortHelp: "Set your own local time zone",
            reference: "[-]*hours*:*minutes*",
            longHelp: "Set your time zone by naming its offset compared to UTC time in hours and minutes. For example, Pacific Time is `-8:00`, Eastern Time is `-5:00` and England is `0:00`.",
            eris: true,
            code: function(msg, command) {
                if (command.input.match(/^-?[0-9]{1,2}:[0-9]{2}$/)) {
                    tzdb.run("DELETE FROM Users WHERE userID = ?", msg.author.id, function() {
                        tzdb.run("INSERT INTO Users VALUES (?, ?)", [msg.author.id, command.input], function() {
                            let [hourOffset, minuteOffset] = command.input.split(":");
                            let time = new Date();
                            time.setUTCHours(time.getUTCHours()+parseInt(hourOffset));
                            time.setUTCMinutes(time.getUTCMinutes()+parseInt(minuteOffset));
                            bf.sendMessage(msg.channel, `Your local time has been updated to **${cf.getReadableTime(time, 2, true)}**.`, {mention: msg.author});
                        });
                    });
                } else {
                    bf.sendMessage(msg.channel, "Your input (**"+command.input+"**) is not valid. Specify an offset in hours and minutes, for example, `-17:00`.", {mention: msg.author});
                }
            }
        }
    };
    return availableFunctions;
}