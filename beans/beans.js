module.exports = function(input) {
    let {bot, cf, bf, db, reloadEvent} = input;
    let sqlite = require("sqlite3");
    let beandb = new sqlite.Database(__dirname+"/beans.db");
    const beansPerCan = 150;
    const beansPerUser = 10;
    const beansPlus = () => Math.floor(Math.random()*35+60);
    const beanEmojis = {
        bean: ["<:bean:389564067854942208>"],
        can:  ["<:can:389551717236211712>", "<:can:389590564191993866>", "<:can:389590631351058443>", "<:can:389590686644568064>",
               "<:can:389590739660832788>"],
        bowl: ["<:bowl:389564111609921536>", "<:bowl:389609236738605066>", "<:bowl:389609302026878976>", "<:bowl:389609376417316874>",
               "<:bowl:389609497980829696>"]
    };
    let spoonables = [];
    if (bot.connected) {
        bot.on("message", messageHandler);
        bot.on("messageReactionAdd", reactionHandler);
    } else {
        bot.once("allUsers", function() {
            bot.on("message", messageHandler);
            bot.on("messageReactionAdd", reactionHandler);
        });
    }
    reloadEvent.once(__filename, function() {
        bot.removeListener("message", messageHandler);
        bot.removeListener("messageReactionAdd", reactionHandler);
    });
    function messageHandler(user, userID, channelID, message, event) {
        //cf.log(Math.random()*100+" "+Date.now(), "warning");
        /*if ((Math.random()*100 <= 0.6 && event.d.type == 0 && !bot.users[userID].bot && !bot.directMessages[channelID])) {
            let spawned = beanEmojis.bowl.slice(0, Math.floor(Math.random()*4+2));
            bf.addReactions(channelID, event.d.id, [...spawned]);
            spoonables.push({channelID: channelID, messageID: event.d.id, spooners: [], bowls: [...spawned]});
        }*/
    }
    function reactionHandler(event) {
        if (event.d.emoji.name == "🥄") {
            spoonables.forEach(message => {
                if (message.channelID == event.d.channel_id && message.messageID == event.d.message_id) {
                    if (!message.bowls.length) return;
                    bf.removeReaction(event.d.channel_id, event.d.message_id, "🥄", event.d.user_id);
                    cf.log(message.spooners);
                    cf.log(message.bowls);
                    if (!message.spooners.includes(event.d.user_id)) {
                        message.spooners.push(event.d.user_id);
                        let bowl = message.bowls.pop();
                        if (bowl) bf.removeReactions(event.d.channel_id, event.d.message_id, [bowl], undefined, function(err) {
                            if (bf.userIDToEmoji(event.d.user_id)) bf.addReaction(event.d.channel_id, event.d.message_id, bf.userIDToEmoji(event.d.user_id));
                        });
                        beandb.get("SELECT * FROM Beans WHERE userID=?", [event.d.user_id], function(e,r) {
                            if (!r) {
                                beandb.run("INSERT INTO Beans VALUES (?,?,?)", [event.d.user_id, 0, beansPlus()]);
                            } else {
                                beandb.run("UPDATE Beans SET beans=? WHERE userID=?", [r.beans+beansPlus(), event.d.user_id]);
                            }
                        });
                    }
                }
            });
        }
    }
    let availableFunctions = {
        beans: {
            aliases: ["beans", "bean"],
            shortHelp: "I;m thinking about thos Beans",
            reference: "[*@mention*]",
            longHelp: "Beans are your basic currency. If you see "+beanEmojis.bowl[0]+" on a message, react with 🥄 to scoop some up.\n"+
                      "All beans that you scoop up are stored individually as "+beanEmojis.bean[0]+".\n"+
                      "However, this bot wants its beans in a can, so in order to use your beans you must can them first.\n"+
                      "To can a bean, use this command. A "+beanEmojis.can[0]+" will appear on your message. Everyone who clicks the can will add a can's worth of beans to the pile. "+
                      "Once you're happy with the number of reactions, click "+bf.buttons["tick"]+". All the beans will be canned and distributed to everyone who put in beans. "+
                      "Since this bot likes variety in its bean manufacturers, everyone will also receive a few free beans. The more people that put in beans, the more free beans each person gets.",
            code: function(userID, channelID, command, d) {
                let target = userID;
                if (d.mentions[0]) target = d.mentions[0].id;
                beandb.all("SELECT * FROM Beans", function(err,all) {
                    if (!all) return;
                    dbr = all.find(row => row.userID == target);
                    if (err) {
                        cf.log(err, "error");
                        return;
                    } else if (!dbr) {
                        bf.sendMessage(channelID, bf.userIDToNick(target, bot.channels[channelID].guild_id)+" has no beans.");
                    } else {
                        let message = `<@${target}>'s beans:\n`+
                                      `${beanEmojis.bean[0]} ${dbr.beans}\n`+
                                      `${beanEmojis.can[0]} ${dbr.cans}`;
                        let beaners = [];
                        let id;
                        bf.reactionMenu(channelID, `${message}\nHave as many people as possible react ${beanEmojis.can[0]}, then press ${bf.buttons["tick"]} to start canning.`, [
                            {emoji: beanEmojis.can[0], remove: "none", actionType: "js", actionData: function(event) {
                                let user = all.find(row => row.userID == event.d.user_id);
                                if (!user || user.beans < beansPerCan) {
                                    bf.removeReaction(channelID, event.d.message_id, beanEmojis.can[0], event.d.user_id);
                                } else if (!beaners.includes(event.d.user_id)) {
                                    beaners.push(event.d.user_id);
                                }
                            }},
                            {emoji: bf.buttons["tick"], remove: "user", actionType: "js", actionData: function(event) {
                                setTimeout(function() { // Make sure all beaners are known
                                    beandb.all("SELECT * FROM Beans", function(err,all) {
                                        beaners = beaners.filter(u => {
                                            let user = all.find(row => row.userID == u);
                                            if (!user || user.beans < beansPerCan) return false;
                                            else return true;
                                        });
                                        if (beaners.length) {
                                            let beanBonus = Math.min((beaners.length-1)*beansPerUser, 50);
                                            beandb.run("BEGIN TRANSACTION", function() {
                                                let pending = beaners.length;
                                                beaners.forEach(u => {
                                                    let user = all.find(row => row.userID == u);
                                                    beandb.run("UPDATE Beans SET beans=?,cans=? WHERE userID=?", [user.beans-beansPerCan+beanBonus, user.cans+1, user.userID], function() {
                                                        if (--pending == 0) finished();
                                                    });
                                                });
                                                function finished() {
                                                    beandb.run("END TRANSACTION");
                                                    beaners.forEach(u => {
                                                        let user = all.find(row => row.userID == u);
                                                        if (user.beans-beansPerCan+beanBonus < beansPerCan) bf.removeReaction(channelID, event.d.message_id, beanEmojis.can[0], event.d.user_id);
                                                    });
                                                    let message = "```YAML\n"+cf.tableify([
                                                            beaners.map(u => bot.users[u].username+":"),
                                                            beaners.map(u => all.find(row => row.userID == u).beans),
                                                            beaners.map(u => "-"+beansPerCan),
                                                            beaners.map(u => "+"+beanBonus+"  ->"),
                                                            beaners.map(u => all.find(row => row.userID == u).beans-beansPerCan+beanBonus)
                                                        ], ["right", "right", "right", "right", "right"])+"```";
                                                    if (id) {
                                                        bf.editMessage(channelID, id, message);
                                                    } else {
                                                        bf.sendMessage(channelID, message, (e,mid) => id = mid);
                                                    }
                                                }
                                            });
                                        } else {
                                            bf.sendMessage(channelID, "Nobody is able to can beans.");
                                        }
                                    });
                                }, 200);
                            }}
                        ]);
                    }
                });
            }
        }
    }
    return availableFunctions;
}
