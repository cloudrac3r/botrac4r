module.exports = function(input) {
    let {bot, cf, bf, db, reloadEvent} = input;
    let fs = require("fs");
    // Consts
    const petIDs = {
        channel: "387802247926513687",
        glanceDisplay: "397585416188067840",
        shop: "397585418830348299"
    };
    const maxStat = 20;

    // Globals
    let currentlySaving = 0;
    let lastRestartFooter = new Date();
    let lastSaveFooter = new Date();
    let messageEditQueue = []; // {messageID: "", embed: {}, priority: 0, callback: Function}
    let messageEditInProgress = [];
    let messageEditRateCap = 5;
    let messageEditRateRemaining = messageEditRateCap;
    let messageEditRateReset = 5100;
    let messageEditRateTimeout = {"_called": true};
    let users = [];

    // Classes
    class Pet {
        constructor(name, owner, callback) {
            this.id = Date.now().toString();
            this.name = name;
            this.hp = 20;
            this.fed = 20;
            this.age = 0;
            this.gender = (Math.random()<0.5 ? "male" : "female");
            owner.pets.push(this);
            if (callback) saveData(callback);
        }
        statsToDisplay() {
            return ` ${valueToMeter(cf.map(this.hp, 0, maxStat, 0, 9))} Health\n${valueToMeter(cf.map(this.statsToHappiness(), 0, maxStat, 0, 9))} Happiness\n${valueToMeter(cf.map(this.fed, 0, maxStat, 0, 9))} Fed`;
        }
        statsToHappiness() {
            return Math.min(this.hp, this.fed*0.7+maxStat*0.3);
        }
        statsToHappinessDisplay() {
            return valueToMeter(cf.map(this.statsToHappiness(), 0, maxStat, 0, 9));
        }
        getDisplayName() {
            return this.name+" "+genderToSymbol(this.gender);
        }
    }
    class User {
        constructor(userID, callback) {
            this.userID = userID;
            this.pets = [];
            this.paused = false;
            this.currentPetNumber = 0;
            this.menu = "";
            this.messageID = undefined;
            users.push(this);
            bot.getMessages({channelID: petIDs.channel}, (e,a) => {
                let m;
                try {
                    m = a.find(m => m.embeds && m.embeds.find(e => e.footer.text == this.userID));
                } catch (e) {};
                new Promise((resolve, reject) => {
                    if (!m) {
                        bf.sendMessage(petIDs.channel, bot.users[this.userID].username+" placeholder", (e,id) => {
                            this.messageID = id;
                            resolve();
                        });
                    } else {
                        this.messageID = m.id;
                        resolve();
                    }
                }).then(() => {
                    this.updateDisplay();
                    bf.reactionMenu(petIDs.channel, this.messageID, [
                        {emoji: bf.buttons["right"], remove: "user", actionType: "js", actionData: () => {
                            if (this.menu == "") {
                                this.selectNextPet();
                                this.updateDisplay();
                            }
                        }},
                        {emoji: bf.buttons["end"], remove: "user", allowedUsers: [this.userID], actionType: "js", actionData: () => {
                            if (this.menu) {
                                if (this.menu.includes(".")) this.menu = this.menu.split(".").slice(0, -1).join(".");
                                else this.menu = "";
                                this.updateDisplay();
                            }
                        }},
                        {emoji: bf.buttons["1"], remove: "user", allowedUsers: [this.userID], actionType: "js", actionData: () => {
                        }},
                        {emoji: bf.buttons["2"], remove: "user", allowedUsers: [this.userID], actionType: "js", actionData: () => {
                        }},
                        {emoji: bf.buttons["3"], remove: "user", allowedUsers: [this.userID], actionType: "js", actionData: () => {
                        }}
                    ]);
                    //TODO: action handler
                });
            });
            if (callback) saveData(callback);
        }
        currentPet() {
            return this.pets[this.currentPetNumber];
        }
        updateDisplay() {
            let fields = [];
            switch (this.menu) {
            default:
                bf.buttons["1"]+" Feed\n"+
                bf.buttons["2"]+" Shop"
            }
            smartEditMessage(this.messageID, {
                author: {
                    name: bot.users[this.userID].username,
                    icon_url: "https://cdn.discordapp.com/avatars/"+this.userID+"/"+bot.users[this.userID].avatar+".jpg"
                },
                title: this.currentPet().getDisplayName(),
                description: this.currentPet().statsToDisplay(),
                fields: fields,
                footer: {
                    text: this.userID
                }
            }, 1);
        }
        selectNextPet() {
            if (++this.currentPetNumber >= this.pets.length) this.currentPetNumber = 0;
        }
    }

    // General functions
    function genderToSymbol(gender) {
        switch (gender) {
        case "male":
            return "♂";
        case "female":
            return "♀";
        default:
            return "?";
        }
    }
    function loadData(callback) {
        if (!callback) callback = new Function();
        /*petdb.all("SELECT * FROM Users", function(err,udbr) {
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
        });*/
        fs.readFile(__dirname+"/pet.json", function(err,data) {
            let content = JSON.parse(data.toString());
            content.forEach(user => { // For each user
                let newUser = new User(user.userID); // Create a user
                user.pets.forEach(pet => { // For each old pet
                    let newPet = new Pet(pet.name, newUser); // Create a pet and register it to that user
                    Object.assign(newPet, pet); // Give the new pet all the stats of the old pet
                });
                delete user.pets; // Prevent old from overwriting new
                Object.assign(newUser, user);
            });
            callback();
        });
    }
    function saveData(callback) {
        if (!callback) callback = new Function();
        if (currentlySaving) {
            callback("Currently saving data, save cancelled.");
            return;
        } else {
            currentlySaving = 1;
            fs.writeFile(__dirname+"/pet.json~", JSON.stringify(users, null, 4), function(err) {
                if (err) {
                    currentlySaving = 0;
                    callback(err);
                } else {
                    fs.rename(__dirname+"/pet.json~", __dirname+"/pet.json", function(err) {
                        if (err) {
                            currentlySaving = 0;
                            callback(err);
                        } else {
                            currentlySaving = 0;
                            lastSaveFooter = new Date();
                            callback(null);
                        }
                    });
                }
            });
        }
    }
    function smartEditMessage(messageID, embed, priority, callback) {
        // Priorities — 0: menu, 1: interactive update, 2: interval update
        if (!callback) callback = new Function();
        if (!messageEditInProgress.some(message => message.messageID == messageID)) { // If same message is not currently being edited,
            messageEditQueue.unshift({channelID: petIDs.channelID, messageID: messageID, embed: embed, priority: priority, callback: callback}); // continue
        } else { // otherwise,
            cf.log("Already being edited", "info"); // stop
            return;
        }
        (function emptyQueue() {
            messageEditQueue = messageEditQueue.sort((a,b) => (a.priority-b.priority)) // Sort by important and remove duplicates
                                               .filter((m,i) => !messageEditQueue.slice(0, i).some(n => n.messageID == m.messageID));
            //cf.log(JSON.stringify(messageEditQueue, null, 4), "warning");
            messageEditQueue.forEach(message => { // For each message
                if (messageEditRateRemaining == 0) { // If rate limit exceeded
                    cf.log("Rate limit hit on "+message.messageID+", priority "+message.priority, "info");
                } else { // If rate limit not exceeded
                    //cf.log("About to edit     "+message.messageID+", priority "+message.priority, "info");
                    if (messageEditRateTimeout._called) { // If no reset timer is running
                        messageEditRateTimeout = setTimeout(resetLimit, messageEditRateReset); // Start the reset timer
                    }
                    messageEditRateRemaining--;
                    messageEditQueue = messageEditQueue.filter(m => m != message); // Remove from queue
                    messageEditInProgress.push(message); // Add to in progress
                    bot.editMessage({channelID: petIDs.channel, messageID: message.messageID, embed: message.embed}, function(err) { // Edit the message
                        messageEditInProgress = messageEditInProgress.filter(m => m != message); // No longer in progress
                        if (!err) { // No errors! Yay!
                            //cf.log("Edited message "+message.messageID+", priority "+message.priority, "spam");
                            callback(null);
                        } else if (err.response && err.response.message == "You are being rate limited.") { // Somehow rate limited anyway
                            cf.log("Somehow rate limited anyway", "warning");
                            messageEditQueue.unshift(message); // Add back to the queue
                            if (messageEditRateTimeout._called) { // If reset time is not already running
                                setTimeout(resetLimit, err.response.retry_after); // Start the reset timer
                            }
                        } else { // Other error
                            cf.log(err, "error");
                        }
                    });
                }
            });
            function resetLimit() { // Reset rate limit counters
                messageEditRateRemaining = messageEditRateCap; // The counter
                if (messageEditQueue.length) emptyQueue(); // If messages are queued, they may now be acted on
            }
        })();
    }
    //for (let i = 0; i < 12; i++) smartEditMessage(Math.random().toString(), {}, 1, new Function()); // For testing
    function valueToMeter(value, notFound) {
        value = Math.floor(Math.min(Math.max(Number(value), 0), 9));
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
                text: "Last code update "+Math.floor((Date.now()-lastRestartFooter.getTime())/1000)+" seconds ago | "+
                      "Last data save "+Math.floor((Date.now()-lastSaveFooter.getTime())/1000)+" seconds ago"
            },
            timestamp: lastRestartFooter.toJSON()
        };
        embed.fields = users.map(u => ({
            name: `${bf.userIDToEmoji(u.userID)} ${bot.users[u.userID].username} (${u.pets.length})`,
            value: u.pets.map(p => `${p.statsToHappinessDisplay()} ${p.name}`).join("\n"),
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
        }, 10000);
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
                                //let name = message.toUpperCase().slice(0,1)+message.toLowerCase().slice(1);
                                let name = message;
                                let newPet = new Pet(name, userObject, () => {
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
    if (bot.connected) {
        loadData(() => {
            realCode();
        });
    } else {
        bot.once("allUsers", () => {
            loadData(() => {
                realCode();
            });
        });
    }

    // Available functions
    let availableFunctions = {
        pet: {
            aliases: ["pet", "pets"],
            shortHelp: "The official sequel to Hippo Clicker™",
            reference: "",
            longHelp: "",
            code: function(userID, channelID, command, d) {
                if (channelID != petIDs.channel) return; //TODO
                if (command.regularWords[0] == "reset" && channelID == petIDs.channel) {
                    bot.getMessages({channelID: petIDs.channel}, function(e,a) {
                        bot.deleteMessages({channelID: petIDs.channel, messageIDs: a.map(m => m.id)}, function(err) {
                            if (err) cf.log(err, "error");
                            bf.sendMessage(petIDs.channel, "Pets at a glance", function(e,id) {
                                cf.log(petIDs.glanceDisplay = id, "warning");
                                bf.sendMessage(petIDs.channel, "Shop", function(e,id) {
                                    cf.log(petIDs.shop = id, "warning");
                                });
                            });
                        });
                    });
                } else if (command.regularWords[0] == "save" && channelID == petIDs.channel) {
                    bot.deleteMessage({channelID: petIDs.channelID, messageID: d.id});
                    saveData(console.log);
                } else {
                    bf.sendMessage(channelID, eval(command.input));
                }
            }
        }
    };
    return availableFunctions;
}
