const events = require("events");
const userEmojiMessage = {channelID: "434994415342321674", messageID: "434994502848217099"};

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
            if (thing.constructor.name == "User" || thing.constructor.name == "Member") return thing;
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
                let ceregex = /^<:([a-zA-Z_-]{2,32}):([0-9]+)>$/;
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
        // Get a message from a channel.
        getMessage: function(channel, messageID, callback) {
            if (!callback) callback = new Function();
            channel = channelObject(channel);
            if (typeof(channelID) == "object") {
                messageID = channelID.messageID;
                channelID = channelID.channelID;
            }
            let cheat = bot.getChannel(channelID).messages.get(messageID);
            if (cheat) {
                callback(null, cheat);
                return new Promise(resolve => {
                    resolve(cheat);
                });
            } else {
                let promise = bot.getMessage(channelID, messageID);
                promise.then(messageObject => {
                    bot.getChannel(channelID).messages.add(messageObject, undefined, true);
                    callback(null, messageObject);
                });
                return promise;
            }
        },
        // Send a message to a channel.
        sendMessage: function(channel, message, c, a) {
            let {callback, additional} = fixCAArgs({c, a});
            return new Promise(resolve => {
                if (additional.mention) {
                    let mention = bf.userObject(additional.mention);
                    db.get("SELECT mention FROM Users WHERE userID = ?", mention.id, function(err, dbr) {
                        if (dbr && dbr.mention == 1) {
                            message = mention.mention+message;
                        }
                        delete additional.mention;
                        resolve();
                    });
                } else resolve();
            })
            .then(() => bf.resolveChannel(channel))
            .then(channel => {
                let content = additional;
                if (typeof(message) == "string") content.content = message;
                let promise = channel.createMessage(content);
                promise.then(messageObject => {
                    if (additional.legacy) callback(null, messageObject.id, messageObject);
                    else callback(null, messageObject);
                });
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
        // Edit a message sent by the bot.
        editMessage: function() {
            let args = [];
            Object.values(arguments).forEach(v => {
                args.push(v);
            });
            return bf.resolveChannel(args[0])
            .then(channel => {
                if (channel) args = args.slice(1);
                let [message, content, c, a] = args;
                let {callback, additional} = fixCAArgs({c, a});
                Object.assign(additional, {content});
                let promise;
                if (channel) {
                    if (typeof(message) == "object") message = message.id;
                    promise = bot.editMessage(channel.id, message, additional);
                } else {
                    promise = message.edit(additional);
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
            let args = [];
            Object.values(arguments).forEach(v => {
                args.push(v);
            });
            return bf.resolveChannel(args[0])
            .then(channel => {
                if (channel) args = args.slice(1);
                let [message, reaction, callback] = args;
                if (!callback) callback = new Function();
                reaction = bf.fixEmoji(reaction);
                let promise;
                if (channel) {
                    if (typeof(message) == "object") message = message.id;
                    promise = bot.addMessageReaction(channel.id, message, reaction);
                } else {
                    promise = message.addReaction(reaction);
                }
                promise.then(callback);
                promise.catch(err => {
                    callback(err);
                    switch (err.code) {
                    case 10014:
                        cf.log(`Unknown emoji ${reaction} when adding reaction to ${message} in ${bf.nameOfChannel(channel.id)}`, "error");
                        break;
                    default:
                        throw err;
                    }
                });
                return promise;
            });
        }
    }

    return bf;
};