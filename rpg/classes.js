module.exports = function(input) {
    let {Discord, bot, cf, bf, db, reloadEvent, beings, rooms, game, ut, di} = input; // Grab everything from main.js
    let events = require("events");
    let notice = new events.EventEmitter(); // To pass async stuff that doesn't make sense as a callback between beings
    let Classes = {}; // Buckle up.
    Classes.Thing = class Thing {
        /* Anything in the world in a specific room and subroom with persistent changeable properties
         * for example, an item, a moving wall, a player, an enemy...
         */
        constructor(name, room, subroom, hidden) {
            /* name: the name to display when looked at, among other things. SHOULD BE UNIQUE!
             * room: the room it resides in
             * subroom: the subroom is resides in
             * hidden: whether it should show up when looked at
             */
            beings.push(this); // All Things should be automatically added to the beings variable. Really this variable should have been named "things".
            Object.assign(this, {name, room, subroom, actions: { // Assign its name, room and subroom from the constructor
            }, receivables: {
                /* Receivables are functions that are called on this object by other objects.
                 * for example, it could be looked at, hurt, picked up...
                 */
                look: () => { // Look returns a full embed describing everything
                    return {embed: {
                        title: this.name,
                        description: this.type
                    }};
                },
                summary: () => { // Summary is a one-liner used for display in a list
                    return this.name+" (generic "+this.constructor.name+")";
                }
            }});
            this.type = "thing";
            this.hidden = !!hidden; // the operator !! will change the input value to either false or true, since booleans are better than random data
        }
        navigateSubrooms(subrooms, target) { // Find a path through subrooms and follow it, calling setLocation at each one
            let path = ut.findSubroomPath(subrooms, this.subroom, target);
            if (path) {
                path.forEach(p => {
                    this.setLocation(undefined, p);
                });
                return true;
            } else {
                return false;
            }
        }
        setLocation(room, subroom) {
            /* Go to a specific room or subroom.
             * This should ALWAYS be used instead of directly setting "room = ..., subroom = ..."
             * so that subroom-specific events can be triggered on arrival.
             */
            if (room != undefined) this.room = room;
            if (subroom != undefined) this.subroom = subroom;
            notice.emit("setLocation", room, subroom, this);
            // Now check for traps and stuff
        }
    }
    Classes.FakeSubroom = class FakeSubroom extends Classes.Thing {
        constructor(name, room, data, hidden) {
            let others = beings.filter(b => b.type == "fakeSubroom");
            super((name || "FakeSubroom"+others.length), room, undefined, true);
            this.type = "fakeSubroom";
            this.data = data;
            this.subroomHidden = hidden;
            setImmediate(() => {
                this.subroom = this.data.location;
                if (!this.subroomHidden) this.show();
            });
        }
        show() {
            /* Adds this object and its connections to subrooms,
             * then sets a variable so it will be automatically added again upon reload.
             */
            let subrooms = rooms[this.room].subrooms; // Temp variable for easy access
            subrooms.push(this.data); // Push room to subrooms
            this.data.connections.forEach(c => { // For each connection out of this room...
                subrooms.find(s => s.location == c).connections.push(this.data.location); // add a connection to that room in order to get back.
            });
            this.subroomHidden = false; // It's now visible: update the variable
        }
        hide(relocate) {
            /* Removes this object and its connections from subrooms,
             * then sets a variable so it will not be automatically added upon reload.
             */
            let subrooms = rooms[this.room].subrooms; // Temp variable for easy access
            if (relocate == undefined) this.data.connections[0]; // Where to move stranded beings to
            subrooms.splice(subrooms.indexOf(this.data)); // Remove from subrooms
            this.data.connections.forEach(c => { // For each connection...
                let connections = subrooms.find(s => s.location == c).connections;
                connections.splice(connections.indexOf(this.data.location)); // remove that connection to the removed subroom.
            });
            this.subroomHidden = true; // It's now hidden: update the variable
            beings.filter(b => b.room == this.room && b.subroom == this.subroom).forEach(b => { // For each being in the now removed subroom...
                if (typeof(relocate) == "string") { // ...if relocate is (probably) a subroom...
                    b.setLocation(undefined, relocate); // move the being there.
                }
            });
        }
    }
    Classes.Being = class Being extends Classes.Thing {
        /* Like a Thing, but with HP and stats, and can hold and use tiered items
         * for example, a player, an enemy, an ally, a pet...
         */
        constructor(fullName, room, subroom) {
            /* fullName: NPCs and players will probably have a first name and last name. store all names in fullName and first name only in name.
             * room & subroom: see Thing
             */
            super(cf.sarg(fullName, 0), room, subroom); // cf.sarg(fullName, 0) gets first name from full name
            Object.assign(this, {fullName, type: "being"});
            cf.mergeObjects([this.receivables, {
                look: () => { // this is easy enough, but since it's your first time seeing a detailed embed:
                    return {embed: { // start with an object containing an embed object
                        author: this.embedAuthor(), // see the method
                        fields: [
                            {
                                name: "Stats", // the text with better contrast and larger top spacing
                                value: "❤ "+this.stats.hp+"/"+this.stats.hpMax, // the text with worse contrast that spans multiple lines
                                inline: true // line up multiple fields horizontally
                            },{
                                name: "Equipment",
                                value: "🗡 "+(this.equipment.melee ? this.equipment.melee.receivables.inventoryLine(false) : "(nothing equipped)"), // this is easy. look up the ternary operator if you're confused
                                inline: true
                            }
                        ]
                    }};
                },
                heal: (health) => { // heal a certain amount of HP, but don't exceed max
                    this.stats.hp = Math.min(this.stats.hp+health, this.stats.hpMax);
                },
                hurt: (damage) => { // hurt a certain amount of HP, and kill being if it reaches or passes zero
                    this.stats.hp -= damage;
                    if (this.stats.hp <= 0) {
                        beings.splice(beings.map((o,i) => ({o,i})).find(o => o.o == this).i, 1);
                        bot.sendMessage({to: game.channel, embed: {
                            author: this.embedAuthor(),
                            title: "Died.",
                            color: 0xdd1d1d
                        }});
                    }
                },
                talk: (caller) => { // start an interactive dialogue, see the startDialogue method
                    if (!this.talkID) {
                        return "You open your mouth, but the look in "+this.name+"'s eyes informs you it would be better if you didn't say anything.";
                    } else {
                        this.startDialogue(this.talkID, caller);
                        return "`";
                    }
                }
            }]);
            this.stats = { // stats and max stats. lower bound is always zero.
                hp: 50,
                hpMax: 50,
                magic: 20,
                magicMax: 20
            };
            this.tiers = { // duh
                melee: 1,
                ranged: 1,
                magic: 1,
                item: 1
            };
            this.inventory = []; // duh
            this.equipment = { // equipment is moved from the inventory to these slots when it is equipped
                melee: null,
                ranged: null,
                magic: null
            };
        }
        embedAuthor() { // return name and avatar for display as author of an embed
            return {
                name: this.fullName || this.name, // if you haven't seen the || operator before, it returns the first thing, but if there is no first thing, it moves on to the next thing
                icon_url: (this.userID ? "https://cdn.discordapp.com/avatars/"+this.userID+"/"+bot.users[this.userID].avatar+".jpg?size=32" : undefined) // if it's controlled by a player return the player's avatar
            }
        }
        getItem(name) { // return a specific item and its position in this Being's inventory
            let inventory = this.inventory.map((i,k) => ({item: i, index: k}));
            return ut.partialMatch(name, inventory, ["item", "name"], [
                {position: 2, path: ["item", "constructor", "name"], code: (input, item) => (input.toLowerCase() == item.toLowerCase)}
            ]);
        }
        startDialogue(talkID, caller) {
            let q = di[talkID];
            let current = q.start;
            let mid;
            let lastReaction = 0;
            /*function getActions() {
                return q.list[current].options.map((o,i) => {
                });
            }*/
            let getEmbed = () => { // Get the current dialogue state and generate an embed
                if (current == "END") {
                    return {
                        author: this.embedAuthor(),
                        title: "Conversation",
                        description: "(Conversation ended)",
                    }
                } else {
                    return {
                        author: this.embedAuthor(),
                        title: "Conversation",
                        description: q.list[current].text,
                        fields: [
                            {
                                name: "Choose a response",
                                value: q.list[current].options.map((o,i) => (bf.buttons[i+1]+" "+o.name)).join("\n")
                            }
                        ]
                    }
                }
            }
            let showNextBox = () => { // Edit the message to the content from getEmbed
                bf.editMessage(game.channel, mid, "", undefined, {embed: getEmbed()});
            }
            let actionManager = (event) => { // Take actions based on button presses
                let button = parseInt(event.d.emoji.name.split("_")[1])-1; // The number on the button - 1
                let choice = q.list[current].options[button]; // The information to act upon from the dialogue file
                if (!choice) { // If the button wasn't an option...
                    bf.removeReaction(game.channel, mid, event.d.emoji, event.d.user_id); // remove the user's reaction.
                    return;
                }
                let codeOutput;
                if (choice.code) { // If code is available...
                    codeOutput = choice.code({game, beings, ut, Classes, speaker: this, caller}); // run it and store the output.
                }
                if (choice.route == "CODE") { // If next room depends on code output...
                    current = codeOutput; // go there.
                } else { // Otherwise...
                    current = choice.route; // go where the route says to go.
                }
                if (choice.route == "END") { // If you reached the end...
                    bot.removeAllReactions({channelID: game.channel, messageID: mid}); // remove all buttons.
                }
                showNextBox(); // Something changed, so update the display
            }
            /* Set up buttons
             * Go down the tree of possible messages and choices, find the one with the most buttons,
             * and add those buttons to the message.
             * Every action should direct to actionManager.
             */
            let actions = Object.values(q.list).sort((a,b) => b.options.length-a.options.length)[0].options.map((o,i) => ({
                emoji: bf.buttons[i+1],
                actionType: "js",
                actionData: actionManager
            }));
            bf.sendMessage(game.channel, "", (err,id) => { // Send the inital menu
                if (err) cf.log(err, "error");
                mid = id;
                bf.reactionMenu(game.channel, mid, actions);
            }, {embed: getEmbed()});
        }
    }
    Classes.Player = class Player extends Classes.Being { // a Being controlled by a player
        constructor(fullName, userID, room, subroom) { // only one new thing here: userID, the userID of the controlling user
            super(fullName, room, subroom);
            Object.assign(this, {fullName, userID, actions: {
                /* Actions are functions that do something do another thing and are designed to display nicely and to be called by a human with a text command
                 * for example, this player could attack something, look at something, pick up something, go somewhere, check its stats, start a conversation...
                 */
                attack: { // Deal damage to a target with a melee weapon
                    aliases: ["attack", "melee"],
                    expects: "",
                    fail: "auto",
                    code: (input) => {
                        let command = cf.carg(input, "", " ", ";");
                        let attackType = Number(command.numbers[0]); // Get the first number from the message
                        let being = ut.partialMatch(command.regularWords.join(" "), beings.filter(b => b != this && b.room == this.room && b.subroom == this.subroom), ["name"]); // Get a being matching words from the message
                        if (!this.equipment.melee) { // If you don't have a weapon...
                            return "You charge at your foe, but quickly realise that you aren't going to do much damage without a weapon.";
                        } else if (this.equipment.melee.tier > this.tiers[this.equipment.melee.attackType]) { // If the weapon's tier is too high...
                            return "You attempt to raise your weapon, but suddenly it seems far too heavy to use. You can barely lift it from its container, let alone swing it.";
                        } else { // If all is well...
                            if (being) { // If you named something to attack...
                                return this.equipment.melee.attack(being, attackType); // attack it.
                            } else { // Didn't find anything to attack...
                                return "You hacked and you slashed, but without a target your efforts were wasted.";
                            }
                        }
                    }
                },
                equip: { // Equip a held item
                    aliases: ["equip"],
                    expects: "item",
                    fail: "auto",
                    code: (item) => { //TODO: Change up the success/failure messages to something neater
                        let slot = item.item.attackType; // Name of the slot that the item belongs in
                        if (this.equipment[slot]) { // If that slot is filled...
                            return "You already have an item in the slot `"+slot+"`.";
                        } else { // Otherwise...
                            this.inventory.splice(item.index, 1); // Remove the item from your inventory
                            this.equipment[slot] = item.item; // Add the item to equipment
                            return "`"+item.item.name+"` was equipped into slot `"+slot+"`.";
                        }
                    }
                },
                go: { // Go to a room or subroom
                    aliases: ["go", "move"],
                    expects: "",
                    fail: "auto",
                    code: (input) => {
                        let il = input.toLowerCase(); // il: Input Lowercase, so that I don't repeat myself
                        let room = rooms[this.room]; // Details of the being's current room
                        let exit = room.exits.find(r => r.direction.startsWith(il) || r.aliases.includes(il)); // Find an exit matching input
                        let subroom = room.subrooms && ut.partialMatch(input, room.subrooms, ["location"]); // Find a subroom matching input
                        if (exit) { // Input was an exit
                            if (!exit.exit || exit.exit == this.subroom) { // If already in exit subroom...
                                this.setLocation(exit.target, exit.entrance); // go there!
                                return this.actions.look.code();
                            } else { // Otherwise...
                                return new Promise(resolve => { // When the output function receives a promise, it will return the output of the promise's resolution.
                                    //console.log(rooms[exit.target].subrooms);
                                    this.navigateSubroomsMenu(room.subrooms, exit.exit, game.channel, () => { // Start a menu to get to the correct subroom
                                        //console.log("done");
                                        this.setLocation(exit.target, exit.entrance); // Once done, go through the exit,
                                        resolve(this.actions.look.code()); // and finally resolve the promise.
                                    });
                                });
                            }
                        } else if (subroom) { // Input was a subroom
                            this.navigateSubroomsMenu(room.subrooms, subroom.location, game.channel);
                            return "`";
                        } else {
                            return "Couldn't find an exit or subroom matching `"+input+"`.";
                        }
                    }
                },
                items: { // Show all inventory items
                    aliases: ["inventory", "items", "item"],
                    expects: "",
                    fail: "auto",
                    code: () => {
                        return {embed: {
                            author: this.embedAuthor(),
                            title: "Inventory",
                            description: this.inventory.map(item => item.receivables.inventoryLine(true)).join("\n") || "(empty)"
                        }};
                    }
                },
                look: { //TODO: comments
                    aliases: ["look"],
                    expects: "being",
                    fail: "manual",
                    code: (input) => {
                        let room = rooms[this.room];
                        // Looks at inventory, call its own function
                        if (typeof(input) == "string" && ["inventory", "items"].some(word => input.split(" ").includes(word))) {
                            return this.actions.items.code();
                        }
                        // Looks at a being, call that being's function
                        else if (input && input.receivables && input.receivables.look) {
                            return input.receivables.look();
                        }
                        // Looks at subrooms
                        else if (typeof(input) == "string" && ["subrooms"].includes(input)) {
                            if (room.subrooms) {
                                return {embed: {
                                    author: this.embedAuthor(),
                                    title: room.location.join(" / "),
                                    fields: room.subrooms.map(s => ({name: s.location, value:
                                                "­ Position: `"+Object.values(s.position).join(", ")+"`\n"+ //SC: Soft hyphen, Em quad
                                                " Connects to "+s.connections.join(", ") //SC: Em quad
                                            }))
                                }};
                            } else {
                                return "There are no subrooms in this room.";
                            }
                        }
                        // Looks at specific inventory item, call its function
                        else if (typeof(input) == "string" && input && this.getItem(input)) {
                            return this.getItem(input).item.receivables.look();
                        }
                        // Looks at a room
                        else {
                            //console.log("beings:", beings.filter(b => b.name != this.name).filter(b => b.room == this.room).filter(b => !b.hidden).length);
                            //console.log("beings:", beings.filter(b => b.name != this.name));
                            return {embed: {
                                author: this.embedAuthor(),
                                title: room.location.join(" / ")+(this.subroom ? " ("+this.subroom+")" : ""),
                                description: room.description,
                                fields: [
                                    {
                                        name: "Beings",
                                        value: beings.filter(b => b.name != this.name)
                                                     .filter(b => b.room == this.room)
                                                     .filter(b => !b.hidden)
                                                     .map(b => b.receivables.summary()+(b.subroom ? " — "+b.subroom : ""))
                                                     .join("\n")
                                               || "(none)"
                                    },{
                                        name: "Subrooms",
                                        value: room.subrooms && room.subrooms.length
                                            ? ut.subroomTree(room.subrooms, this.subroom, 3)
                                            : "(none)"
                                    },{
                                        name: "Exits",
                                        value: room.exits.map(e => e.aliases.concat([e.direction]).join("/")).join("\n")
                                               || "(none)"
                                    }
                                ]
                            }};
                        }
                    }
                },
                stats: { // duh.
                    aliases: ["stats"],
                    expects: "",
                    fail: "auto",
                    code: () => {
                        return this.getStats();
                    }
                },
                take: { // Take an item
                    aliases: ["take"],
                    expects: "being",
                    fail: "auto",
                    code: (being) => {
                        if (!being.receivables.take) {
                            return "You cannot take that object.";
                        } else if (being.subroom != this.subroom) {
                            return "You must move to subroom "+being.subroom+" to take that item.";
                        } else {
                            let item = being.receivables.take();
                            this.inventory.push(item);
                            return "Got "+item.name;
                        }
                    }
                },
                talk: { // duh.
                    aliases: ["talk"],
                    expects: "being",
                    fail: "auto",
                    code: (being) => {
                        return being.receivables.talk(this);
                    }
                },
                use: { // Use a held item or an object
                    aliases: ["use"],
                    expects: "being",
                    fail: "manual",
                    code: (input) => {
                        if (typeof(input) == "string") { // Not a being
                            let item = this.getItem(input); // Figure out which item was mentioned
                            if (item) { // If there was a match...
                                item = item.item; // haha
                                if (item.receivables.use) { // If it can be used...
                                    //console.log(this);
                                    return item.receivables.use(this); // use it.
                                } else {
                                    return "You cannot use that item.";
                                }
                            } else {
                                return "You waved your hands in the air for a moment, but without something to wave at, nothing happened.";
                            }
                        } else { // A being
                            if (!input.receivables.use) {
                                return "You cannot use that object.";
                            } else if (input.subroom != this.subroom) {
                                return "You must move to subroom "+input.subroom.location+" to use that object.";
                            } else {
                                return input.receivables.use(this);
                            }
                        }
                    }
                },
                unequip: { // Put a held item back in the inventory
                    aliases: ["unequip"],
                    expects: "",
                    fail: "auto",
                    code: (slot) => {
                        if (this.equipment[slot] === null) { // whoa
                            return "There is no item in that slot.";
                        } else if (this.equipment[slot] === undefined) { // another one? amazing
                            return "That slot does not exist.";
                        } else {
                            let item = this.equipment[slot];
                            this.inventory.push(this.equipment[slot]);
                            this.equipment[slot] = null;
                            return "Unequipped item `"+item.name+"` from slot `"+slot+"`."; //TODO: Change this message
                        }
                    }
                },
                xyzzy: { // Don't forget to put an easter egg here in future
                    aliases: ["xyzzy"],
                    expects: "",
                    fail: "auto",
                    code: () => {
                        return "Nothing happens.";
                    }
                }
            }});
            cf.mergeObjects([this.receivables, {
                summary: () => {
                    return this.fullName+" (player)";
                }
            }]);
        }
        getStats() { // I'm not sure why the contents of this aren't just in the stats action
            return {embed: {
                author: this.embedAuthor(),
                fields: [
                    {
                        name: "Stats",
                        value: "❤ "+this.stats.hp+"/"+this.stats.hpMax+"\n"+
                               "✨ "+this.stats.magic+"/"+this.stats.magicMax
                    },{
                        name: "Progress",
                        value: "🗡 "+cf.numberToFullwidth(this.tiers.melee)+" ⚡ "+cf.numberToFullwidth(this.tiers.magic)+"\n"+
                               "🏹 "+cf.numberToFullwidth(this.tiers.melee)+" 📦 "+cf.numberToFullwidth(this.tiers.item),
                        inline: true
                    },{
                        name: "Equipment",
                        value: "🗡 "+(this.equipment.melee ? this.equipment.melee.receivables.inventoryLine(false) : "(nothing equipped)")
                    }
                ]
            }};
        }
        navigateSubroomsMenu(subrooms, target, channelID, callback) { //TODO: make sure this can't be exploited by leaving it open (listen for event, then close menu)
            if (!callback) callback = new Function();
            let pastMoves = [];
            let cheatingDetected = false;
            let path = ut.findSubroomPath(subrooms, this.subroom, target); // use ut.findSubroomPath to figure out the route
            if (path) { // If a route was found...
                path = [this.subroom].concat(path);
                let getPathMessage = (route, current) => { // a function which displays the route with prefixes to each line showing its status
                    return route.map((r,i) => { // For each line...
                        if (r == current) { // if this line is the player's current position, prefix a >
                            return ">  "+r;
                        } else if (i == route.length-1) { // if this line is the destination, prefix a !
                            return "!  "+r;
                        } else { // otherwise, no prefix, just spaces
                            return "   "+r;
                        }
                    }).join("\n");
                }
                let getCompleteMessage = (remaining) => { // a function which takes that path message and adds a little more info
                    return "Found path through subrooms:```\n"+getPathMessage(path, this.subroom)+"```"+(remaining ? " "+remaining+" moves left." : " Reached destination.");
                }
                bf.reactionMenu(channelID, getCompleteMessage(path.length-1), [ // reaction menu internals are hard to explain, so I won't :hippo:
                    {emoji: bf.buttons["tick"], remove: "all", ignore: "total", actionType: "js", actionData: (event) => {
                        if (!cheatingDetected) {
                            path.slice(1).forEach(p => { // For each point on the route,
                                pastMoves.push(p);
                                this.setLocation(undefined, p); // go there.
                            });
                            bf.editMessage(event.d.channel_id, event.d.message_id, getCompleteMessage(0)); // edit the message to show completion
                            callback(); // callback success
                        }
                    }},
                    {emoji: bf.buttons["down"], remove: "user", actionType: "js", actionData: (event) => {
                        if (!cheatingDetected) {
                            let nextIndex = path.indexOf(this.subroom)+1;
                            pastMoves.push(path[nextIndex]);
                            this.setLocation(undefined, path[nextIndex]); // go the next point on the route
                            let remaining = [...path].reverse().indexOf(this.subroom); // the number of remaining points on the route
                            if (nextIndex == path.length-1) { // If you're at the destination...
                                bot.removeAllReactions({channelID, messageID: event.d.message_id}); // remove all reactions on the message,
                                setImmediate(callback); // and callback as soon as possible.
                            }
                            bf.editMessage(event.d.channel_id, event.d.message_id, getCompleteMessage(remaining)); // edit the message to show progress
                        }
                    }}
                ], (err, id) => {
                    notice.on("setLocation", (room, subroom, being) => {
                        if (pastMoves.includes(subroom)) {
                            pastMoves.splice(pastMoves.indexOf(subroom), 1);
                        } else {
                            cheatingDetected = true;
                            bot.removeAllReactions({channelID, messageID: id});
                            bf.editMessage(channelID, id, "Movement menu closed to prevent cheating.");
                        }
                    });
                });
            } else { // If a route wasn't found...
                bf.sendMessage(channelID, "Couldn't navigate from "+this.subroom+" to "+target+" through subrooms."); // just fail, without callback
            }
        }
    }
    Classes.WorldItem = class WorldItem extends Classes.Thing {
        // This object holds an inventory item in the world so it can be taken by a Being.
        constructor(item, room, subroom, hidden) {
            /* item: the item that's being held in the world. should be an instance of an InventoryItem.
             * room & subroom & hidden: see Thing
             */
            super((item && item.name), room, subroom, hidden);
            cf.mergeObjects([this.receivables, {
                look: () => {
                    return this.item.receivables.look(); // Pass the request on to the contained item
                },
                summary: () => {
                    return this.item.receivables.summary(); // same deal as receivables.look
                },
                take: () => {
                    /* This is called when the item is taken.
                     * The being doing the taking should add the returned object to its inventory.
                     */
                    beings.splice(beings.indexOf(this), 1); // Remove this from the world
                    return this.item; // Return the contained item
                }
            }]);
            this.item = item;
            this.type = "worldItem";
            setImmediate(() => {
                /* Chances are this is being created because it previously existed but stuff is getting reloaded.
                 * If that's the case, the constructor gets nothing, and the item property will be linked in shortly.
                 * However, we need to get the name for this WorldItem from the item that it's holding.
                 * The code inside setImmediate will execute after properties have been loaded.
                 * So now, this.item will be available, so we set the name of the WorldItem to the name of the contained item. Easy!
                 */
                this.name = this.item.name;
            });
        }
    }
    Classes.InventoryItem = class InventoryItem {
        /* A brand new class! This represents an item as it is held in an inventory (or when equipped). */
        constructor(name, emoji, tier) {
            /* name: duh
             * emoji: the emoji that represents the item which is often displayed before the item's name
             * tier: duh
             */
            Object.assign(this, {name, emoji: emoji || "❓", tier, type: "inventoryItem"}); // If no emoji was supplied, use a red question mark
            this.receivables = {
                look: () => {
                    return {embed: {
                        title: this.emoji+" "+this.name,
                        description: "Default look receivable for generic items. Why isn't there a description specific to this subclass? ("+this.constructor.name+")",
                    }};
                },
                inventoryLine: (emoji) => { // similar to summary, but only for display in one's inventory
                    return (emoji ? this.emoji+" " : "")+this.name+" (T:"+this.tier+")";
                },
                summary: () => { // similar to inventoryLine, but for display in lists of beings (etc); WorldItem uses this
                    return this.name+" (item)";
                }
            }
        }
    }
    Classes.MeleeWeapon = class MeleeWeapon extends Classes.InventoryItem {
        /* Extends InventoryItem and sets properties exclusive to melee weapons. Obviously. */
        constructor(name, tier, power) {
            /* power: attack damage, which should be replaced very soon in order to allow for cooler attacks
             */
            super(name, "🗡", tier); // Prefill the dagger emoji
            this.type = "weapon";
            this.attackType = "melee"; // Exclusive to weapons. Ranged weapons will have ranged. This possibly won't ever be used.
            this.description = "A generic MeleeWeapon. Some say that it was created by a god who forgot to initialise it from the correct subclass.";
            this.power = power;
            cf.mergeObjects([this.receivables, {
                inventoryLine: (emoji) => {
                    return (emoji ? this.emoji+" " : "")+this.name+" (T:"+this.tier+" / D:"+this.power+")";
                },
                look: () => {
                    return {embed: {
                        title: this.emoji+" "+this.name,
                        description: this.description,
                        fields: this.attacks.map(a => ({name: a.name, value: a.description, inline: true}))
                    }};
                }
            }]);
            setImmediate(() => { // setImmediate ensures that attacks are per weapon class, not per weapon.
                this.attacks = [ // The attacks that can be performed with the weapon. Duh.
                    {
                        name: "Stab",
                        description: "Deals "+this.power+" damage to target.",
                        code: (target) => {
                            target.receivables.hurt(this.power);
                            // This return value is passed back through about 5 billion functions to eventually be spat out into chat as-is.
                            return "Dealt "+this.power+" damage to "+target.name;
                        }
                    }
                ];
            });
        }
        attack(target, attackType) {
            /* Attack something.
             * This is called by the attack action on a being. attackType is the index of the attack to use plus one.
             */
            if (!attackType) attackType = 1; // If not specified, use the first attack.
            if (attackType > this.attacks.length) { // If attackType is out of range...
                return "You tried to do something new, cool and fancy, but failed horribly."; // :hippo:
            } else { // If attackType is in range...
                return this.attacks[attackType-1].code(target); // Perform the requested attack.
            }
        }
    }
    Classes.HealingItem = class HealingItem extends Classes.InventoryItem {
        constructor(name, tier, power) {
            super(name, "⚗", tier);
            this.type = "healingItem";
            this.power = power;
            cf.mergeObjects([this.receivables, {
                use: (caller) => {
                    caller.receivables.heal(this.power);
                    caller.inventory.splice(caller.inventory.indexOf(this), 1);
                }
            }]);
        }
    }
    Classes.Switch = class Switch extends Classes.Thing {
        /* A thing with the receivable use which does stuff. It's a switch. */
        constructor(name, room, subroom, activationType, code) {
            /* name: is not specified, this is automatically generated
             * room & subroom & code: duh
             * activationType: affects switch behaviour. one of ["toggle", "button"]. this should probably be split off to a different class
             */
            let others = beings.filter(b => b.type == "switch"); // Only used for automatic name generation
            super((name || "Switch"+others.length), room, subroom, false);
            this.activationType = activationType;
            if (code) { // This is a brand new object!
                this.code = code; // Assign supplied code
                this.codeString = code.toString(); // Convert code to a string for reload storage
                cf.mergeObjects([this.receivables, { // Receivable
                    use: this.code
                }]);
            } else { // This object previously existed but is now loaded, so code is not yet available.
                setImmediate(() => { // wait for codeString to be loaded...
                    this.code = eval(this.codeString); // Create the code function from the string
                    cf.mergeObjects([this.receivables, { // Receivable
                        use: this.code
                    }]);
                });
            }
        }
    }
    return Classes; // Pass all that shit back to main.js so it can be used
}
