module.exports = function(input) {
    let {bot, cf, bf, db, reloadEvent} = input;
    const ut = require("./rpg/utilities.js");

    bf.addTemporaryListener(bot, "presenceUpdate", __filename, relationship => {
        if (relationship.status == "online") {
            db.all("SELECT * FROM Waitfor WHERE waitingFor = ? OR userID = ?", Array(2).fill(relationship.user.id), (err, all) => {
                if (err) throw err;
                let recipients = [];
                for (let row of all) {
                    let guild = bf.channelObject(row.channelID).guild;
                    let members = [row.userID, row.waitingFor].map(id => guild.members.get(id));
                    if (members.every(m => m.status == "online")) {
                        bf.sendMessage(row.channelID, `<@${row.userID}> Ping! ${relationship.user.username} is now online.`);
                        recipients.push(row);
                    }
                }
                if (recipients.length == 1) {
                    db.run(
                        "DELETE FROM Waitfor WHERE userID = ? AND waitingFor = ?",
                        [recipients[0].userID, recipients[0].waitingFor]
                    );
                } else if (recipients.length > 1) {
                    db.run("BEGIN TRANSACTION", err => {
                        if (err) throw err;
                        Promise.all(recipients.map(r => new Promise((resolve, reject) => {
                            db.run("DELETE FROM Waitfor WHERE userID = ? AND waitingFor = ?", [r.userID, r.waitingFor], err => {
                                if (err) reject(err);
                                else resolve();
                            });
                        }))).then(() => {
                            db.run("END TRANSACTION");
                        }).catch(err => {
                            throw err;
                        });
                    });
                }
            });
        }
    });

    return {
        "waitfor": {
            aliases: ["waitfor"],
            shortHelp: "Alert you when a user comes online",
            longHelp: "Say an offline/away/dnd user's name and you will be notified when both you and they are online (green) at the same time.",
            reference: "*username*",
            eris: true,
            code: function(msg, command) {
                let member;
                if (!msg.channel.guild) return bf.sendMessage(msg.channel, "Error: This command is only usable in servers.", {mention: msg.author});
                member = ut.partialMatch(command.input, [...msg.channel.guild.members.values()], ["nick"]) || ut.partialMatch(command.input, [...msg.channel.guild.members.values()], ["username"]);
                if (!member) return bf.sendMessage(msg.channel, "Error: Could not find that user.", {mention: msg.author});
                if (member.status == "online") return bf.sendMessage(msg.channel, "Error: That user is already online.", {mention: msg.author});
                db.get("SELECT * FROM Waitfor WHERE userID = ? AND waitingFor = ?", [msg.author.id, member.id], (err, row) => {
                    if (err) throw err;
                    if (row) return bf.sendMessage(msg.channel, "Error: You are already waiting for this user.", {mention: msg.author});
                    db.run("INSERT INTO Waitfor VALUES (?, ?, ?)", [msg.author.id, member.id, msg.channel.id], err => {
                        if (err) throw err;
                        if (!err) bf.addReaction(msg, bf.buttons["green tick"]);
                    });
                });
            }
        }
    }
}