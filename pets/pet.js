module.exports = function(input) {
    let {bot, cf, bf, db, reloadEvent} = input;
    let sqlite = require("sqlite3");
    let petdb = new sqlite.Database(__dirname+"/pet.db");
    // Consts
    const petIDs = {
        channel: "387802247926513687",
        glanceDisplay: "387810251824693249",
        shop: "387859510540107776"
    };
    const maxStat = 20;

    // Globals
    let lastRestartFooter = new Date();
    let messageEditQueue = []; // {messageID: "", embed: {}, priority: 0, callback: Function}
    let messageEditQueueEmptying = 0;
    let users = [];

    // Classes
    class Pet {
        constructor(name, owner, callback) {
            this.id = Date.now().toString();
            this.name = name;
            this.hp = 20;
            this.fed = 20;
            this.age = 0;
            owner.pets.push(this);
            if (callback) petdb.run("INSERT INTO Pets VALUES (?,?,?,?,?)", [this.id, this.name, this.hp, this.fed, this.age], callback);
        }
        save(callback) {
            if (!callback) callback = new Function();
            petdb.run("UPDATE Pets SET name=?,hp=?,fed=?,age=? WHERE id=?", [this.name, this.hp, this.fed, this.age, this.id], callback);
        }
        statsToDisplay() {
            return valueToMeter(cf.map(this.statsToHappiness(), 0, maxStat, 0, 9))+valueToMeter(cf.map(this.fed, 0, maxStat, 0, 9));
        }
        statsToHappiness() {
            return cf.map(Math.min(this.hp, this.fed*0.7+maxStat*0.3), 0, maxStat, 0, 20);
        }
    }
    class User {
        constructor(userID, callback) {
            this.userID = userID;
            this.pets = [];
            this.paused = false;
            users.push(this);
            if (callback) petdb.run("INSERT INTO Users VALUES (?,'')", [this.userID], callback);
        }
        save(callback) {
            if (!callback) callback = new Function();
            petdb.run("UPDATE Users SET pets=? WHERE userID=?", [this.pets.map(p => p.id).join(","), this.userID]);
        }
    }

    // General functions
    function loadData(callback) {
        if (!callback) callback = new Function();
        petdb.all("SELECT * FROM Users", function(err,udbr) {
            petdb.all("SELECT * FROM Pets", function(err,pdbr) {
                udbr.forEach(u => {
                    let newUser = new User(u.userID);
                    pdbr.filter(p => u.pets.split(",").includes(p.id)).forEach(p => {
                        let newPet = new Pet(p.name, newUser);
                        Object.assign(newPet, p);
                    });
                });
                //cf.log(users);
                callback();
            });
        });
    }
    function smartEditMessage(messageID, embed, priority, callback) {
        // Priorities — 0: menu, 1: interactive update, 2: interval update
        if (!callback) callback = new Function();
        messageEditQueue.push({channelID: petIDs.channelID, messageID: messageID, embed: embed, priority: priority, callback: callback});
        emptyQueue();
        function emptyQueue() {
            if (!messageEditQueueEmptying) {
                let messageIDs = [];
                messageEditQueue = messageEditQueue.filter((m,i) => !messageEditQueue.slice(i+1).some(n => n.messageID == m.messageID));
                //cf.log(messageEditQueue, "warning");
                messageEditQueue.sort((a,b) => (b.priority-a.priority)).forEach(m => {
                    messageEditQueueEmptying++;
                    bot.editMessage({channelID: petIDs.channel, messageID: m.messageID, embed: m.embed}, function(err) {
                        messageEditQueueEmptying--;
                        if (!err) {
                            messageEditQueue = messageEditQueue.filter(n => n.messageID != m.messageID);
                            callback(null);
                        } else if (err.response && err.response.message == "You are being rate limited") {
                            setTimeout(function() {
                                cf.log("Pet rate-limit hit, priority "+priority, (priority < 1 ? "error" : "info"));
                                emptyQueue();
                            }, err.response.retry_after);
                        } else {
                            cf.log(err, "error");
                            //emptyQueue();
                        }
                    });
                });
            }
        }
    }
    function valueToMeter(value, notFound) {
        value = Math.floor(Math.min(Math.max(Number(value), 0), 49));
        let emojiName = "lv"+value.toString()
        let emojiServer = bot.servers["364914967775805440"];
        if (!emojiName || !emojiServer) {
            return notFound;
        } else {
            return "<:"+emojiName+":"+Object.keys(emojiServer.emojis).find(e => emojiServer.emojis[e].name == emojiName)+">";
        }
    }

    // Specific functions
    function updateGlanceDisplay(priority) {
        if (!priority) priority = 2;
        let embed = {
            title: "Pets at a glance",
            footer: {
                text: "Last code update "+Math.floor((Date.now()-lastRestartFooter.getTime())/1000)+" seconds ago"
            },
            timestamp: lastRestartFooter.toJSON()
        };
        embed.fields = users.map(u => ({
            name: bf.userIDToEmoji(u.userID)+" "+bot.users[u.userID].username+" ("+u.pets.length+")",
            value: "​"+u.pets.map(p => ` ${p.statsToDisplay()} | ${p.name}`).join("\n"), //SC: U+200B zero-width space, U+2004 three-per-em space
            inline: true
        }));
        smartEditMessage(petIDs.glanceDisplay, embed, 2);
    }

    // Real code
    function realCode() {
        updateGlanceDisplay(1);
        let updateGlanceDisplayInterval = setInterval(function() {
            try {
                updateGlanceDisplay();
            } catch (e) {
                cf.log(e, "error");
            }
        }, 2000);
        reloadEvent.once(__filename, function() {
            clearInterval(updateGlanceDisplayInterval);
        });
        bf.reactionMenu(petIDs.channel, petIDs.shop, [
            {emoji: bf.buttons["plus"], remove: "user", actionType: "js", actionData: function(event) {
                bot.createDMChannel(event.d.user_id, function(err, res) {
                    let channelID = res.id;
                    let messageMenuValid = true;
                    bf.messageMenu(channelID, "What would you like to name the new pet? Press "+bf.buttons["times"]+" to cancel.", event.d.user_id, /^[^\n]*$/, function(message) {
                        if (messageMenuValid) {
                            let userObject = users.find(u => u.userID == event.d.user_id);
                            new Promise((resolve, reject) => {
                                if (!userObject) {
                                    userObject = new User(event.d.user_id, () => {
                                        resolve();
                                    });
                                } else {
                                    resolve();
                                }
                            }).then(() => {
                                let name = message.toUpperCase().slice(0,1)+message.toLowerCase().slice(1);
                                let newPet = new Pet(name, userObject, () => {
                                    userObject.save();
                                    bf.sendMessage(channelID, "OK! You may now switch back to <#"+event.d.channel_id+">.");
                                    updateGlanceDisplay(1);
                                });
                            });
                        }
                    }, function(err, id) {
                        bf.reactionMenu(channelID, id, [
                            {emoji: bf.buttons["times"], remove: "message", ignore: "total", actionType: "js", actionData: () => messageMenuValid = false}
                        ]);
                    });
                });
            }}
        ]);
    }
    loadData(() => {
        if (bot.connected) {
            realCode();
        } else {
            bot.once("ready", realCode);
        }
    });

    // Available functions
    let availableFunctions = {
        pet: {
            aliases: ["pet", "pets"],
            shorthelp: "The official sequel to Hippo Clicker™",
            reference: "",
            longHelp: "",
            code: function(userID, channelID, command, d) {
            }
        }
    };
    return availableFunctions;
}