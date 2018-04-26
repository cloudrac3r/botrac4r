const prettyMs = require("pretty-ms");
const timeMultipliers = {
    s: 1000,
    m: 60*1000,
    h: 60*60*1000,
    d: 24*60*60*1000,
    w: 7*24*60*60*1000
};
let timers = [];

module.exports = function(input) {
    let {bot, cf, bf, db, reloadEvent} = input;

    function addReminder(reminder) {
        timers.push(setTimeout(() => {
            bf.sendMessage(reminder.channelID, `<@${reminder.userID}> Ping! ${reminder.textTime} ago, you asked me to remind you about this:\n${reminder.text}`);
            db.run("DELETE FROM Reminders WHERE id=?", reminder.id);
        }, reminder.time-Date.now()));
    }

    reloadEvent.on(__filename, () => {
        timers.forEach(t => clearTimeout(t));
    });
    db.all("SELECT * FROM Reminders", (err, dbr) => {
        dbr.forEach(reminder => {
            addReminder(reminder);
        });
    });

    return {
        "remind": {
            aliases: ["remind", "reminder"],
            shortHelp: "Set a reminder to be triggered later",
            longHelp: 'Time input is formatted as sets of numbers followed by a single letter from (w, d, h, m, s).\n'+
                      'For example, `1d 6h 30m walk the dog` would set a reminder for 1 day, 6 hours and 30 minutes from now with the text "walk the dog".',
            reference: "*time* *text to be reminded about*",
            code: function(userID, channelID, command, d) {
                let time = Date.now();
                let words = command.regularWords.map(w => w.toLowerCase());
                let textTime = [];
                let valid = false;
                let w = words[0];
                while (w && w.match(/^\d+[wdhms]$/)) {
                    valid = true;
                    textTime.push(w);
                    let [number, letter] = w.match(/^(\d+)([wdhms])$/).slice(1);
                    time += number*timeMultipliers[letter];
                    words.shift();
                    w = words[0];
                }
                if (valid) {
                    let receiveChannel = bot.directMessages[channelID] ? userID : channelID;
                    db.run("INSERT INTO Reminders VALUES (NULL, ?, ?, ?, ?, ?)", [userID, receiveChannel, words.join(command.split), time, textTime.join(" ")], err => {
                        db.get("SELECT seq FROM sqlite_sequence WHERE name='Reminders'", (err, dbr) => {
                            if (err) throw err;
                            addReminder({userID, channelID, text: words.join(command.split), time, id: dbr.seq, textTime: textTime.join(" ")});
                            bf.addReaction(channelID, d.id, bf.buttons["green tick"]);
                        });
                    });
                } else {
                    bf.sendMessage(channelID, "You need to specify when to set the reminder for. Try `"+command.prefix+"help "+command.name+"` for more info.", {mention: userID});
                }
            }
        }
    }
}