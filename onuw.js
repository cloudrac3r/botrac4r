module.exports = function(input) {
    //TODO Add minion, custom role sets, randomly pick from too large role sets
    //TODO Test Troublemaker, Insomniac, Drunk (Eris)
    let {bot, cf, bf, db} = input;
    let lastCheckMessage = {};
    let games = [];
    class Team {
        constructor(name) {
            this.name = name;
        }
    }
    class VillageTeam extends Team {
        constructor() {
            super("village");
        }
        isWinner(game, teamStatus) {
            if ((teamStatus["werewolf"] || []).length == 0) { // No werewolves
                if (teamStatus["all"].some(s => s == "dead")) { // Dead villagers
                    return false;
                } else {
                    return true;
                }
            } else { // Werewolves
                if (teamStatus["werewolf"].some(s => s == "dead")) { // Dead werewolves
                    return true;
                } else {
                    return false;
                }
            }
        }
    }
    class WerewolfTeam extends Team {
        constructor() {
            super("werewolf");
        }
        isWinner(game, teamStatus) {
            if (teamStatus["werewolf"].some(s => s == "dead")) { // Dead werewolves
                return false;
            } else {
                return true;
            }
        }
    }
    class TannerTeam extends Team {
        constructor() {
            super("tanner");
        }
        isWinner(game, teamStatus, player) {
            /*
            if (teamStatus["tanner"].every(s => s == "dead")) {
                return true;
            } else {
                return false;
            }*/
            return !player.alive;
        }
    }
    class Card {
        constructor(role, team) {
            this.role = role;
            this.team = team;
        }
    }
    class Villager extends Card {
        constructor() {
            super("villager", new VillageTeam());
            this.order = 1;
        }
        interact(game, player, finished) {
            let message = "";
            let actions = [
                {emoji: bf.buttons["tick"], ignore: "total", actionType: "js", actionData: finished}
            ];
            message = "Villagers cannot do anything during the night.";
            return {message: message, actions: actions};
        }
    }
    class Werewolf extends Card {
        constructor() {
            super("werewolf", new WerewolfTeam());
            this.order = 1;
            this.type = "werewolf";
        }
        interact(game, player, finished) {
            let message = "";
            let actions = [];
            let wolfList = game.players.filter(p => p.user.id != player.user.id)
                                       .filter(p => p.card.type == "werewolf")
                                       .map(p => ({user: p.user, type: p.card.role}));
            if (wolfList.length == 0) {
                message = "There are no other werewolves in this game.\n"+
                          "As the lone wolf, you may look at a centre card by pressing a reaction.";
                function actionManager(msg, emoji, user) {
                    let button = parseInt(emoji.name.replace(/^bn_([0-9])$/, "$1"));
                    if (game.centreCards[button-1]) {
                        bf.sendMessage(msg.channel, `Centre card #${button} is ${game.centreCards[button-1].role}.`);
                        game.addToLog(player.user, player.card.role, "Looked at centre card #"+button);
                    } else {
                        bf.sendMessage(msg.channel, "You decided not to look at a centre card for no reason.");
                    }
                    finished();
                }
                actions = [
                    {emoji: bf.buttons["1"], ignore: "total", actionType: "js", actionData: actionManager},
                    {emoji: bf.buttons["2"], ignore: "total", actionType: "js", actionData: actionManager},
                    {emoji: bf.buttons["3"], ignore: "total", actionType: "js", actionData: actionManager},
                    {emoji: bf.buttons["times"], ignore: "total", actionType: "js", actionData: actionManager},
                ];
            } else if (wolfList.length == 1) {
                message = "The other werewolf in this game is "+bf.userToNick(wolfList[0].user, game.guild, "username")+" ("+wolfList[0].type+").";
                actions = [
                    {emoji: bf.buttons["tick"], ignore: "total", actionType: "js", actionData: finished}
                ];
            } else {
                message = "The other werewolves in this game are "+cf.listify(wolfList.map(i => i.user.username+" ("+i.type+")"))+".";
                actions = [
                    {emoji: bf.buttons["tick"], ignore: "total", actionType: "js", actionData: finished}
                ];
            }
            return {message: message, actions: actions};
        }
    }
    class Seer extends Card {
        constructor() {
            super("seer", new VillageTeam());
            this.order = 1;
        }
        interact(game, player, finished) {
            let message = "As seer, you may examine either a single card of another player, or two cards from the centre.\n"+
                          "Click either the player or the cards reaction.";
            let actions = [
                {emoji: bf.buttons["person"], ignore: "total", actionType: "js", actionData: function(msg, emoji, user) {
                    let info = game.getPlayerMenu([player.user.id]);
                    function actionManager(msg, emoji, user) {
                        let chosen = info.sorted[parseInt(emoji.name.replace(/^bn_([0-9]+)$/, "$1"))-1];
                        bf.sendMessage(msg.channel, `${chosen.user.username}'s card is ${chosen.card.role}.`);
                        game.addToLog(player.user, player.card.role, `Looked at ${chosen.user.username}'s card: ${chosen.card.role}`);
                        finished();
                    }
                    bf.reactionMenu(msg.channel, "Choose a player.\n"+info.list.join("\n"),
                        info.sorted.map((p,i) => ({emoji: bf.buttons[i+1+""], ignore: "total", actionType: "js", actionData: actionManager})));
                }},
                {emoji: bf.buttons["cards"], ignore: "total", actionType: "js", actionData: function(msg, emoji, user) {
                    let seenCards = [];
                    function actionManager(msg, emoji, user) {
                        if (seenCards.length >= 2) {
                            bf.sendMessage(msg.channel, "You may not look at any more cards.");
                        } else {
                            let button = parseInt(emoji.name.replace(/^bn_([0-9])$/, "$1"));
                            bf.sendMessage(msg.channel, `Centre card #${button} is ${game.centreCards[button-1].role}.`);
                            seenCards.push(button);
                            if (seenCards.length == 2) {
                                seenCards = seenCards.sort();
                                game.addToLog(player.user, player.card.role, `Looked at centre cards ${cf.listify(seenCards.map(n => "#"+n))}`);
                                finished();
                            }
                        }
                    }
                    bf.reactionMenu(msg.channel, "Choose two centre cards.", [
                        {emoji: bf.buttons["1"], ignore: "that", actionType: "js", actionData: actionManager},
                        {emoji: bf.buttons["2"], ignore: "that", actionType: "js", actionData: actionManager},
                        {emoji: bf.buttons["3"], ignore: "that", actionType: "js", actionData: actionManager}
                    ]);
                }},
                {emoji: bf.buttons["times"], ignore: "total", actionType: "js", actionData: function(msg) {
                    bf.sendMessage(msg.channel, "You decided not to look at any cards for no reason.");
                    finished();
                }}
            ];
            return {message: message, actions: actions};
        }
    }
    class Robber extends Card {
        constructor() {
            super("robber", new VillageTeam());
            this.order = 2;
        }
        interact(game, player, finished) {
            let message = "As robber, you may steal a card from another player.\n"+
                          "Choose the player that you want to steal from.\n";
            let info = game.getPlayerMenu([player.user.id], (msg, emoji, user) => {
                let chosen = info.sorted[parseInt(emoji.name.replace(/^bn_([0-9]+)$/, "$1"))-1];
                bf.sendMessage(msg.channel, "You stole and became a "+chosen.card.role+".");
                finished(this.order, function() {
                    game.addToLog(player.user, player.card.role, `Stole ${chosen.user.username}'s ${chosen.card.role}`);
                    let newCard = player.exchangeCard(chosen);
                });
            });
            message += info.list.join("\n");
            let actions = info.actions.concat([{emoji: bf.buttons["times"], ignore: "total", actionType: "js", actionData: function(msg, emoji, user) {
                bf.sendMessage(msg.channel, "You decided not to steal from anybody. What a nice person you must be!");
                finished();
            }}]);
            return {message: message, actions: actions};
        }
    }
    class Troublemaker extends Card {
        constructor() {
            super("troublemaker", new VillageTeam());
            this.order = 3;
        }
        interact(game, player, finished) {
            let message = "As troublemaker, you may swap the cards of two other players.\n";
            let actions = [];
            let previouslyClicked;
            let clickCount = 0;
            let previousMessageID;
            let info = game.getPlayerMenu([player.user.id], (msg, emoji, user) => {
                // Enough players, get two and execute the swap
                let chosen = info.sorted[parseInt(emoji.name.replace(/^bn_([0-9]+)$/, "$1"))-1];
                clickCount++;
                if (!previouslyClicked) {
                    previouslyClicked = chosen;
                    bf.sendMessage(msg.channel, previouslyClicked.user.username+"'s card will be swapped with...").then(msg => {
                        previousMessageID = msg.id;
                    });
                } else if (previouslyClicked.user.id == chosen.user.id) {
                    clickCount--;
                } else if (clickCount == 2) {
                    let message = previouslyClicked.user.username+"'s card has been swapped with "+chosen.user.username+"'s card.";
                    if (previousMessageID) {
                        bf.editMessage(msg.channel, previousMessageID, message).then(() => {
                            bf.sendMessage(msg.channel, message);
                        });
                    } else {
                        bf.sendMessage(msg.channel, message);
                    }
                    finished(this.order, function() {
                        game.addToLog(player.user, player.card.role, `Swapped ${previouslyClicked.user.username}'s ${previouslyClicked.card.role} with ${chosen.user.username}'s ${chosen.card.role}`);
                        chosen.exchangeCard(previouslyClicked);
                    });
                } else {
                    bf.sendMessage(msg.channel, "You have already completed your action.");
                }
            }, "this");
            if (info.sorted.length < 2) {
                message += "Unfortunately, there aren't enough players in this game for you to do that.";
                actions = [{emoji: bf.buttons["tick"], ignore: "total", actionType: "js", actionData: finished}];
            } else {
                message += "Choose the two players that you would like to swap.\n"+info.list.join("\n");
                actions = info.actions.concat([{emoji: bf.buttons["times"], ignore: "total", actionType: "js", actionData: function(msg, emoji, user) {
                    bf.sendMessage(msg.channel, "You decided not swap any cards. Your loss.");
                    finished();
                }}]);
            }
            return {message: message, actions: actions};
        }
    }
    class Mason extends Card {
        constructor() {
            super("mason", new VillageTeam());
            this.order = 0;
        }
        interact(game, player, finished) {
            let message = "As mason, you may see the other masons in this game.\n";
            let actions = [];
            let masonList = game.players.filter(p => p.user.id != player.user.id)
                                       .filter(p => p.card.role == "mason")
                                       .map(p => p.user);
            if (masonList.length == 0) {
                message += "However, there aren't actually any other masons this time.";
            } else if (masonList.length == 1) {
                message += "The other mason in this game is "+bf.userToNick(masonList[0], game.guild, "username")+".";
            } else {
                message += "The other masons in this game are "+cf.listify(masonList.map(i => i.username))+".";
            }
            actions = [{emoji: bf.buttons["tick"], ignore: "total", actionType: "js", actionData: finished}];
            return {message: message, actions: actions};
        }
    }
    class DreamWolf extends Card {
        constructor() {
            super("dream wolf", new WerewolfTeam());
            this.order = 1;
            this.type = "werewolf";
        }
        interact(game, player, finished) {
            let message = "You are a werewolf, but you cannot see the other werewolves and you may not look at any centre cards.";
            let actions = [{emoji: bf.buttons["tick"], ignore: "total", actionType: "js", actionData: finished}];
            return {message: message, actions: actions};
        }
    }
    class Insomniac extends Card {
        constructor() {
            super("insomniac", new VillageTeam());
            this.order = 99;
        }
        interact(game, player, finished) {
            let message = "You will check your role at the end of the night.";
            let actions = [
                {emoji: bf.buttons["tick"], ignore: "total", actionType: "js", actionData: () => {
                    finished(this.order, function() {
                        bf.sendMessage(player.user, "You are now "+cf.indefArtify(player.card.role)+".");
                    });
                }}
            ];
            return {message: message, actions: actions};
        }
    }
    class Drunk extends Card {
        constructor() {
            super("drunk", new VillageTeam());
            this.order = 4;
        }
        interact(game, player, finished) {
            let message = "As drunk, you must blindly select a card from the centre to serve as your new card.";
            let actionManager = (msg, emoji, user) => {
                let button = parseInt(emoji.name.replace(/^bn_([0-9])$/, "$1"));
                bf.sendMessage(msg.channel, `Your card has been swapped with centre card #${button}.`);
                finished(this.order, function() {
                    game.addToLog(player.user, player.card.role, "Became centre card #"+button);
                    //let newCard = player.exchangeCard({card: game.centreCards[button-1]});
                    let newCard = game.centreCards[button-1];
                    game.centreCards[button-1] = player.card;
                    player.card = newCard;
                });
            }
            let actions = [
                {emoji: bf.buttons["1"], ignore: "total", actionType: "js", actionData: actionManager},
                {emoji: bf.buttons["2"], ignore: "total", actionType: "js", actionData: actionManager},
                {emoji: bf.buttons["3"], ignore: "total", actionType: "js", actionData: actionManager}
            ];
            return {message: message, actions: actions};
        }
    }
    class MysticWolf extends Card {
        constructor() {
            super("mystic wolf", new WerewolfTeam());
            this.order = 1;
            this.type = "werewolf";
        }
        interact(game, player, finished) {
            let message = "";
            let actions = [];
            let wolfList = game.players.filter(p => p.user.id != player.user.id)
                                       .filter(p => p.card.type == "werewolf")
                                       .map(p => ({user: p.user, type: p.card.role}));
            if (wolfList.length == 0) {
                message = "As mystic wolf, you would normally be able to examine the card of any non-wolf player.\n"+
                          "This time, though, there aren't any other werewolves in the game.";
            } else if (wolfList.length == 1) {
                message = "As mystic wolf, you may examine the card of any non-wolf player.\n"+
                          "The other werewolf in this game is "+bf.userToNick(wolfList[0].user, game.guild, "username")+" ("+wolfList[0].type+").";
            }else {
                message = "As mystic wolf, you may examine the card of any non-wolf player.\n"+
                          "The other werewolves in this game are "+cf.listify(wolfList.map(i => i.username+" ("+i.type+")"))+".";
            }
            let wolfPlays = game.players.filter(p => p.card.type == "werewolf");
            let info = game.getPlayerMenu([wolfPlays], function(msg, emoji, user) {
                let chosen = info.sorted[parseInt(emoji.name.replace(/^bn_([0-9]+)$/, "$1"))-1];
                    bf.sendMessage(msg.channel, `${chosen.user.username}'s card is ${chosen.card.role}.`);
                    game.addToLog(player.user, player.card.role, `Looked at ${chosen.user.username}'s card: ${chosen.card.role}`);
                    finished();
            });
            message += "\n\nChoose a player to examine the card of.\n"+info.list.join("\n");
            actions = info.actions.concat([{emoji: bf.buttons["times"], ignore: "total", actionType: "js", actionData: function(msg, emoji, user) {
                bf.sendMessage(msg.channel, "And yet, for all your pretentions at mysticism, you remain blinded by your own wilful ignorance.");
                finished();
            }}]);
            return {message: message, actions: actions};
        }
    }
    class ApprenticeSeer extends Card {
        constructor() {
            super("apprentice seer", new VillageTeam());
            this.order = 1;
        }
        interact(game, player, finished) {
            let message = "As apprentice seer, you may examine a single centre card.";
            function actionManager(msg, emoji, user) {
                let button = parseInt(emoji.name.replace(/^bn_([0-9])$/, "$1"));
                if (game.centreCards[button-1]) {
                    bf.sendMessage(msg.channel, `Centre card #${button} is ${game.centreCards[button-1].role}.`);
                    game.addToLog(player.user, player.card.role, "Looked at centre card #"+button);
                } else {
                    bf.sendMessage(msg.channel, "It is said that those with limited sight gain a profound appreciation for what sight they do indeed have.\n"+
                                                "Your stunning ineptitude is manifest evidence to the contrary. You'll never become a real seer at this rate!");
                }
                finished();
            }
            let actions = [
                {emoji: bf.buttons["1"], ignore: "total", actionType: "js", actionData: actionManager},
                {emoji: bf.buttons["2"], ignore: "total", actionType: "js", actionData: actionManager},
                {emoji: bf.buttons["3"], ignore: "total", actionType: "js", actionData: actionManager},
                {emoji: bf.buttons["times"], ignore: "total", actionType: "js", actionData: actionManager},
            ];
            return {message: message, actions: actions};
        }
    }
    class Tanner extends Card {
        constructor() {
            super("tanner", new TannerTeam());
            this.order = 1;
        }
        interact(game, player, finished) {
            let message = "As tanner, your objective is to kill yourself.";
            let actions = [
                {emoji: bf.buttons["tick"], ignore: "total", actionType: "js", actionData: finished}
            ];
            return {message: message, actions: actions};
        }
    }
    const cardSets = {
        2: [new Werewolf(), new Werewolf(), new Werewolf(), new Werewolf(), new Werewolf()],
        3: [new Robber(), new Troublemaker(), new Insomniac(), new Seer(), new Drunk(), new DreamWolf()],
        4: [new Robber(), new Troublemaker(), new Insomniac(), new Tanner(), new Drunk(), new Tanner(), new Seer],
        5: [new Werewolf(), new MysticWolf(), new Insomniac(), new Robber(), new Seer(), new Troublemaker(), new Mason(), new Mason()],
        6: [new Werewolf(), new Werewolf(), new DreamWolf(), new Robber(), new Seer(), new Troublemaker(), new Mason(), new Mason(), new Drunk()]
    };
    Object.keys(cardSets).filter(n => cardSets[n].length-3 != n).forEach(n => {
        cf.log("ONUW role set "+n+" does not have the correct array length.", "error");
        bf.onBotConnect(() => {
            bf.sendMessage("244613376360054794", "ONUW role set "+n+" does not have the correct array length.");
        });
    });
    class Game {
        constructor(channel) { // Set up new game
            this.players = [];
            this.centreCards;
            this.guild = channel.guild;
            this.channel = channel;
            this.phase = "not started"; // "night", "day", "voting"
            this.timer = {time: 300000, strict: false};
            this.progressCount = 0;
            this.pendingActions = [];
            this.actionLog = "";
            this.lastActive = Date.now();
            this.startedAt;
        }
        // Return a list of the players in the game
        getPlayerMenu(excludeIDs, actionData, ignore) {
            if (!ignore) ignore = "total";
            let info = {};
            info.sorted = this.players.filter(p => !excludeIDs.includes(p.user.id))
                                      .sort((a,b) => (bf.userToNick(a.user, this.guild, "username") > bf.userToNick(b.user, this.guild, "username") ? 1 : -1));
            info.list = info.sorted.map((p,i) => `${bf.buttons[i+1+""]} ${bf.userToNick(p.user, this.guild, "username")}`);
            info.actions = info.sorted.map((p,i) => ({emoji: bf.buttons[i+1+""], ignore: ignore, actionType: "js", actionData: actionData}));
            //info.buttons = Object.keys({...[...new Array(5)]}).map(i => bf.buttons[parseInt(i)+1+""]);
            //info.IDs = info.sorted.map(p => p.userID);
            return info;
        }
        // Given a userID, return the player object.
        getPlayerByID(userID) {
            let players = this.players.filter(p => p.user.id == userID);
            if (players.length == 0) {
                return null;
            } else {
                return players[0];
            }
        }
        // Add or remove from a player to or from the game
        addOrRemove(user) {
            if (this.getPlayerByID(user.id)) { // Player already added
                this.players = this.players.filter(p => p.user.id != user.id);
                return "removed";
            } else { // Player not yet added
                this.players.push(new Player(user));
                return "added";
            }
        }
        // Put three cards into the centre
        setUpCentreCards(cards) {
            this.centreCards = [];
            while (this.centreCards.length < 3) {
                this.centreCards.push(cards.splice(cf.rint(0, cards.length-1), 1)[0]);
            }
            return cards;
        }
        // Add an item to the log
        addToLog(item) {
            if (this.actionLog.length > 0) this.actionLog += "\n";
            this.actionLog += "item";
        }
        // Check if the game is actively being played
        isActive() {
            let inactiveFor = Date.now()-this.lastActive;
            let expiry = 180000;
            let result = false;
            switch (this.phase) {
            case "day":
                result = (inactiveFor < (this.timer || 450000) + expiry);
                break;
            default:
                result = (inactiveFor < expiry);
            }
        }
    }
    class Player {
        constructor(user) {
            this.user = user;
            this.card = undefined;
            this.originalCard = undefined;
            this.votesFor = 0;
            this.interacted = false;
            this.alive = true;
        }
        // Swap cards with another player.
        exchangeCard(player) {
            let t = this.card;
            this.card = player.card;
            player.card = t;
            return this.card;
        }
        // Take a random card from the presented choices and return the others.
        takeRandomCard(cards) {
            let card = cf.rint(0, cards.length-1);
            this.card = cards.splice(cf.rint(0, cards.length-1), 1)[0];
            this.originalCard = this.card;
            return cards;
        }
        // Send the interaction menu DM to the player.
        sendInteractMenu(game, channel, finished) {
            let menu = this.card.interact(game, this, finished);
            bf.reactionMenu(this.user, "Your card is "+this.card.role+".\n"+menu.message, menu.actions);
        }
        // Vote for whomst to kill.
        startVoting(game, finished) {
            let info = game.getPlayerMenu([], function(msg, emoji, user) {
                let chosen = info.sorted[parseInt(emoji.name.replace(/^bn_([0-9]+)$/, "$1"))-1];
                chosen.votesFor++;
                bf.sendMessage(msg.channel, "You voted for "+chosen.user.username+".");
                finished();
            });
            bf.reactionMenu(this.user, "Choose a user to vote for.\n"+info.list.join("\n"), info.actions);
        }
    }
    function updateLastCheckMessage(channel, message) {
        if (lastCheckMessage[channel.id]) lastCheckMessage[channel.id].delete();
        lastCheckMessage[channel.id] = message;
    }
    let availableFunctions = {
        onuw: {
            aliases: ["onuw", "wwg", "werewolf"],
            shortHelp: "Play One Night Ultimate Werewolf",
            reference: "",
            longHelp: "",
            eris: true,
            code: function(msg, command) {
                if (bf.isDMChannel(msg.channel)) {
                    bf.sendMessage(msg.channel, "You cannot use these commands in a direct message.");
                    return;
                }
                if (["new", "start", "join"].some(w => command.input.toLowerCase().includes(w))) {
                    startNewGame();
                } else if (["check", "info", "detail"].some(w => command.input.toLowerCase().includes(w))) {
                    check(msg.channel);
                } else if (["timer", "time"].some(w => command.input.toLowerCase().includes(w))) {
                    let game = games.find(g => g.channel.id == msg.channel.id);
                    if (game) {
                        let time = command.switches.time || command.switches.timer || command.switches.minutes || 0;
                        let strict;
                        if (command.flags.on.includes("strict")) strict = "on";
                        if (command.flags.off.includes("strict")) strict = "off";
                        if (!parseInt(time)) {
                            bf.sendMessage(msg.channel, `The correct syntax is **${command.prefix}${command.name} timer time=*minutes* ±strict**.`);
                            return;
                        }
                        game.timer.time = parseInt(time)*60000;
                        if (strict == "on") game.timer.strict = true;
                        if (strict == "off") game.timer.strict = false;
                        let output = `The timer has been set to ${time} ${cf.plural("minute", time)}`;
                        if (strict) {
                            output += " and strict mode has been turned "+strict+".";
                        } else {
                            output += ".";
                        }
                        bf.sendMessage(msg.channel, output).then(msg => updateLastCheckMessage(msg.channel, msg));
                    } else {
                        bf.sendMessage(msg.channel, "There is no ongoing game in this channel.").then(msg => updateLastCheckMessage(msg.channel, msg));
                    }
                } else if (["end", "stop", "quit", "vote"].some(w => command.input.toLowerCase().includes(w))) {
                    endGame();
                } else if (["reset", "erase", "delete"].some(w => command.input.toLowerCase().includes(w))) {
                    if (games.some(g => g.channel.id == msg.channel.id)) {
                        games = games.filter(g => g.channel.id != msg.channel.id);
                        bf.sendMessage(msg.channel, "The game in this channel was reset.");
                    } else {
                        games = [];
                        bf.sendMessage(msg.channel, "All games were reset.");
                    }
                } else {
                    if (games.some(g => g.channel.id == msg.channel.id)) {
                        check(msg.channel);
                    } else {
                        startNewGame();
                    }
                    //bf.sendMessage(channelID, "Incorrect command usage.", {mention: userID});
                }
                function check(channel) {
                    let game = games.find(g => g.channel.id == channel.id);
                    if (game) {
                        bf.sendMessage(channel, "**Current ONUW game details**\n"+
                            "**Players**: "+cf.listify(game.players.map(p => p.user.username).sort(), "nobody")+"\n"+
                            "**Cards**: "+cf.listify((cardSets[game.players.length] || []).map(c => c.role), "N/A")+"\n"+
                            "**Timer**: "+(game.phase == "day" ? (game.timer.time ? (game.timer.time-Date.now()+game.startedAt >= 0 ? (Math.floor((game.timer.time-Date.now()+game.startedAt)/60000)+":"+(Math.floor((game.timer.time-Date.now()+game.startedAt)/1000%60)+"").padStart(2, "0")+" remaining") : "expired!") : "off") : (game.timer.time ? parseInt((game.timer.time/60000).toFixed(2))+" "+cf.plural("minute", game.timer.time/60000)+", "+(game.timer.strict ? "strict" : "not strict") : "off")))
                        .then(msg => updateLastCheckMessage(msg.channel, msg));
                    } else {
                        bf.sendMessage(channel, "There is no ongoing game in this channel.").then(msg => updateLastCheckMessage(msg.channel, msg));
                    }
                }
                function startNewGame(users) {
                    if (!users) users = [];
                    if (games.some(g => g.channel.id == msg.channel.id)) {
                        bf.sendMessage(msg.channel, "There is already an ongoing game in this channel. Why not join in?");
                        return;
                    }
                    let game = new Game(msg.channel);
                    games.push(game);
                    users.forEach(u => game.addOrRemove(u));
                    let template = "**One Night Ultimate Werewolf**\n";
                    let id;
                    bf.reactionMenu(msg.channel, template+"Current players (**"+game.players.length+"**): "+cf.listify(game.players.map(p => "<@"+p.user.id+">"), "nobody"), [
                        {emoji: bf.buttons["plusminus"], remove: "user", actionType: "js", actionData: function(msg, emoji, user) {
                            game.addOrRemove(user);
                            game.lastActive = Date.now();
                            //game.addOrRemove("359203132980461568");
                            bf.editMessage(msg, template+"Current players (**"+game.players.length+"**): "+cf.listify(game.players.map(p => "<@"+p.user.id+">"), "nobody"));
                        }},
                        {emoji: bf.buttons["question"], remove: "user", actionType: "js", actionData: function(msg, emoji, user) {
                            check(msg.channel);
                        }},
                        {emoji: bf.buttons["clock"], remove: "user", actionType: "js", actionData: function(msg, emoji, user) {
                            if (game.timer == 0) {
                                game.timer = 300000;
                            } else {
                                game.timer = 0;
                            }
                            bf.sendMessage(msg.channel, `The game timer has been turned ${game.timer ? "on" : "off"}. Use **${command.prefix}${command.name} timer time=*minutes* ±strict** to adjust the length and strict game ending more precisely.`)
                            .then(msg => updateLastCheckMessage(msg.channel, msg));
                        }},
                        {emoji: bf.buttons["tick"], remove: "user", allowedUsers: [msg.author.id], actionType: "js", actionData: function(msg, emoji, user) {
                            if (cardSets[game.players.length]) {
                                //bot.deleteMessage({channelID: game.channelID, messageID: id});
                                msg.removeReactions();
                                game.phase = "night";
                                let cards = [...cardSets[game.players.length]];
                                game.players.forEach(p => {
                                    p.takeRandomCard(cards);
                                });
                                game.setUpCentreCards(cards);
                                let interactMessage;
                                game.players.forEach(p => {
                                    //bot.mute({userID: p.userID, serverID: game.serverID});
                                    p.sendInteractMenu(game, msg.channel, function(order, code) {
                                        p.interacted = true;
                                        if (typeof(order) == "number" && code) game.pendingActions.push({order: order, code: code});
                                        if (++game.progressCount == game.players.length) {
                                            game.pendingActions.sort((a,b) => a.order-b.order).forEach(a => {
                                                a.code();
                                            });
                                            game.pendingActions.length = 0;
                                            game.phase = "day";
                                            interactMessage.delete();
                                            //game.players.forEach(p => bot.unmute({userID: p.userID, serverID: game.serverID}));
                                            const timeLimits = [
                                                {before: 0, message: "**Time's up!**\n"+game.players.map(p => p.user.mention).join(" ")},
                                                {before: 30000, message: "30 seconds remaining!"},
                                                {before: 60000, message: "1 minute remaining."}
                                            ];
                                            let lastTimerMessage;
                                            if (game.timer.time) {
                                                timeLimits.forEach((l,i) => {
                                                    if (game.timer.time > l.before) {
                                                        setTimeout(function() {
                                                            if (game.phase == "day") {
                                                                if (lastTimerMessage) lastTimerMessage.delete();
                                                                bf.sendMessage(msg.channel, l.message).then(msg => lastTimerMessage = msg);
                                                                if (i == 0 && game.timer.strict) endGame();
                                                            }
                                                        }, game.timer.time-l.before);
                                                    }
                                                });
                                                bf.sendMessage(msg.channel, "Everyone has interacted and the game timer has started.");
                                            } else {
                                                bf.sendMessage(msg.channel, "Everyone has interacted.");
                                            }
                                            game.lastActive = Date.now();
                                            game.startedAt = Date.now();
                                        } else {
                                            showInteractions();
                                        }
                                    });
                                });
                                bf.sendMessage(msg.channel, "Please wait...").then(msg => {
                                    interactMessage = msg;
                                    showInteractions();
                                });
                                function showInteractions() {
                                    let template = "**Players who have not finished interacting:**\n";
                                    bf.editMessage(interactMessage, template+game.players.filter(p => !p.interacted).map(p => "<@"+p.user.id+">").join("\n"));
                                }
                            } else {
                                bf.sendMessage(msg.channel, `You cannot start the game with ${game.players.length} ${cf.plural("player", game.players.length)}.`);
                                //games = games.filter(g => g.channelID != game.channelID);
                            }
                        }}
                    ], (e,r) => {id = r});
                }
                function endGame() {
                    let game = games.find(g => g.channel.id == msg.channel.id);
                    if (!game) {
                        bf.sendMessage(msg.channel, "There is no game in progress. Why not start a new one?");
                        return;
                    }
                    if (game.phase != "day") {
                        bf.sendMessage(msg.channel, "The current game is not in a valid state to be stopped.");
                        return;
                    }
                    bf.sendMessage(msg.channel, "The voting phase has started.");
                    game.phase = "voting";
                    game.lastActive = Date.now();
                    game.players.forEach(p => {
                        //bot.mute({userID: p.userID, serverID: game.serverID});
                        p.startVoting(game, function() {
                            let votesUsed = 0;
                            game.players.forEach(p => votesUsed += p.votesFor);
                            if (votesUsed == game.players.length) {
                                let sortedPlayers = game.players.sort((a,b) => (b.votesFor-a.votesFor));
                                let deadPlayers = (sortedPlayers[0].votesFor != 1 ? sortedPlayers.filter(p => p.votesFor == sortedPlayers[0].votesFor) : []);
                                deadPlayers.forEach(p => p.alive = false);
                                //let includedTeams = [];
                                let teamStatus = {all: []};
                                sortedPlayers.forEach(p => {
                                    //if (!includedTeams.map(t => t.name).includes(p.card.team.name)) includedTeams.push(p.card.team);
                                    teamStatus[p.card.team.name] = teamStatus[p.card.team.name] || [];
                                    teamStatus[p.card.team.name].push(deadPlayers.map(p => p.user.id).includes(p.user.id) ? "dead" : "alive");
                                    teamStatus["all"].push(deadPlayers.map(p => p.user.id).includes(p.user.id) ? "dead" : "alive");
                                });
                                bf.reactionMenu(msg.channel,
                                    "**The vote results are in!**\n"+
                                    "Here are all the players, in order of votes:\n"+
                                    sortedPlayers.map(p => (p.card.team.isWinner(game, teamStatus, p) ? "🏆" : "🥔")+
                                                           (deadPlayers.map(p => p.user.id).includes(p.user.id) ? "💀" : "❤")+" "+
                                    `**${p.votesFor}**: ${p.user.mention} (${p.originalCard.role} → ${p.card.role})`).join("\n")+"\n\n"+
                                    "Use the buttons to view more info or to start a new game.",
                                    //"Here are all the players that died:\n"+
                                    //cf.listify(deadPlayers.map(p => bot.users.get(p.userID).username), "Nobody (because everyone received exactly one vote).")+"\n"+
                                    //"Here is the result of all the teams:\n"+
                                    //includedTeams.map(t => `${t.name}
                                    [
                                        {emoji: bf.buttons["info"], ignore: "none", remove: "user", actionType: "js", actionData: function() {
                                            //TODO make the info button do something
                                        }},
                                        {emoji: bf.buttons["redo"], allowedUsers: game.players.map(p => p.user.id), ignore: "total", remove: "all", actionType: "js", actionData: function() {
                                            startNewGame(game.players.map(p => p.user));
                                        }}
                                    ]);
                                games = games.filter(g => g.channel.id != game.channel.id);
                                //game.players.forEach(p => bot.unmute({userID: p.userID, serverID: game.serverID}));
                            }
                        });
                    });
                }
            }
        }
    }
    setTimeout(function() {
        games = games.filter(g => !g.isActive());
    }, 15000);
    return availableFunctions;
}
