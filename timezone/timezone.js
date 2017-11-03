module.exports = function(input) {
    let {bot, cf, bf, db} = input;
    let sqlite = require("sqlite3");
    let tzdb = new sqlite.Database("./timezone/timezone.db");
    let availableFunctions = {
        timezone: {
            aliases: ["timezone", "time", "localtime", "tz"],
            shortHelp: "Find the local time of another user.",
            reference: "*@mention*",
            longHelp: "Mention a user, and if they have set their time zone, you will be told their local time.",
            code: function(userID, channelID, command, d) {
                let target = d.mentions[0];
                if (target) target = target.id;
                else target = userID;
                tzdb.get("SELECT UTCoffset FROM Users WHERE userID = ?", target, function(err, dbr) {
                    if (!dbr) {
                        bf.sendMessage(channelID, "That user has not set their time zone and therefore you cannot see their local time. Ask them to set their local time if you wish.", {mention: userID});
                    } else {
                        let [hourOffset, minuteOffset] = dbr.UTCoffset.split(":");
                        let time = new Date();
                        time.setUTCHours(time.getUTCHours()+parseInt(hourOffset));
                        time.setUTCMinutes(time.getUTCMinutes()+parseInt(minuteOffset));
                        bf.sendMessage(channelID, `The local time of ${bf.userIDToNick(target, bot.channels[channelID].guild_id, "nickname")} is **${cf.getReadableTime(time, 2, true)}**.`, {mention: userID});
                    }
                });
            }
        },
        setTimezone: {
            aliases: ["settimezone", "settime", "settz", "stz", "setlocaltime", "slocaltime"],
            shortHelp: "Set your own local time zone.",
            reference: "[-]*hours*:*minutes*",
            longHelp: "Set your time zone by naming its offset compared to UTC time in hours and minutes. For example, Pacific Time is `-20:00`, Eastern Time is `-17:00` and England is `0:00`.",
            code: function(userID, channelID, command, d) {
                if (command.input.match(/^-?[0-9]{1,2}:[0-9]{2}$/)) {
                    tzdb.run("DELETE FROM Users WHERE userID = ?", userID, function() {
                        tzdb.run("INSERT INTO Users VALUES (?, ?)", [userID, command.input], function() {
                            bf.sendMessage(channelID, "That offset has been stored.", {mention: userID});
                        });
                    });
                } else {
                    bf.sendMessage(channelID, "Your input (**"+command.input+"**) is not valid. Specify an offset in hours and minutes, for example, `-17:00`.", {mention: userID});
                }
            }
        }
    };
    return availableFunctions;
}