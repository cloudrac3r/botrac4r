module.exports = function(input) {
    let {bot, cf, bf, db} = input;
    let sqlite = require("sqlite3");
    let pindb = new sqlite.Database("./pinarchive/pinarchive.db");
    bot.on("message", function(user, userID, channelID, message, event) {
        if (event.d.type == 6) {
            cf.log("Pin detected", "info");
            let target;
            pindb.get("SELECT * FROM Servers WHERE serverID = ?", bot.channels[channelID].guild_id, function(err, dbr) {
                if (dbr) { // Server is in list of allowed servers
                    pindb.get("SELECT * FROM Channels WHERE origin = ?", channelID, function(err, cdbr) {
                        if (!cdbr) { // No channel overrides
                            if (dbr.channelID) { // Default channel exists
                                target = dbr.channelID;
                            }
                            cdbr = {}; // Prevent errors later on
                        } else { // Channel overrides
                            if (target) {
                                target = cdbr.target;
                            }
                        }
                        if (target) {
                            cf.log("Pin posting", "info");
                            bot.getPinnedMessages({channelID: channelID}, function(e,a) {
                                bot.getMessage({channelID: channelID, messageID: a[0].id}, function(e,r) {
                                    r.attachments.push({});
                                    r.embeds.push({});
                                    bf.sendMessage(target, "", function(e) {
                                        if (e) {
                                            cf.log(e, "error");
                                        } else {
                                            bf.sendMessage(channelID, "OK! That pin has been sent to <#"+target+">.", {mention: userID});
                                        }
                                    }, {embed: {
                                        author: {
                                            name: bf.userIDToNick(r.author.id, bot.channels[channelID].guild_id, "username"),
                                            icon_url: "https://cdn.discordapp.com/avatars/"+r.author.id+"/"+bot.users[r.author.id].avatar+".jpg"
                                        },
                                        color: bf.userIDToColour(r.author.id, bot.channels[channelID].guild_id),
                                        description: r.content,
                                        image: {
                                            url: r.attachments[0].url || r.embeds[0].url
                                        },
                                        footer: {
                                            text: cdbr.name || "#"+bot.channels[r.channel_id].name
                                        },
                                        timestamp: new Date(r.timestamp).toJSON()
                                    }});
                                });
                                if (dbr.maxPins) {
                                    if (a.length > dbr.maxPins) {
                                        bf.sendMessage(channelID, "To make space for more pins, I unpinned the oldest pinned message in this channel.");
                                        bot.deletePinnedMessage({channelID: channelID, messageID: a[a.length-1].id});
                                    }
                                }
                            });
                        }
                    });
                }
            });
        }
    });
}