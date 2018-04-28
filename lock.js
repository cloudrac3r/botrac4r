module.exports = function(input) {
    let {Discord, bot, cf, bf, db, reloadEvent} = input;
    let sqlite = require("sqlite3");
    let ldb = new sqlite.Database(__dirname+"/lock.db");
    let timers = [];
    reloadEvent.once(__filename, () => {
        timers.forEach(t => clearTimeout(t));
    });
    function manageTimedChannels() {
        ldb.all("SELECT * FROM Lock WHERE until IS NOT NULL", (err, dbr) => {
            dbr.forEach(row => {
                timers.push(setTimeout(() => {
                    ldb.get("SELECT * FROM Lock WHERE userID=? AND channelID=?", [row.userID, row.channelID], (err, test) => {
                        if (!test) return;
                        bot.editChannelPermissions({channelID: row.channelID, userID: row.userID, default: [Discord.Permissions.TEXT_READ_MESSAGES]}, (err) => {
                            if (err) {
                                bf.sendMessage(row.userID, "Error: I couldn't remove the timed lock on the channel **#"+bot.channels.get(row.channelID).name+"**.\n`"+JSON.stringify(err)+"`");
                                return;
                            }
                            bf.sendMessage(row.userID, "The timed lock on the channel **#"+bot.channels.get(row.channelID).name+"** has been removed.");
                            ldb.run("DELETE FROM Lock WHERE userID=? AND channelID=?", [row.userID, row.channelID]);
                        });
                    });
                }, row.time-Date.now()));
            });
        });
    }
    if (bot.connected) manageTimedChannels();
    else bot.once("ready", manageTimedChannels);
    let availableFunctions = {
        lock: {
            aliases: ["lock"],
            shortHelp: "Lock yourself out of a channel.",
            reference: "[+lock|-lock] [list] [*#channel*] [time=*minutes*] [+sure] [+force]",
            longHelp: "",
            code: function(userID, channelID, command, d) {
                if (!["176580265294954507", "113457314106740736"].includes(userID)) {
                    bf.sendMessage(channelID, "Error: This command has not been enabled for you.");
                }
                if (command.regularWords[0] == "alias") {
                    let targets = command.regularWords.map(w => w.match(/<#([0-9]{16,})>/)).filter(w => w).map(w => w[1]);
                    if (!command.regularWords[1] || !command.regularWords[1].match(/^[a-zA-Z0-9]+$/)) {
                        bf.sendMessage(channelID, "Error! After the word `alias`, put the name of the new alias.");
                        return;
                    }
                    if (!targets.length) {
                        ldb.get("SELECT * FROM Alias WHERE userID=? AND name=?", [userID, command.regularWords[1]], (err, dbr) => {
                            if (dbr) {
                                bf.sendMessage(channelID, "Viewing alias "+command.regularWords[1]+":\n"+dbr.channels.split(",").map(c => "<#"+c+">").join("\n"));
                            } else {
                                bf.sendMessage(channelID, "Error: That alias has not been created, and so information about it cannot be displayed.");
                            }
                        });
                        return;
                    }
                    new Promise((resolve, reject) => {
                        ldb.get("SELECT * FROM Alias WHERE userID=? AND name=?", [userID, command.regularWords[1]], (err, dbr) => {
                            if (dbr) {
                                ldb.run("UPDATE Alias SET channels=? WHERE userID=? AND name=?", [targets.join(","), userID, command.regularWords[1]], resolve);
                            } else {
                                ldb.run("INSERT INTO Alias VALUES (?, ?, ?)", [userID, command.regularWords[1], targets.join(",")], resolve);
                            }
                        });
                    }).then((err) => {
                        if (!err) bf.addReaction(channelID, d.id, "✅");
                    });
                } else if (command.regularWords[0] == "list") {
                    let target = (d.mentions[0] ? d.mentions[0].id : userID);
                    let channels = bot.servers.get(bot.channels.get(channelID).guild_id).channels;
                    ldb.all("SELECT * FROM Lock WHERE userID=?", target, (err, dbr) => {
                        if (dbr.filter(r => Object.keys(channels).includes(r.channelID)).length) {
                            bf.sendMessage(channelID, "**"+bf.userIDToNick(target, bot.channels.get(channelID).guild_id, "nickname")+"'s locked channels**\n"+Object.keys(channels).filter(c => channels[c].type == 0 && dbr.find(r => r.channelID == c)).sort((a,b) => channels[a].position-channels[b].position).map(c => "#"+channels[c].name).join("\n"));
                        } else {
                            bf.sendMessage(channelID, bf.userIDToNick(target, bot.channels.get(channelID).guild_id, "nickname")+" has not locked any channels.");
                        }
                    });
                } else {
                    let channels = bot.servers.get(bot.channels.get(channelID).guild_id).channels;
                    let targets = [channelID]; // The channel to lock
                    let channelMention = command.regularWords.map(w => w.match(/<#([0-9]{16,})>/)).filter(w => w).map(w => w[1]);
                    command.regularWords.filter(w => w.match(/^`?#[a-z-]+`?$/)).forEach(w => {
                        w = w.replace("#", "").replace(/`/g, "");
                        let found = Object.keys(channels).find(c => channels[c].name == w && channels[c].type == 0);
                        if (w && found) channelMention.push(found);
                    });
                    if (channelMention.length) targets = channelMention;
                    new Promise((resolve, reject) => {
                        if (command.regularWords[0] && command.regularWords[0].match(/^[a-zA-Z0-9]+$/)) {
                            cf.log("Checking alias "+command.regularWords[0], "info");
                            ldb.get("SELECT * FROM Alias WHERE userID=? AND name=?", [userID, command.regularWords[0]], (err, dbr) => {
                                if (dbr) {
                                    targets = dbr.channels.split(",");
                                    cf.log("Alias matched channels "+cf.listify(targets), "info");
                                }
                                resolve();
                            });
                        } else resolve();
                    }).then(() => {
                        if (command.regularWords[0] == "all") targets = Object.keys(bot.servers.get(bot.channels.get(channelID).name).channels).filter(c => bot.servers.get(bot.channels.get(channelID).name).channels[c].type == "text");
                        let permissions = {deny: [], default: []};
                        if (command.flags.on.includes("lock")) {
                            permissions = {deny: [Discord.Permissions.TEXT_READ_MESSAGES]};
                        } else if (command.flags.off.includes("lock")) {
                            permissions = {default: [Discord.Permissions.TEXT_READ_MESSAGES]};
                        } else {
                            bf.sendMessage(channelID, "Error: you must use either `+lock` to lock a channel or `-lock` to unlock a channel.");
                            return;
                        }
                        command.switches.time = Number(command.switches.time);
                        if (!command.switches.time) command.switches.time = null;
                        ldb.all("SELECT * FROM Lock WHERE userID=? AND channelID IN ("+"?".repeat(targets.length).split("").join(",")+")", [userID].concat(targets), (err, dbr) => {
                            if (permissions.default && !command.flags.on.includes("force")) {
                                targets = targets.filter(c => dbr.map(r => r.channelID).includes(c));
                            }
                            if (permissions.deny && !command.flags.on.includes("force")) {
                                targets = targets.filter(c => !dbr.map(r => r.channelID).includes(c));
                            }
                            if (targets.length == 0) {
                                bf.sendMessage(channelID, "That command will have no effect.");
                                return;
                            }
                            if (dbr.some(r => r.sure)) {
                                bf.sendMessage(channelID, "You have requested that the lock on that channel should be irrevocable. Therefore, it will not be modified.");
                                return;
                            }
                            cf.log(targets, "warning");
                            con();
                            function con() {
                                let target = targets.pop();
                                bot.editChannelPermissions(Object.assign({channelID: target, userID: userID}, permissions), (err) => {
                                    if (err) {
                                        bf.sendMessage(channelID, "Error: I couldn't edit that channel. `"+target+"`/`"+Object.keys(permissions)+"`\n`"+JSON.stringify(err)+"`");
                                        return;
                                    }
                                    new Promise((resolve, reject) => { // If a database entry exists, delete it
                                        if (dbr) ldb.run("DELETE FROM Lock WHERE userID=? AND channelID=?", [userID, target], resolve);
                                        else resolve();
                                    }).then(() => {
                                        new Promise((resolve, reject) => { // If this channel is now locked, add a database entry
                                            if (permissions.deny) ldb.run("INSERT INTO Lock VALUES (?, ?, ?, ?)", [userID, target, (command.switches.time ? Date.now()+command.switches.time*1000*60 : null), command.flags.on.includes("sure")], resolve);
                                            else resolve();
                                        }).then(() => {
                                            if (targets.length == 0) bf.addReaction(channelID, d.id, "✅");
                                            if (Number(command.switches.time)) {
                                                timers.push(setTimeout(() => {
                                                    ldb.get("SELECT * FROM Lock WHERE userID=? AND channelID=?", [userID, target], (err, test) => {
                                                        if (!test) return;
                                                        bot.editChannelPermissions({channelID: target, userID: userID, default: [Discord.Permissions.TEXT_READ_MESSAGES]}, (err) => {
                                                            if (err) {
                                                                bf.sendMessage(userID, "Error: I couldn't remove the timed lock on the channel **#"+bot.channels.get(target).name+"**.\n`"+JSON.stringify(err)+"`");
                                                                return;
                                                            }
                                                            bf.sendMessage(userID, "The timed lock on the channel **#"+bot.channels.get(target).name+"** has been removed.");
                                                            ldb.run("DELETE FROM Lock WHERE userID=? AND channelID=?", [userID, target]);
                                                        });
                                                    });
                                                }, command.switches.time*1000*60));
                                            }
                                            if (targets.length) con();
                                        });
                                    });
                                });
                            }
                        });
                    });
                }
            }
        }
    };
    return availableFunctions;
}
