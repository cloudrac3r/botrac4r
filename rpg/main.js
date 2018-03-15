module.exports = function(input) {
    let {Discord, bot, cf, bf, db, reloadEvent} = input;
    const fs = require("fs");
    let beings = [];
    const game = {
        channel: "413152451345121280",
        admins: ["176580265294954507", "116718249567059974"]
    }
    let ut;
    let rooms = {};
    let di;
    let Classes;
    try {
        delete require.cache[require.resolve(__dirname+"/utilities.js")];
        ut = require(__dirname+"/utilities.js");
        cf.log("Loaded utilities", "spam");
        cf.o2a(rooms, true).forEach(o => {
            let {key, item} = o;
            item.subrooms.forEach(cs => {
                if (!cf.o2a(rooms).find(room => room.subrooms.some(s => s.connections.includes(cs.location)))) {
                    cf.log("Room "+key+" cannot be reached!", "warning");
                }
            });
        });
        delete require.cache[require.resolve(__dirname+"/rooms.js")];
        rooms = require(__dirname+"/rooms.js");
        cf.log("Loaded rooms", "spam");
        cf.o2a(rooms, true).forEach(o => {
            let {key, item} = o;
            if (!cf.o2a(rooms).find(room => room.exits.some(exit => exit.target == key))) {
                cf.log("Room "+key+" cannot be reached!", "warning");
            }
            item.exits.filter(exit => !rooms[exit.target]).forEach(exit => cf.log("Exit "+exit.target+" of room "+key+" leads nowhere!", "error"));
        });
        beings.filter(being => being.room && !rooms[being.room]).forEach(being => cf.log("Being "+being.fullName+" is in missing room "+being.room+"!", "error"));
        delete require.cache[require.resolve(__dirname+"/dialogues.js")];
        di = require(__dirname+"/dialogues.js");
        cf.log("Loaded dialogues", "spam");
        delete require.cache[require.resolve(__dirname+"/classes.js")];
        Classes = require(__dirname+"/classes.js")(Object.assign(input, {beings, rooms, game, ut, di}));
        cf.log("Loaded classes", "spam");
    } catch (e) {
        console.log(e);
        process.exit();
    }
    function reload() {
        input.loadModules({filename: __filename, dest: "bot commands", watched: true});
    }
    function purge() {
        bot.getMessages({channelID: game.channel, limit: 100}, function(err, arr) {
            if (err) cf.log(err, "error");
            if (arr.length == 0) {
                bf.sendMessage(game.channel, "Channel purged.", function(e,id) {
                    setTimeout(function() {
                        bot.deleteMessage({channelID: game.channel, messageID: id});
                    }, 10000);
                });
            } else if (arr.length > 1) {
                bot.deleteMessages({channelID: game.channel, messageIDs: arr.map(m => m.id)}, function(err) {
                    if (!err) purge();
                    else if (err.response && err.response.message == "You are being rate limited.") setTimeout(purge, err.response.retry_after);
                    else cf.log(err, "error");
                });
            } else {
                bot.deleteMessage({channelID: game.channel, messageID: arr[0].id}, function(err) {
                    if (!err) purge();
                    else if (err.response && err.response.message == "You are being rate limited.") setTimeout(purge, err.response.retry_after);
                    else cf.log(err, "error");
                });
            }
        });
    }
    function loadGame(callback) {
        fs.readFile(__dirname+"/save", {encoding: "utf8"}, (err, file) => {
            if (err) callback();
            else {
                let input = file.split("\n");
                let thing = {};
                input.forEach(line => {
                    if (line.length > 4) {
                        let depth = 0;
                        if (line.startsWith(" ")) depth = line.match(/^ +/)[0].length/4; // Set depth to indentation level (4 spaces = 1 depth)
                        if (depth) {
                            line = line.slice(depth*4); // Remove indentation
                            let path = line.split(" ")[0].split("."); // eg ["weapon", "parts", "barrel"]
                            let last = path.splice(-1, 1)[0]; // Remove the last part of the path into `last`
                            let constructor = line.split(" ")[1]; // The second word on the line (eg "Weapon")
                            let data = JSON.parse(line.split(" ").slice(2).join(" ")); // Properties of the object
                            thing[depth] = new Classes[constructor](); // Create the object
                            cf.mergeObjects([thing[depth], data, {actions: thing[depth].actions}]); // Assign its properties
                            let target = thing[0]; // Get the object from the depth above
                            //console.log(path, last, target);
                            path.forEach(level => target = target[level]);
                            target[last] = thing[depth]; // Put this object in the object from the depth above
                        } else {
                            let constructor = line.split(" ")[0]; // The first word on the line (eg "Player")
                            let data = JSON.parse(line.split(" ").slice(1).join(" ")); // Properties of the object
                            thing[depth] = new Classes[constructor](); // Create the object
                            cf.mergeObjects([thing[depth], data, {actions: thing[depth].actions}]); // Assign its properties (except for actions)
                        }
                    }
                });
                if (callback) callback();
            }
        });
    }
    function saveGame(callback) {
        if (!callback) callback = new Function();
        let output = [];
        let last = {depth: -1, length: -1};
        const ignorePaths = ["actions"];
        beings.forEach(being => {
            function addAdditional(object, path) {
                //console.log("> "+path.join("."));
                if (object.constructor && Classes[object.constructor.name]) {
                    output.push(" ".repeat((last.depth+1)*4)+(path.length ? path.join(".")+" " : "")+object.constructor.name+" "+JSON.stringify(object));
                }
                cf.o2a(object, true).forEach(prop => {
                    let {key, item} = prop;
                    //console.log(prop);
                    if (typeof(item) == "object") {
                        //console.log(">> "+path.concat([key]).join("."));
                        if (!ignorePaths.includes(path.concat([key]).join("."))) {
                            let old = {...last};
                            if (object.constructor && Classes[object.constructor.name]) last.depth++;
                            addAdditional(item, path.concat([key]));
                            last = old;
                        }
                        //else console.log("Ignoring");
                    }
                });
                //output.push(" ".repeat(path.length*4)+(path.length ? path.join(".")+" " : "")+being.constructor.name+" "+JSON.stringify(being));
            }
            addAdditional(being, []);
            //output = output.reverse();
        });
        fs.writeFile(__dirname+"/save", output.join("\n"), {encoding: "utf8"}, callback);
    }
    function getBeing(name, room) {
        if (!name) return;
        let b = beings;
        if (room) {
            b = beings.filter(b => b.room == room);
        }
        return ut.partialMatch(name, b, ["fullName"]) || ut.partialMatch(name, b, ["name"]);
    }
    cf.rc = function(input) {
        return messageEvent(bot.users["176580265294954507"].username, "176580265294954507", game.channel, input, {console: true});
    }
    function messageEvent(user, userID, channelID, message, event) {
        function output(text) {
            if (text == "`") return; // Purposeful "don't output anything" dummy
            if (text && text.embed) {
                bf.sendMessage(channelID, undefined, text);
            } else if (event.console) {
                cf.log(text, "responseInfo");
            } else {
                if (text) {
                    bf.sendMessage(channelID, text);
                } else {
                    bf.addReaction(channelID, event.d.id, "✅");
                }
            }
        }
        if (channelID != game.channel) return;
        // Run code or input regular commands
        if (message.startsWith("=") && game.admins.includes(userID)) {
            message = message.slice(1);
            try {
                let result = eval(message);
                if (typeof(result) == "object") {
                    output("```js\n"+JSON.stringify(result, null, 4)+"```");
                } else {
                    output(result);
                }
            } catch (e) {
                output("```\n"+e.stack+"```");
            }
        } else {
            // Choose player
            let player;
            if (cf.sarg(message, 0) == "as" && game.admins.includes(userID)) {
                player = getBeing(cf.sarg(message, 1));
                message = cf.sarg(message, "2-");
            } else {
                player = beings.find(b => b.constructor.name == "Player" && b.userID == userID);
            }
            // Misc special words
            if (cf.sarg(message, 0) == "load") {
                let filename = cf.sarg(message, 1).toLowerCase().replace(/[^a-z0-9_-]/, "");
                if (!filename) {
                    output("Error: no filename given");
                } else {
                    try {
                        fs.accessSync(__dirname+"/saves/"+filename, fs.constants.R_OK);
                        saveGame(() => {
                            fs.rename(__dirname+"/save", __dirname+"/saves/oops", () => {
                                fs.copyFile(__dirname+"/saves/"+filename, __dirname+"/save", () => {
                                    reload();
                                    output();
                                });
                            });
                        });
                    } catch (e) {
                        output("Error: file does not exist");
                    }
                }
            } else if (cf.sarg(message, 0) == "save") {
                let filename = cf.sarg(message, 1).toLowerCase().replace(/[^a-z0-9_-]/, "");
                if (!filename) {
                    output("Error: no filename given");
                } else {
                    saveGame(() => {
                        fs.copyFile(__dirname+"/save", __dirname+"/saves/"+filename, () => {
                            output();
                        });
                    });
                }
            } else {
                // Do actual stuff
                if (!player) { // No player found
                    if (cf.sarg(message, 0) == "create") {
                        player = new Classes.Player(cf.sarg(message, "1-"), userID, "start/bedroom", "");
                        output("Created player "+player.fullName);
                    }
                } else { // Player found
                    cf.o2a(player.actions).forEach(action => {
                        if (action.aliases.includes(cf.sarg(message, 0))) {
                            message = cf.sarg(message, "1-");
                            let pass;
                            let fail = false;
                            switch (action.expects) {
                            case "being":
                                pass = getBeing(message, player.room);
                                if (!pass) {
                                    if (action.fail == "auto") {
                                        fail = true;
                                        output("Couldn't find a being matching `"+message+"`.");
                                    } else {
                                        pass = message;
                                    }
                                }
                                break;
                            case "room":
                                pass = rooms[player.room];
                                if (!pass) {
                                    if (action.fail == "auto") {
                                        fail = true;
                                        output("Couldn't find a room matching `"+message+"`.");
                                    } else {
                                        pass = message;
                                    }
                                }
                                break;
                            case "item":
                                pass = player.getItem(message);
                                if (!pass) {
                                    if (action.fail == "auto") {
                                        fail = true;
                                        output("Couldn't find an item matching `"+message+"`.");
                                    } else {
                                        pass = message;
                                    }
                                }
                                break;
                            default:
                                pass = message;
                                break;
                            }
                            if (!fail) {
                                let result = action.code(pass);
                                if (result && result.constructor == Promise) {
                                    result.then(input => {
                                        output(input);
                                    });
                                } else {
                                    output(result);
                                }
                            }
                        }
                    });
                }
            }
        }
        saveGame();
    }
    loadGame(() => {
        bot.on("message", messageEvent);
    });
    reloadEvent.once(__filename, () => {
        bot.removeListener("message", messageEvent);
    });
}
