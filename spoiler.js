module.exports = function(input) {
    let {bot, cf, bf, db, reloadEvent} = input;
    bf.addTemporaryListener(bot, "messageReactionAdd", __filename, (msg, emoji, userID) => {
        if (emoji.id == "377710017627029505") {
            db.get("SELECT * FROM Spoilers WHERE channelID=? AND messageID=?", [msg.channel.id, msg.id], (err, dbr) => {
                if (!dbr) return;
                bf.sendMessage(userID, "**Spoiler contents:**\n\n"+dbr.text);
            });
        }
    });
    return {
        "spoiler": {
            aliases: ["spoiler"],
            shortHelp: "Hide a message from unsuspecting eyes",
            longHelp: "Put the message you want to hide after the command name. It will be deleted and replaced with an obscured version, "+
                      "and the original can be revealed by clicking a reaction. The result will be sent via direct message to the user who clicked.",
            reference: "*text to hide*",
            eris: true,
            code: function(msg, command) {
                setTimeout(() => msg.delete(), 250);
                let hidden = command.input.replace(/\w/ig, "🅱");
                bf.reactionMenu(msg.channel, msg.author.mention+" just posted a spoiler:\n\n"+hidden+"\n\nPress "+bf.buttons.info+" to reveal, or <:hippospecial:421589347943448589> to partially reveal.", [
                    {emoji: bf.buttons.info},
                    {emoji: "<:hippospecial:421589347943448589>", actionType: "js", actionData: (msg, emoji, user) => {
                        attempts = 0;
                        let text = hidden;
                        (function partiallyReveal() {
                            attempts++;
                            text = [...text].map((l,i) => {
                                console.log(l);
                                if (l == "🅱" && Math.random() < 0.4) return [...command.input][i];
                                else return l;
                            }).join("");
                            if (text == command.input) {
                                bf.sendMessage(user, text+"\n\nCongrats on mutilating that poor little hippospecial button. ("+attempts+" "+cf.plural("attempt", attempts)+".)");
                            } else {
                                bf.reactionMenu(user, text+"\n\nPress <:hippospecial:421589347943448589> to reveal more.", [
                                    {emoji: "<:hippospecial:421589347943448589>", actionType: "js", actionData: partiallyReveal}
                                ]);
                            }
                        })();
                    }}
                ]).then(msg => {
                    db.run("INSERT INTO Spoilers VALUES (?, ?, ?)", [msg.channel.id, msg.id, command.input]);
                });
            }
        }
    }
}