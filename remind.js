const prettyMs = require("pretty-ms");
const timeMultipliers = {
    s: 1000,
    m: 1000*60,
    h: 1000*60*60,
    d: 1000*60*60*24,
    w: 1000*60*60*24*7,
    y: 1000*60*60*24*365
};
let timers = [];
let longTimers = [];

module.exports = function(input) {
    let {bot, cf, bf, db, reloadEvent} = input;

    let longTimerInterval = setInterval(function() {
        longTimers.forEach(addReminder);
        longTimers.length = 0;
    }, timeMultipliers.w);

    function addReminder(reminder) {
        if (reminder.time-Date.now() > timeMultipliers.w) {
            setImmediate(() => longTimers.push(reminder));
        } else {
            timers.push(setTimeout(() => {
                let text = `<@${reminder.userID}> Ping! ${reminder.textTime} ago, `;
                if (reminder.text) text += `you asked me to remind you about this:\n${reminder.text}`;
                else text += `you set a reminder. Press ${bf.buttons["up"]} to temporarily pin the original message so you can jump back there.`;
                bf.reactionMenu(reminder.channelID, text, [
                    {emoji: bf.buttons["up"], remove: "user", actionType: "js", allowedUsers: [reminder.userID], actionData: (msg, reactionMenus) => {
                        let messageObject = {channelID: reminder.channelID, messageID: reminder.messageID};
                        reloadEvent.emit("pinarchive ignore", messageObject);
                        bf.pinMessage(reminder.channelID, reminder.messageID).then(pinAlert => {
                            cf.log(`Pinned reminder message (${reminder.messageID}) for jumping`, "spam");
                            setTimeout(() => {
                                bf.unpinMessage(reminder.channelID, reminder.messageID);
                                pinAlert.delete();
                            }, 30*1000);
                        });
                    }}
                ]);
                db.run("DELETE FROM Reminders WHERE id=?", reminder.id);
            }, reminder.time-Date.now()));
        }
    }

    reloadEvent.on(__filename, () => {
        timers.forEach(t => clearTimeout(t));
        clearInterval(longTimerInterval);
    });
    bf.onBotConnect(() => {
        db.all("SELECT * FROM Reminders", (err, dbr) => {
            dbr.forEach(reminder => {
                addReminder(reminder);
            });
        });
    });

    return {
        "remind": {
            aliases: ["remind", "reminder"],
            shortHelp: "Set a reminder to be triggered later",
            longHelp: 'Time input is formatted as sets of numbers followed by a single letter from (w, d, h, m, s).\n'+
                      'For example, `1d 6h 30m walk the dog` would set a reminder for 1 day, 6 hours and 30 minutes from now with the text "walk the dog".',
            reference: "*time* *text to be reminded about*",
            eris: true,
            code: function(msg, command) {
                let time = Date.now();
                let words = command.regularWords.map(w => w.toLowerCase());
                let textTime = [];
                let valid = false;
                let w = words[0];
                while (w && w.match(/^\d+[ywdhms]$/)) {
                    valid = true;
                    textTime.push(w);
                    let [number,letter] = w.match(/^(\d+)([ywdhms])$/).slice(1);
                    time += number*timeMultipliers[letter];
                    words.shift();
                    w = words[0];
                }
                if (valid) {
                    db.run("INSERT INTO Reminders VALUES (NULL, ?, ?, ?, ?, ?, ?)", [msg.author.id, msg.channel.id, msg.id, words.join(command.split), time, textTime.join(" ")], err => {
                        db.get("SELECT seq FROM sqlite_sequence WHERE name='Reminders'", (err, dbr) => {
                            if (err) throw err;
                            addReminder({userID: msg.author.id, channelID: msg.channel.id, messageID: msg.id, text: words.join(command.split), time, id: dbr.seq, textTime: textTime.join(" ")});
                            bf.addReaction(msg, bf.buttons["green tick"]);
                        });
                    });
                } else {
                    bf.sendMessage(msg.channel, "You need to specify when to set the reminder for. Try `"+command.prefix+"help "+command.name+"` for more info.", {mention: msg.author});
                }
            }
        }
    }
}