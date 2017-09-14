module.exports = function(input) {
    let {bot, cf, db} = input;
    let reactionMenus = {};
    let availableFunctions = {
        // Send a message to a channel.
        nameOfChannel: function(channelID) {
            let channelName = "an unnamed channel";
            if (bot.users[channelID]) {
                channelName = "@"+bot.users[channelID].username;
            } else if (bot.directMessages[channelID]) {
                channelName = "@"+bot.directMessages[channelID].recipient.username;
            } else {
                channelName = "#"+bot.channels[channelID].name;
            }
            return channelName;
        },
        emojiToObject: function(emoji) { // Actually not to an object, but to a usable form.
            if (typeof(emoji) == "object" && !emoji.id) {
                return emoji.name;
            }
            if (typeof(emoji) != "string") return emoji;
            let customEmojiRegex = /^<:(\w{2,}):([0-9]{8,})>$/;
            if (emoji.match(customEmojiRegex)) {
                return {name: emoji.replace(customEmojiRegex, "$1"), id: emoji.replace(customEmojiRegex, "$2")};
            }
            return emoji;
        },
        sendMessage: function(channelID, message, callback, additional) {
            if (!channelID) { // Obviously a channelID is needed
                cf.log("Need a channelID to send a message to", "warning");
                return;
            }
            if (!message) { // Empty messages don't work, so don't try
                cf.log("Cannot send empty message", "info");
                return;
            }
            if (!callback) callback = new Function(); // Create an empty callback to fall back to
            if (typeof(message) == "object") { // Convert objects to strings
                if (additional.largeObject) {
                    message = JSON.stringify(message, null, 4);
                } else {
                    message = JSON.stringify(message);
                }
            }
            bot.sendMessage(Object.assign({to: channelID, message: message}, additional), function(err, res) { // Actually send the message
                if (err) { // Handle various errors
                    if (err.statusMessage == "TOO MANY REQUESTS") { // Rate limit
                        cf.log("Message blocked by rate limit, retrying in "+err.response.retry_after, "info");
                        setTimeout(function() { // Try again after the timeout
                            availableFunctions.sendMessage(channelID, message, callback, additional);
                        }, err.response.retry_after);
                    } else { // Unknown error
                        cf.log(cf.stringify(err, true), "error");
                        callback(err);
                    }
                } else { // Success
                    cf.log(`Sent a message to ${availableFunctions.nameOfChannel(channelID)} (${channelID}): ${message}`, "spam"); // Log information about what happened
                    callback(err, res.id, res);
                }
            });
        },
        addReaction: function(channelID, messageID, reaction, callback) {
            if (!channelID) {
                cf.log("Need a channelID to react in", "warning");
                return;
            }
            if (!messageID) {
                cf.log("Need a messageID to react to", "warning");
                return;
            }
            if (!reaction) {
                cf.log("Need a reaction to react with", "warning");
                return;
            }
            if (!callback) callback = new Function();
            reaction = availableFunctions.emojiToObject(reaction); // Convert emoji strings to objects
            bot.addReaction({channelID: channelID, messageID: messageID, reaction: reaction}, function(err, res) {
                if (err) {
                    if (err.statusMessage == "TOO MANY REQUESTS") {
                        cf.log("Reaction blocked by rate limit, retrying in "+err.response.retry_after, "spam");
                        setTimeout(function() {
                            availableFunctions.addReaction(channelID, messageID, reaction, callback);
                        }, err.response.retry_after);
                    } else {
                        cf.log(`${channelID}, ${messageID}, ${cf.stringify(reaction)}`, "error");
                        cf.log(cf.stringify(err, true), "error");
                        callback(err);
                    }
                } else {
                    cf.log(`Added the reaction ${reaction} to a message (${messageID}) in ${availableFunctions.nameOfChannel(channelID)} (${channelID})`, "spam");
                    callback(err, res);
                }
            });
        },
        addReactions: function(channelID, messageID, reactions, callback) {
            if (!channelID) {
                cf.log("Need a channelID to react in", "warning");
                return;
            }
            if (!messageID) {
                cf.log("Need a messageID to react to", "warning");
                return;
            }
            if (!reactions.length) {
                cf.log("Need some reactions to react with", "warning");
                return;
            }
            if (!callback) callback = new Function();
            function addNextReaction() {
                if (reactions.length > 0) {
                    availableFunctions.addReaction(channelID, messageID, reactions.shift(), addNextReaction);
                } else {
                    callback();
                }
            }
            addNextReaction();
        },
        removeReaction: function(channelID, messageID, reaction, userID, callback) {
            if (!channelID) {
                cf.log("Need a channelID to remove reactions in", "warning");
                return;
            }
            if (!messageID) {
                cf.log("Need a messageID to remove reactions on", "warning");
                return;
            }
            if (!reaction) {
                cf.log("Need a reaction to remove", "warning");
                return;
            }
            if (!userID) userID = bot.id;
            if (!callback) callback = new Function();
            reaction = availableFunctions.emojiToObject(reaction); // Convert emoji strings to objects
            bot.removeReaction({channelID: channelID, messageID: messageID, reaction: reaction, userID: userID}, function(err, res) {
                if (err) {
                    if (err.statusMessage == "TOO MANY REQUESTS") {
                        cf.log("Reaction removal blocked by rate limit, retrying in "+err.response.retry_after, "spam");
                        setTimeout(function() {
                            availableFunctions.removeReaction(channelID, messageID, reaction, userID, callback);
                        }, err.response.retry_after);
                    } else {
                        //cf.log(`${channelID}, ${messageID}, ${cf.stringify(reaction)}`, "error");
                        cf.log(cf.stringify(err, true), "error");
                        callback(err);
                    }
                } else {
                    cf.log(`Removed the reaction ${reaction} from a message (${messageID}) in ${availableFunctions.nameOfChannel(channelID)} (${channelID})`, "spam");
                    callback(err, res);
                }
            });
        },
        removeReactions: function(channelID, messageID, reactions, users, callback) {
            if (!channelID) {
                cf.log("Need a channelID to remove reactions in", "warning");
                return;
            }
            if (!messageID) {
                cf.log("Need a messageID to remove reactions on", "warning");
                return;
            }
            if (!reactions) {
                cf.log("Need some reactions to remove", "warning");
                return;
            }
            reactions = reactions.map(r => availableFunctions.emojiToObject(r));
            function userIncludeFunction(userID) {
                if (users) return users.includes(userID);
                else return true;
            }
            if (!callback) callback = new Function();
            let remaining = 0;
            bot.getMessage({channelID: channelID, messageID: messageID}, function(err, res) {
                if (err) {
                    cf.log(cf.stringify(err, true), "error");
                } else {
                    res.reactions.filter(re => reactions.some(ar => cf.slimMatch([ar, availableFunctions.emojiToObject(re.emoji)]) || ar == re.emoji.name)).forEach(re => bot.getReaction({channelID: channelID, messageID: messageID, reaction: availableFunctions.emojiToObject(re.emoji)}, function(err, res) {
                        res.map(u => u.id).filter(id => userIncludeFunction(id)).forEach(id => {
                            remaining++;
                            availableFunctions.removeReaction(channelID, messageID, availableFunctions.emojiToObject(re.emoji), id, function() {
                                if (!--remaining) callback();
                            });
                            //cf.log("Now removing "+availableFunctions.emojiToObject(re.emoji)+channelID+messageID+id);
                        });
                    }));
                }
                //cf.log(r, "info");
            });
        },
        reactionMenu: function(channelID, message, actions, callback) { // actions = [{emoji: {name: "", id: ""}, actionType: "(reply|js)", actionData: (Function|String)}, ...]
            availableFunctions.sendMessage(channelID, message, function(err, messageID) {
                if (messageID) {
                    availableFunctions.addReactions(channelID, messageID, actions.map(a => a.emoji));
                    reactionMenus[messageID] = {actions: actions, channelID: channelID};
                }
            });
        }
    }
    bot.on("messageReactionAdd", function(event) {
        if (event.d.user_id == bot.id) return;
        cf.log(event, "info");
        if (reactionMenus[event.d.message_id]) {
            let menu = reactionMenus[event.d.message_id]; // "menu" is faster to type
            //cf.log(event.d.emoji.name+" // "+menu.actions[0].emoji+" // "+event.d.emoji.name==menu.actions[0].emoji);
            menu.actions.filter(a => cf.slimMatch([availableFunctions.emojiToObject(a.emoji), event.d.emoji]) || a.emoji == event.d.emoji.name).forEach(function(action) { // Only matching emojis
                switch (action.actionType) { // Do different things depending on the action type
                case "reply": // Reply, mention the user in the same channel and give a message
                    availableFunctions.sendMessage(event.d.channel_id, `<@${event.d.user_id}> ${action.actionData}`);
                    break;
                case "js": // Run JS code
                    action.actionData();
                    break;
                }
                switch (action.remove) { // Sometimes remove certain emojis after being clicked
                case "user": // Remove the user's reaction only
                    availableFunctions.removeReaction(event.d.channel_id, event.d.message_id, action.emoji, event.d.user_id);
                    break;
                case "menu": // Remove all reactions belonging to that menu
                    availableFunctions.removeReactions(event.d.channel_id, event.d.message_id, menu.actions.map(a => a.emoji), undefined, function() {
                        availableFunctions.sendMessage(event.d.channel_id, "Done removing reactions")
                    });
                    break;
                }
            });
        }
    });
    return availableFunctions;
};