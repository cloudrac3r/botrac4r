module.exports = function(input) {
    let {bot, cf, bf, db, reloadEvent} = input;
    let sqlite = require("sqlite3");
    let pindb = new sqlite.Database("./pinarchive/pinarchive.db");
    let channelPinsUpdate = {};
    let messageUpdate = {};
    let selfUnpin = [];
    let unpinTimeout = 1000;
    bot.on("message", messageEvent);
    bot.on("any", messageUpdateEvent);
    reloadEvent.once(__filename, function() {
        bot.removeListener("message", messageEvent);
        bot.removeListener("any", messageUpdateEvent);
    });
    function getPinChannel(channelID, callback) {
        pindb.get("SELECT * FROM Servers WHERE serverID = ?", bot.channels[channelID].guild_id, function(err, dbr) {
            if (dbr) { // Server is in list of allowed servers
                pindb.get("SELECT * FROM Channels WHERE origin = ?", channelID, function(err, cdbr) {
                    if (!cdbr) { // No channel overrides
                        if (dbr.channelID) { // Default channel exists
                            target = dbr.channelID;
                        }
                        cdbr = {}; // Prevent errors later on
                    } else { // Channel overrides
                        target = cdbr.target;
                    }
                    callback(target, dbr, cdbr);
                });
            }
        });
    }
    function messageEvent(user, userID, channelID, message, event) {
        if (event.d.type == 6) {
            getPinChannel(channelID, function(target, dbr, cdbr) {
                if (target) {
                    cf.log("Pin posting", "info");
                    gpm();
                    function gpm() {
                        bot.getPinnedMessages({channelID: channelID}, function(e,a) {
                            if (e && e.statusCode == 429) {
                                setTimeout(gpm, e.response.retry_after);
                            } else {
                                bot.getMessage({channelID: channelID, messageID: a[0].id}, function(e,r) {
                                    r.attachments.push({});
                                    r.embeds.push({});
                                    bf.sendMessage(target, "", function(e, id) {
                                        if (e) {
                                            cf.log(e, "error");
                                        } else {
                                            bf.reactionMenu(channelID, "OK! That pin has been sent to <#"+target+">.", [
                                                {emoji: bf.buttons["times"], allowedUsers: [userID], ignore: "total", remove: "message", actionType: "js", actionData: () => {
                                                    bot.deleteMessage({channelID: target, messageID: id}, (e) => {
                                                        if (!e) bf.sendMessage(channelID, "Pin archive message manually removed.");
                                                    });
                                                }}
                                            ]);
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
                                            text: (cdbr.name || "#"+bot.channels[r.channel_id].name)+" | "+r.id+" | pinned by "+bot.users[userID].username
                                        },
                                        timestamp: new Date(r.timestamp).toJSON()
                                    }});
                                });
                                if (dbr.maxPins) {
                                    if (a.length > dbr.maxPins) {
                                        bf.sendMessage(channelID, "To make space for more pins, I unpinned the oldest pinned message in this channel.");
                                        let toRemove = a[a.length-1].id;
                                        selfUnpin.push(toRemove);
                                        bot.deletePinnedMessage({channelID: channelID, messageID: toRemove});
                                    }
                                }
                            }
                        });
                    }
                }
            });
        }
    }
    function messageUpdateEvent(event) {
        if (!event.d) return;
        if (event.t == "MESSAGE_UPDATE") {
            if (event.d.pinned == false) {
                if (channelPinsUpdate[event.d.channel_id] && Date.now()-channelPinsUpdate[event.d.channel_id].time < unpinTimeout) {
                    somethingWasUnpinned(event.d.channel_id, channelPinsUpdate[event.d.channel_id].latestTimestamp, event.d.id);
                    channelPinsUpdate[event.d.channel_id] = {};
                } else {
                    messageUpdate[event.d.channel_id] = {time: Date.now(), id: event.d.id};
                }
            }
        } else if (event.t == "CHANNEL_PINS_UPDATE") {
            if (!event) return;
            if (messageUpdate[event.d.channel_id] && Date.now()-messageUpdate[event.d.channel_id].time < unpinTimeout) {
                somethingWasUnpinned(event.d.channel_id, event.d.last_pin_timestamp, messageUpdate[event.d.channel_id].id);
                messageUpdate[event.d.channel_id] = {};
            } else {
                channelPinsUpdate[event.d.channel_id] = {time: Date.now(), latestTimestamp: event.d.last_pin_timestamp};
            }
        }
    }
    function somethingWasUnpinned(channelID, latestTimestamp, messageID) {
        cf.log("Something unpinned", "info");
        getPinChannel(channelID, function(target) {
            if (target) {
                bot.getMessages({channelID: target}, function(e,a) {
                    a.filter(m => m.author.id == bot.id)
                    .filter(m => m.embeds[0] || m.embeds[0].type == "rich")
                    .forEach(m => {
                        if (m.embeds[0].footer.text.match(/^.+ \| [0-9]{18,} \| pinned by .+$/)) {
                            let pinner = Object.keys(bot.users).find(u => m.embeds[0].footer.text.match(/pinned by (.+)$/)[1] == bot.users[u].username);
                            //cf.log(pinner, "warning");
                            if (m.embeds[0].footer.text.includes(messageID)) {
                                if (selfUnpin.includes(messageID)) {
                                    cf.log("Message unpinned by self due to pin limit, not removing from archive", "spam");
                                    selfUnpin = selfUnpin.filter(p => p != messageID);
                                } else {
                                    cf.log("Unarchived "+m.id+": "+m.embeds[0].description, "info");
                                    bot.deleteMessage({channelID: target, messageID: m.id});
                                }
                            } else {
                                //cf.log("messageID did not match: "+messageID+" != "+m.embeds[0].footer.text, "spam");
                            }
                        } else {
                            //cf.log("Embed footer did not match: "+m.embeds[0].footer.text, "spam");
                        }
                    });
                });
            }
        });
    }
}
