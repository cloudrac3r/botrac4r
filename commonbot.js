const events = require("events");
const userEmojiMessage = {channelID: "434994415342321674", messageID: "434994502848217099"};

let reactionMenus = {};
let messageMenus = [];

module.exports = function(input) {
    let {bot, cf, db, reloadEvent} = input;
    let userEmojis = {};
    let reactionMenus = {};
    let messageMenus = [];

    function fixCAArgs(input) {
        let {c: callback, a: additional} = input;
        if (typeof(callback) == "object" || typeof(additional) == "function") {
            let t = callback;
            callback = additional;
            additional = t;
        }
        if (!callback) callback = new Function();
        if (!additional) additional = {};
        return {callback, additional};
    }
    function createSendableObject(content, additional) {
        if (!additional) additional = {};
        if (typeof(content) == "string") {
            return Object.assign({content}, additional);
        } else if (typeof(content) == "object") {
            return Object.assign({}, content, additional);
        } else if (!content) {
            return additional;
        }
    }

    let bf = {
        messageCharacterLimit: 2000,
        // Button reactions.
        buttons: { // {(<:([a-z0-9_]+):[0-9]+>) ?} / {"\2": "\1",\n        }
            // Numbers
            "0": "<:bn_0:327896448081592330>",
            "1": "<:bn_1:327896448232325130>",
            "2": "<:bn_2:327896448505217037>",
            "3": "<:bn_3:327896452363976704>",
            "4": "<:bn_4:327896452464508929>",
            "5": "<:bn_5:327896454733627403>",
            "6": "<:bn_6:327896456369274880>",
            "7": "<:bn_7:327896458067968002>",
            "8": "<:bn_8:327896459070537728>",
            "9": "<:bn_9:327896459292704769>",
            // Words
            "end": "<:bn_en:327896461272678400>",
            // Punctuation
            "exclamation": "<:bn_ex:331164187831173120>",
            "question": "<:bn_qu:331164190267932672>",
            // Operators
            "plus": "<:bn_pl:328041457695064064>",
            "minus": "<:bn_mi:328042285704937472>",
            "times": "<:bn_ti:327986149203116032>",
            "plusminus": "<:bn_pm:327986149022760960>",
            // Arrows
            "left": "<:bn_ba:328062456905728002>",
            "down": "<:bn_do:328724374498836500>",
            "up": "<:bn_up:328724374540779522>",
            "right": "<:bn_fo:328724374465282049>",
            "redo": "<:bn_re:362741439211503616>",
            "point down": "<:cbn_ptd:389238901233025034>",
            // Other symbols
            "person": "<:cbn_person:362387757592739850>",
            "cards": "<:cbn_cards:362384965989826561>",
            "info": "<:cbn_info:377710017627029505>",
            "tick": "<:cbn_tick:378414422219161601>",
            "clock": "<:cbn_clock:381652491999117313>",
            "yes": "<:bn_yes:331164192864206848>",
            "no": "<:bn_no:331164190284972034>",
            "blank": "<:bn_bl:330501355737448450>",
            "green tick": "✅",
            "green cross": "❎"
        },
        // Check if a channel is a direct message or in a server.
        isDMChannel: function(channel) {
            if (typeof(channel) == "object") channel = channel.id;
            return !bot.channelGuildMap[channel];
        },
        // Given a thing, return a bot object.
        userObject: function(thing) {
            if (!thing) return;
            if (typeof(thing) == "string") return bot.users.get(thing);
            if (thing.constructor.name.includes("User") || thing.constructor.name == "Member") return thing;
        },
        channelObject: function(thing) {
            if (!thing) return;
            if (typeof(thing) == "string") return bot.getChannel(thing);
            if (thing.constructor.name.includes("Channel")) return thing;
        },
        guildObject: function(thing) {
            if (!thing) return;
            let result = thing;
            if (typeof(result) == "string") result = bot.guilds.get(thing);
            if (result.constructor.name == "Guild") return result;
            return channelObject(thing);
        },
        // Given a user and a server, return the user's member object.
        userToMember: function(user, guild) {
            guild = bf.guildObject(guild);
            user = bf.userObject(user);
            return guild.members.get(user.id);
        },
        // Given a channelID or userID, resolve it to a channel object.
        resolveChannel: function(channel) {
            return new Promise(resolve => {
                if (bf.channelObject(channel)) {
                    resolve(bf.channelObject(channel));
                } else if (bf.userObject(channel)) {
                    bot.getDMChannel(bf.userObject(channel).id).then(c => {
                        resolve(c);
                    });
                } else {
                    resolve(undefined);
                }
            });
        },
        withOptionalChannel: function(input) {
            let args = cf.argsToArray(input);
            return bf.resolveChannel(args[0])
            .then(channel => new Promise(resolve => {
                if (!args[0]) {
                    resolve(args);
                } else {
                    if (channel) args = args.slice(1);
                    resolve([channel].concat(args));
                }
            }));
        },
        // Given a user and a server, return the user's display name.
        userIDToNick: function(user, guild, prefer) {
            if (!prefer) prefer = "";
            user = bf.userObject(user);
            let nick = bf.userToMember(user, guild).nick;
            if (!nick) return username; // No nick? Use username.
            if (prefer.startsWith("user")) { // User(name) should be first
                return username+" ("+nick+")";
            } else if (prefer.startsWith("nick")) { // Nick(name) should be first
                return nick+" ("+username+")";
            } else { // Just the nickname
                return nick;
            }
        },
        // Given a userID and serverID, return the colour of the user's name.
        userToColour: function(user, guild) {
            guild = bf.guildObject(guild);
            let member = bf.userToMember(user, guild);
            let role = guild.roles.filter(r => member.roles.includes(r.id)).sort((a,b) => b.position-a.position).find(r => r.color);
            return role ? role.color : 0;
        },
        // Given a userID or channelID, return its display name.
        nameOfChannel: function(input) {
            let channelObject = bf.channelObject(input);
            let userObject = bf.userObject(input);
            if (channelObject) {
                if (bf.isDMChannel(channelObject)) {
                    return "@"+input.recipient.username;
                } else {
                    return "#"+input.name;
                }
            } else if (userObject) {
                return "@"+userObject.username;
            } else if (!input) {
                return "unknown channel";
            } else {
                console.log(input);
                console.log(typeof(input));
                throw "Unknown format for channel; cannot get name";
            }
        },
        // Fix emojis so they can be used by Eris.
        fixEmoji: function(input) {
            if (typeof(input) == "object") {
                if (input.id) {
                    return input.name+":"+input.id;
                } else {
                    return input.name;
                }
            } else if (typeof(input) == "string") {
                let ceregex = /^<a?:([a-zA-Z0-9_-]{2,32}):([0-9]+)>$/;
                let match = input.match(ceregex);
                if (match) {
                    return match[1]+":"+match[2];
                } else {
                    return input;
                }
            } else {
                console.log(input);
                console.log(typeof(input));
                throw "Unknown format for emoji; cannot convert";
            }
        },
        addTemporaryListener: function(target, name, filename, code) {
            target.on(name, code);
            reloadEvent.once(filename, () => {
                target.removeListener(name, code);
            });
        },
        // Get a message from a channel.
        getMessage: function(channel, messageID, callback) {
            if (!callback) callback = new Function();
            if (typeof(messageID) == "object") {
                return Promise.resolve(messageID)
            } else {
                channel = bf.channelObject(channel);
                let cheat = channel.messages.get(messageID);
                if (cheat) {
                    callback(null, cheat);
                    return Promise.resolve(cheat);
                } else {
                    return bot.getMessage(channel.id, messageID)
                    .then(messageObject => {
                        channel.messages.add(messageObject, undefined, true);
                        callback(null, messageObject);
                        return messageObject;
                    });
                }
            }
        },
        // Send a message to a channel.
        sendMessage: function(channel, content, c, a) {
            if (!content) content = "";
            let {callback, additional} = fixCAArgs({c, a});
            return new Promise(resolve => {
                if (additional.mention) {
                    let mention = bf.userObject(additional.mention);
                    db.get("SELECT mention FROM Users WHERE userID = ?", mention.id, function(err, dbr) {
                        if (dbr && dbr.mention == 1) {
                            content = mention.mention+" "+content;
                        }
                        delete additional.mention;
                        resolve();
                    });
                } else resolve();
            })
            .then(() => bf.resolveChannel(channel))
            .then(channel => {
                return channel.createMessage(createSendableObject(content, additional))
                .then(messageObject => {
                    cf.log(`Sent a message (${messageObject.id}) to ${bf.nameOfChannel(channel)} (${channel.id}):\n${messageObject.content}`, "spam");
                    bot.getChannel(channel.id).messages.add(messageObject, undefined, true);
                    if (additional.legacy) callback(null, messageObject.id, messageObject);
                    else callback(null, messageObject);
                    return messageObject;
                })
                .catch(err => {
                    callback(err);
                    switch (err.code) {
                    default:
                        throw err;
                    }
                });
            });
        },
        // Edit a message sent by the bot.
        editMessage: function() {
            return bf.withOptionalChannel(arguments)
            .then(([channel, message, z, c, a]) => {
                let {callback, additional} = fixCAArgs({c, a});
                content = createSendableObject(content, additional);
                let promise;
                if (channel) {
                    if (typeof(message) == "object") message = message.id;
                    promise = bot.editMessage(channel.id, message, content);
                } else {
                    promise = message.edit(content);
                }
                promise.then(messageObject => callback(null, messageObject));
                promise.catch(err => {
                    callback(err);
                    switch (err.code) {
                    default:
                        throw err;
                    }
                });
                return promise;
            });
        },
        // React to a message.
        addReaction: function() {
            return bf.withOptionalChannel(arguments)
            .then(([channel, message, reaction, callback]) => {
                if (!callback) callback = new Function();
                reaction = bf.fixEmoji(reaction);
                let promise;
                if (channel) {
                    if (typeof(message) == "object") message = message.id;
                    promise = bot.addMessageReaction(channel.id, message, reaction);
                } else {
                    if (message.reactions[reaction] && message.reactions[reaction].me) {
                        promise = Promise.resolve();
                    } else {
                        promise = message.addReaction(reaction);
                    }
                }
                promise.then(() => {
                    callback(null);
                    if (typeof(message) == "object") channel = message.channel;
                    cf.log(`Added the reaction ${reaction} to a message (${message}) in ${bf.nameOfChannel(channel)} (${channel.id})`, "spam");
                });
                promise.catch(err => {
                    callback(err);
                    switch (err.code) {
                    case 10014:
                        cf.log(`Unknown emoji ${reaction} when adding reaction to a message ${message} in ${bf.nameOfChannel(channel)} (${channel.id})`, "error");
                        break;
                    default:
                        throw err;
                    }
                });
                return promise;
            });
        },
        // Add multiple reactions to a message, in order.
        addReactions: function() {
            return bf.withOptionalChannel(arguments)
            .then(([channel, message, reactions, callback]) => new Promise(resolve => {
                if (!callback) callback = new Function();
                (function addNextReaction() {
                    bf.addReaction(channel, message, reactions[0]).then(() => {
                        reactions.shift();
                        if (reactions[0]) addNextReaction();
                        else {
                            callback(null);
                            resolve();
                        }
                    }).catch(err => {
                        callback(err);
                        throw err;
                    });
                })();
            }));
        },
        // Remove a reaction from a message.
        removeReaction: function() {
            return bf.withOptionalChannel(arguments)
            .then(([channel, message, reaction, user, callback]) => {
                user = user ? bf.userObject(user).id : undefined;
                if (!callback) callback = new Function();
                reaction = bf.fixEmoji(reaction);
                let promise;
                if (channel) {
                    if (typeof(message) == "object") message = message.id;
                    promise = bot.removeMessageReaction(channel.id, message, reaction, user);
                } else {
                    promise = message.removeReaction(reaction, user);
                }
                promise.then(() => {
                    callback(null);
                    if (typeof(message) == "object") channel = message.channel;
                    cf.log(`Removed the reaction ${reaction} from a message (${message}) in ${bf.nameOfChannel(channel)} (${channel.id})`, "spam");
                });
                promise.catch(err => {
                    callback(err);
                    switch (err.code) {
                    case 10014:
                        cf.log(`Unknown emoji ${reaction} when removing reaction from ${message} in ${bf.nameOfChannel(channel)} (${channel.id})`, "error");
                        break;
                    default:
                        throw err;
                    }
                });
                return promise;
            });
        },
        // Remove multiple reactions from a message.
        removeReactions: function() {
            return bf.withOptionalChannel(arguments)
            .then(([channel, message, reactions, users, callback]) => {
                if (reactions) reactions = reactions.map(r => bf.fixEmoji(r));
                if (!callback) callback = new Function();
                if (users) users = users.map(u => bf.userObject(u).id);
                return new Promise(resolve => {
                    if (typeof(message) == "object") resolve(message);
                    else bf.getMessage(channel, message).then(resolve);
                }).then(message => {
                    // Now we are guaranteed to have a message object as efficiently as possible.
                    let todo = [];
                    Object.keys(message.reactions).filter(r => !reactions || reactions.includes(r)).forEach(r => {
                        message.getReaction(r).then(reacters => reacters.forEach(u => {
                            if (!users || users.includes(u.id)) todo.push(message.removeReaction(r, u.id));
                        }));
                    });
                    return Promise.all(todo).then(() => {
                        callback();
                    });
                });
            });
        },
        // Create a reaction menu
        reactionMenu: function() {
            return bf.withOptionalChannel(arguments)
            .then(([channel, message, actions, callback]) => {
                if (!callback) callback = new Function();
                actions = actions.map(a => {
                    a.emoji = bf.fixEmoji(a.emoji);
                    if (a.allowedUsers) a.allowedUsers = a.allowedUsers.map(u => bf.userObject(u).id);
                    return a;
                });
                return new Promise(resolve => {
                    if (typeof(message) == "object") resolve(message);
                    else if (channel && typeof(message) == "string" && message.match(/^[0-9]{16,}$/)) {
                        resolve(message);
                    } else if (channel && typeof(message) == "string") {
                        bf.sendMessage(channel, message).then(resolve);
                    }
                }).then(message => {
                    let messageID = (typeof(message) == "string" ? message : message.id);
                    let channelID = (typeof(message) == "object" ? message.channel.id : channel.id);
                    bf.getMessage(channel, message).then(msg => callback(null, msg));
                    let promise;
                    if (channel) {
                        promise = bf.addReactions(channel, message, actions.map(a => a.emoji));
                    } else {
                        promise = bf.addReactions(message, actions.map(a => a.emoji));
                    }
                    reactionMenus[messageID] = {actions, channelID};
                    cf.log(reactionMenus, "warning");
                    promise.then(() => {
                        callback(null);
                    });
                    promise.catch(() => {
                        delete reactionMenus[messageID];
                    });
                    return promise;
                });
            });
        },
        // Create a message menu
        messageMenu: function() {
            return bf.withOptionalChannel(arguments)
            .then(([channel, message, user, pattern, action, callback]) => {
                if (!callback) callback = new Function();
                if (!pattern) pattern = /.*/;
                return new Promise(resolve => {
                    if (typeof(message) == "object") resolve(message);
                    else if (channel && typeof(message) == "string" && message.match(/^[0-9]{16,}$/)) {
                        resolve(message);
                    } else if (channel && typeof(message) == "string") {
                        bf.sendMessage(channel, message).then(resolve);
                    }
                }).then(message => {
                    let messageID = (typeof(message) == "string" ? message : message.id);
                    let channelID = (typeof(message) == "object" ? message.channel.id : channel.id);
                    let userID = bf.userObject(user).id;
                    messageMenus = messageMenus.filter(m => !(m.channelID == channelID && m.messageID == messageID));
                    messageMenus.push({channelID, userID, pattern, action});
                    callback(null);
                });
            });
        }
    }

    bf.addTemporaryListener(bot, "messageReactionAdd", __filename, (msg, emoji, user) => {
        user = bf.userObject(user);
        emoji = bf.fixEmoji(emoji);
        if (user.id == bot.user.id) return;
        let menu = reactionMenus[msg.id];
        if (!menu) return;
        let action = menu.actions.find(a => a.emoji == emoji);
        if (!action) return;
        if (action.allowedUsers && !action.allowedUsers.includes(user.id)) {
            if (action.remove == "user") bf.removeReaction(msg, emoji, user);
            return;
        }
        switch (action.actionType) {
        case "reply":
            bf.sendMessage(msg.channel, action.actionData, {mention: user});
            break;
        case "edit":
            bf.editMessage(msg, action.actionData);
            break;
        case "legacy":
            action.actionData({d: msg}, reactionMenus);
            break;
        case "js":
            action.actionData(msg, reactionMenus);
            break;
        }
        switch (action.ignore) {
        case "that":
            menu.actions.find(a => a.emoji == emoji).actionType = "none";
            break;
        case "thatTotal":
            menu.actions = menu.actions.filter(a => a.emoji != emoji);
            break;
        case "all":
            menu.actions.forEach(a => a.actionType = "none");
            break;
        case "total":
            delete reactionMenus[msg.id];
            break;
        }
        switch (action.remove) {
        case "user":
            bf.removeReaction(msg, emoji, user);
            break;
        case "bot":
            bf.removeReaction(msg, emoji, bot.user);
            break;
        case "that":
            bf.removeReactions(msg, [emoji]);
            break;
        case "all":
            msg.removeReactions();
            break;
        case "message":
            delete reactionMenus[msg.id];
            msg.delete();
            break;
        }
        //cf.log("New reaction on reaction menu: "+emoji, "warning");
    });
    bf.addTemporaryListener(bot, "messageCreate", __filename, msg => {
        function isDesiredMenu(m) {
            return m.channelID == msg.channel.id && m.userID == msg.author.id;
        }
        let menu = messageMenus.find(m => isDesiredMenu(m) && msg.content.match(m.pattern));
        if (menu) {
            menu.action(msg);
            messageMenus = messageMenus.filter(m => !isDesiredMenu(m));
        }
    });

    return bf;
};