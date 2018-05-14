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
                        bf.editChannelPermissions(row.channelID, row.userID, {default: [Discord.Constants.Permissions.readMessages]}).then(() => {
                            bf.sendMessage(row.userID, "The timed lock on the channel **"+bf.nameOfChannel(row.channelID)+"** has been removed.");
                            ldb.run("DELETE FROM Lock WHERE userID=? AND channelID=?", [row.userID, row.channelID]);
                        }).catch(err => {
                            bf.sendMessage(row.userID, "Error: I couldn't remove the timed lock on the channel **"+bf.nameOfChannel(row.channelID)+"**.\n`"+JSON.stringify(err)+"`");
                            return;
                        });
                    });
                }, row.time-Date.now()));
            });
        });
    }
    bf.onBotConnect(manageTimedChannels);
    let availableFunctions = {
        lock: {
            aliases: ["lock"],
            shortHelp: "Lock yourself out of a channel",
            reference: "[+lock|-lock] [list] [*#channel*] [time=*minutes*] [+sure] [+force]",
            longHelp: "",
            eris: true,
            hidden: true,
            code: function(msg, command) {
                if (!["176580265294954507", "113457314106740736"].includes(msg.author.id)) {
                    bf.sendMessage(msg.channel, "This command has not been enabled for you.", {mention: msg.author});
                }
                let channels = msg.channel.guild.channels;
                if (command.regularWords[0] == "alias") {
                    let targets = command.regularWords.map(w => w.match(/<#([0-9]{16,})>/)).filter(w => w).map(w => w[1]);
                    if (!command.regularWords[1] || !command.regularWords[1].match(/^[a-zA-Z0-9]+$/)) {
                        bf.sendMessage(msg.channel, "Error! After the word `alias`, put the name of the new alias.");
                        return;
                    }
                    if (!targets.length) {
                        ldb.get("SELECT * FROM Alias WHERE userID=? AND name=?", [msg.author.id, command.regularWords[1]], (err, dbr) => {
                            if (dbr) {
                                bf.sendMessage(msg.channel, "Viewing alias "+command.regularWords[1]+":\n"+dbr.channels.split(",").map(c => "<#"+c+">").join("\n"));
                            } else {
                                bf.sendMessage(msg.channel, "Error: That alias has not been created, and so information about it cannot be displayed.");
                            }
                        });
                        return;
                    }
                    new Promise(resolve => {
                        ldb.get("SELECT * FROM Alias WHERE userID=? AND name=?", [msg.author.id, command.regularWords[1]], (err, dbr) => {
                            if (dbr) {
                                ldb.run("UPDATE Alias SET channels=? WHERE userID=? AND name=?", [targets.join(","), msg.author.id, command.regularWords[1]], resolve);
                            } else {
                                ldb.run("INSERT INTO Alias VALUES (?, ?, ?)", [msg.author.id, command.regularWords[1], targets.join(",")], resolve);
                            }
                        });
                    }).then((err) => {
                        if (!err) bf.addReaction(msg, "✅");
                    });
                } else if (command.regularWords[0] == "list") {
                    let target = (msg.mentions[0] ? msg.mentions[0].id : msg.author.id);
                    ldb.all("SELECT * FROM Lock WHERE userID=?", target, (err, dbr) => {
                        if (dbr.filter(r => channels.get(r.channelID)).length) {
                            bf.sendMessage(msg.channel, "**"+bf.userToNick(target, bot.channelGuildMap[msg.channel.id], "nickname")+"'s locked channels**\n"+channels.filter(c => c.type == 0 && dbr.find(r => r.channelID == c.id)).sort((a,b) => a.position-b.position).map(c => bf.nameOfChannel(c)).join("\n"));
                        } else {
                            bf.sendMessage(msg.channel, bf.userToNick(target, bot.channelGuildMap[msg.channel.id], "nickname")+" has not locked any channels.");
                        }
                    });
                } else {
                    let targets = [msg.channel.id]; // The channel to lock
                    let channelMention = command.regularWords.map(w => w.match(/<#([0-9]{16,})>/)).filter(w => w).map(w => w[1]);
                    command.regularWords.filter(w => w.match(/^`?#[a-z-]+`?$/)).forEach(w => {
                        w = w.replace("#", "").replace(/`/g, "");
                        let found = channels.find(c => c.name == w && c.type == 0);
                        if (w && found) channelMention.push(found);
                    });
                    if (channelMention.length) targets = channelMention;
                    new Promise(resolve => {
                        if (command.regularWords[0] && command.regularWords[0].match(/^[a-zA-Z0-9]+$/)) {
                            cf.log("Checking alias "+command.regularWords[0], "info");
                            ldb.get("SELECT * FROM Alias WHERE userID=? AND name=?", [msg.author.id, command.regularWords[0]], (err, dbr) => {
                                if (dbr) {
                                    targets = dbr.channels.split(",");
                                    cf.log("Alias matched channels "+cf.listify(targets), "info");
                                }
                                resolve();
                            });
                        } else resolve();
                    }).then(() => {
                        if (command.regularWords[0] == "all") targets = msg.channel.guild.channels.filter(c => c.type == 0).map(c => c.id);
                        let permissions = {};
                        if (command.flags.on.includes("lock")) {
                            permissions = {deny: Discord.Constants.Permissions.readMessages};
                        } else if (command.flags.off.includes("lock")) {
                            permissions = {default: Discord.Constants.Permissions.readMessages};
                        } else {
                            bf.sendMessage(msg.channel, "Error: you must use either `+lock` to lock a channel or `-lock` to unlock a channel.");
                            return;
                        }
                        command.switches.time = Number(command.switches.time);
                        if (!command.switches.time) command.switches.time = null;
                        ldb.all("SELECT * FROM Lock WHERE userID=? AND channelID IN ("+"?".repeat(targets.length).split("").join(",")+")", [msg.author.id].concat(targets), (err, dbr) => {
                            if (permissions.default && !command.flags.on.includes("force")) {
                                targets = targets.filter(c => dbr.map(r => r.channelID).includes(c));
                            }
                            if (permissions.deny && !command.flags.on.includes("force")) {
                                targets = targets.filter(c => !dbr.map(r => r.channelID).includes(c));
                            }
                            if (targets.length == 0) {
                                bf.sendMessage(msg.channel, "That command will have no effect.");
                                return;
                            }
                            if (dbr.some(r => r.sure)) {
                                bf.sendMessage(msg.channel, "You have requested that the lock on that channel should be irrevocable. Therefore, it will not be modified.", {mention: msg.author.id});
                                return;
                            }
                            cf.log(targets, "warning");
                            con();
                            function con() {
                                let target = targets.pop();
                                cf.log(permissions, "warning");
                                bf.editChannelPermissions(target, msg.author.id, permissions).then(() => {
                                    if (err) {
                                        bf.sendMessage(channelID, "Error: I couldn't edit that channel. `"+target+"`/`"+Object.keys(permissions)+"`\n`"+JSON.stringify(err)+"`");
                                        return;
                                    }
                                    new Promise((resolve, reject) => { // If a database entry exists, delete it
                                        if (dbr) ldb.run("DELETE FROM Lock WHERE userID=? AND channelID=?", [msg.author.id, target], resolve);
                                        else resolve();
                                    }).then(() => {
                                        new Promise((resolve, reject) => { // If this channel is now locked, add a database entry
                                            if (permissions.deny) ldb.run("INSERT INTO Lock VALUES (?, ?, ?, ?)", [msg.author.id, target, (command.switches.time ? Date.now()+command.switches.time*1000*60 : null), command.flags.on.includes("sure")], resolve);
                                            else resolve();
                                        }).then(() => {
                                            if (targets.length == 0) bf.addReaction(msg, "✅");
                                            if (Number(command.switches.time)) {
                                                timers.push(setTimeout(() => {
                                                    ldb.get("SELECT * FROM Lock WHERE userID=? AND channelID=?", [msg.author.id, target], (err, test) => {
                                                        if (!test) return;
                                                        bf.editChannelPermissions(target, msg.author.id, {default: Discord.Constants.Permissions.readMessages}).then(() => {
                                                            if (err) {
                                                                bf.sendMessage(msg.author, "Error: I couldn't remove the timed lock on the channel **"+bf.nameOfChannel(target)+"**.\n`"+JSON.stringify(err)+"`");
                                                                return;
                                                            }
                                                            bf.sendMessage(msg.author, "The timed lock on the channel **"+bf.nameOfChannel(target)+"** has been removed.");
                                                            ldb.run("DELETE FROM Lock WHERE userID=? AND channelID=?", [msg.author.id, target]);
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
