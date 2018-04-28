module.exports = function(input) {
    //TODO Add minion, only starter can start, wolf card "type", custom role sets, randomly pick from too large role sets
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
        isWinner(game, teamStatus) {
            if (teamStatus["tanner"].every(s => s == "dead")) {
                return true;
            } else {
                return false;
            }
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
        }
        interact(game, player, finished) {
            let message = "";
            let actions = [];
            let wolfList = game.players.filter(p => p.userID != player.userID)
                                       .filter(p => ["werewolf", "dream wolf", "mystic wolf"].includes(p.card.role))
                                       .map(p => ({userID: p.userID, type: p.card.role}));
            if (wolfList.length == 0) {
                message = "There are no other werewolves in this game.\n"+
                          "As the lone wolf, you may look at a centre card by pressing a reaction.";
                function actionManager(event) {
                    let button = parseInt(event.d.emoji.name.replace(/^bn_([0-9])$/, "$1"));
                    if (game.centreCards[button-1]) {
                        bf.sendMessage(event.d.channel_id, `Centre card #${button} is ${game.centreCards[button-1].role}.`);
                        game.addToLog(player.userID, player.card.role, "Looked at centre card #"+button);
                    } else {
                        bf.sendMessage(event.d.channel_id, "You decided not to look at a centre card for no reason.");
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
                message = "The other werewolf in this game is "+bf.userIDToNick(wolfList[0].userID, game.serverID, "username")+" ("+wolfList[0].type+").";
                actions = [
                    {emoji: bf.buttons["tick"], ignore: "total", actionType: "js", actionData: finished}
                ];
            } else {
                message = "The other werewolves in this game are "+cf.listify(wolfList.map(i => bot.users.get(i.userID).username+" ("+i.type+")"))+".";
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
                {emoji: bf.buttons["person"], ignore: "total", actionType: "js", actionData: function(event) {
                    let info = game.getPlayerMenu([player.userID]);
                    function actionManager(event) {
                        let chosen = info.sorted[parseInt(event.d.emoji.name.replace(/^bn_([0-9]+)$/, "$1"))-1];
                        bf.sendMessage(event.d.channel_id, `${bot.users.get(chosen.userID).username}'s card is ${chosen.card.role}.`);
                        game.addToLog(player.userID, player.card.role, `Looked at ${bot.users.get(chosen.userID).username}'s card: ${chosen.card.role}`);
                        finished();
                    }
                    bf.reactionMenu(event.d.channel_id, "Choose a player.\n"+info.list.join("\n"),
                        info.sorted.map((p,i) => ({emoji: bf.buttons[i+1+""], ignore: "total", actionType: "js", actionData: actionManager})));
                }},
                {emoji: bf.buttons["cards"], ignore: "total", actionType: "js", actionData: function(event) {
                    let seenCards = [];
                    function actionManager(event) {
                        if (seenCards.length >= 2) {
                            bf.sendMessage(event.d.channel_id, "You may not look at any more cards.");
                        } else {
                            let button = parseInt(event.d.emoji.name.replace(/^bn_([0-9])$/, "$1"));
                            bf.sendMessage(event.d.channel_id, `Centre card #${button} is ${game.centreCards[button-1].role}.`);
                            seenCards.push(button);
                            if (seenCards.length == 2) {
                                seenCards = seenCards.sort();
                                game.addToLog(player.userID, player.card.role, `Looked at centre cards ${cf.listify(seenCards.map(n => "#"+n))}`);
                                finished();
                            }
                        }
                    }
                    bf.reactionMenu(event.d.channel_id, "Choose two centre cards.", [
                        {emoji: bf.buttons["1"], ignore: "that", actionType: "js", actionData: actionManager},
                        {emoji: bf.buttons["2"], ignore: "that", actionType: "js", actionData: actionManager},
                        {emoji: bf.buttons["3"], ignore: "that", actionType: "js", actionData: actionManager}
                    ]);
                }},
                {emoji: bf.buttons["times"], ignore: "total", actionType: "js", actionData: function(event) {
                    bf.sendMessage(event.d.channel_id, "You decided not to look at any cards for no reason.");
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
            let info = game.getPlayerMenu([player.userID], (event) => {
                let chosen = info.sorted[parseInt(event.d.emoji.name.replace(/^bn_([0-9]+)$/, "$1"))-1];
                bf.sendMessage(event.d.channel_id, "You stole and became a "+chosen.card.role+".");
                finished(this.order, function() {
                    game.addToLog(player.userID, player.card.role, `Stole ${bot.users.get(chosen.userID).username}'s ${chosen.card.role}`);
                    let newCard = player.exchangeCard(chosen);
                });
            });
            message += info.list.join("\n");
            let actions = info.actions.concat([{emoji: bf.buttons["times"], ignore: "total", actionType: "js", actionData: function(event) {
                bf.sendMessage(event.d.channel_id, "You decided not to steal from anybody. What a nice person you must be!!");
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
            let info = game.getPlayerMenu([player.userID], (event) => {
                // Enough players, get two and execute the swap
                let chosen = info.sorted[parseInt(event.d.emoji.name.replace(/^bn_([0-9]+)$/, "$1"))-1];
                clickCount++;
                if (!previouslyClicked) {
                    previouslyClicked = chosen;
                    bf.sendMessage(event.d.channel_id, bot.users.get(previouslyClicked.userID).username+"'s card will be swapped with...", function(e,id) {
                        previousMessageID = id;
                    });
                } else if (previouslyClicked.userID == chosen.userID) {
                    clickCount--;
                } else if (clickCount == 2) {
                    let message = bot.users.get(previouslyClicked.userID).username+"'s card has been swapped with "+bot.users.get(chosen.userID).username+"'s card.";
                    if (previousMessageID) {
                        bf.editMessage(event.d.channel_id, previousMessageID, message, function(e) {
                            if (e) {
                                bf.sendMessage(event.d.channel_id, message);
                            }
                        });
                    } else {
                        bf.sendMessage(event.d.channel_id, message);
                    }
                    finished(this.order, function() {
                        game.addToLog(player.userID, player.card.role, `Swapped ${bot.users.get(previouslyClicked.userID).username}'s ${previouslyClicked.card.role} with ${bot.users.get(chosen.userID).username}'s ${chosen.card.role}`);
                        chosen.exchangeCard(previouslyClicked);
                    });
                } else {
                    bf.sendMessage(event.d.channel_id, "You have already completed your action.");
                }
            }, "this");
            if (info.sorted.length < 2) {
                message += "Unfortunately, there aren't enough players in this game for you to do that.";
                actions = [{emoji: bf.buttons["tick"], ignore: "total", actionType: "js", actionData: finished}];
            } else {
                message += "Choose the two players that you would like to swap.\n"+info.list.join("\n");
                actions = info.actions.concat([{emoji: bf.buttons["times"], ignore: "total", actionType: "js", actionData: function(event) {
                    bf.sendMessage(event.d.channel_id, "You decided not swap any cards. Your loss.");
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
            let masonList = game.players.filter(p => p.userID != player.userID)
                                       .filter(p => p.card.role == "mason")
                                       .map(p => p.userID);
            if (masonList.length == 0) {
                message += "Nevermind, there aren't any others.";
            } else if (masonList.length == 1) {
                message += "The other mason in this game is "+bf.userIDToNick(masonList[0], game.serverID, "username")+".";
            } else {
                message += "The other masons in this game are "+cf.listify(masonList.map(i => bot.users.get(i).username))+".";
            }
            actions = [{emoji: bf.buttons["tick"], ignore: "total", actionType: "js", actionData: finished}];
            return {message: message, actions: actions};
        }
    }
    class DreamWolf extends Card {
        constructor() {
            super("dream wolf", new WerewolfTeam());
            this.order = 1;
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
                        bf.sendMessage(player.userID, "You are now "+cf.indefArtify(player.card.role)+".");
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
            let actionManager = (event) => {
                let button = parseInt(event.d.emoji.name.replace(/^bn_([0-9])$/, "$1"));
                bf.sendMessage(event.d.channel_id, `Your card has been swapped with centre card #${button}.`);
                finished(this.order, function() {
                    game.addToLog(player.userID, player.card.role, "Became centre card #"+button);
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
        }
        interact(game, player, finished) {
            let message = "";
            let actions = [];
            let wolfList = game.players.filter(p => p.userID != player.userID)
                                       .filter(p => ["werewolf", "dream wolf", "mystic wolf"].includes(p.card.role))
                                       .map(p => ({userID: p.userID, type: p.card.role}));
            if (wolfList.length == 0) {
                message = "As mystic wolf, you may examine the card of any non-wolf player.\n"+
                          "There are no other werewolves in this game.";
            } else if (wolfList.length == 1) {
                message = "As mystic wolf, you may examine the card of any non-wolf player.\n"+
                          "The other werewolf in this game is "+bf.userIDToNick(wolfList[0].userID, game.serverID, "username")+" ("+wolfList[0].type+").";
            }else {
                message = "As mystic wolf, you may examine the card of any non-wolf player.\n"+
                          "The other werewolves in this game are "+cf.listify(wolfList.map(i => bot.users.get(i.userID).username+" ("+i.type+")"))+".";
            }
            let wolfPlays = game.players.filter(p => ["werewolf", "dream wolf", "mystic wolf"].includes(p.card.role));
            let info = game.getPlayerMenu([wolfPlays], function(event) {
                let chosen = info.sorted[parseInt(event.d.emoji.name.replace(/^bn_([0-9]+)$/, "$1"))-1];
                    bf.sendMessage(event.d.channel_id, `${bot.users.get(chosen.userID).username}'s card is ${chosen.card.role}.`);
                    game.addToLog(player.userID, player.card.role, `Looked at ${bot.users.get(chosen.userID).username}'s card: ${chosen.card.role}`);
                    finished();
            });
            message += "\nChoose a player to examine the card of.\n"+info.list.join("\n");
            actions = info.actions.concat([{emoji: bf.buttons["times"], ignore: "total", actionType: "js", actionData: function(event) {
                bf.sendMessage(event.d.channel_id, "And yet, for all your pretentions at mysticism, you remain blinded by your own wilful ignorance.");
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
            function actionManager(event) {
                let button = parseInt(event.d.emoji.name.replace(/^bn_([0-9])$/, "$1"));
                if (game.centreCards[button-1]) {
                    bf.sendMessage(event.d.channel_id, `Centre card #${button} is ${game.centreCards[button-1].role}.`);
                    game.addToLog(player.userID, player.card.role, "Looked at centre card #"+button);
                } else {
                    bf.sendMessage(event.d.channel_id, "It is said that those with limited sight gain a profound appreciation for what sight they do indeed have.\n"+
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
        2: [new Drunk(), new Drunk(), new Drunk(), new Villager(), new Villager()],
        3: [new Robber(), new Troublemaker(), new Insomniac(), new Seer(), new Drunk(), new DreamWolf()],
        4: [new Robber(), new Troublemaker(), new Insomniac(), new Tanner(), new Drunk(), new Tanner(), new Seer],
        5: [new Werewolf(), new MysticWolf(), new Insomniac(), new Robber(), new Seer(), new Troublemaker(), new Mason(), new Mason()],
        6: [new Werewolf(), new Werewolf(), new DreamWolf(), new Robber(), new Seer(), new Troublemaker(), new Mason(), new Mason(), new Drunk()]
    };
    Object.keys(cardSets).filter(n => cardSets[n].length-3 != n).forEach(n => {
        cf.log("ONUW role set "+n+" does not have the correct array length.", "error");
        if (bot.startTime) {
            bf.sendMessage("244613376360054794", "ONUW role set "+n+" does not have the correct array length.");
        }
    });
    class Game {
        constructor(channelID) { // Set up new game
            this.players = [];
            this.centreCards;
            this.serverID = bot.channelGuildMap[channelID];
            this.channelID = channelID;
            this.phase = "not started"; // "night", "day", "voting"
            this.timer = {time: 300000, strict: false};
            this.progressCount = 0;
            this.pendingActions = [];
            this.actionLog = "";
            this.lastActive = Date.now();
            this.startedAt;
        }
        // Return a list of the players in the game
        getPlayerMenu(exclude, actionData, ignore) {
            if (!ignore) ignore = "total";
            let info = {};
            info.sorted = this.players.filter(p => !exclude.includes(p.userID))
                                      .sort((a,b) => (bf.userIDToNick(a.userID, this.serverID, "username") > bf.userIDToNick(b.userID, this.serverID, "username") ? 1 : -1));
            info.list = info.sorted.map((p,i) => `${bf.buttons[i+1+""]} ${bf.userIDToNick(p.userID, this.serverID, "username")}`);
            info.actions = info.sorted.map((p,i) => ({emoji: bf.buttons[i+1+""], ignore: ignore, actionType: "js", actionData: actionData}));
            //info.buttons = Object.keys({...[...new Array(5)]}).map(i => bf.buttons[parseInt(i)+1+""]);
            //info.IDs = info.sorted.map(p => p.userID);
            return info;
        }
        // Given a userID, return the player object.
        getPlayerByID(userID) {
            let players = this.players.filter(p => p.userID==userID);
            if (players.length == 0) {
                return null;
            } else {
                return players[0];
            }
        }
        // Add or remove from a player to or from the game
        addOrRemove(userID) {
            if (this.getPlayerByID(userID)) { // Player already added
                this.players = this.players.filter(p => p.userID!=userID);
                return "removed";
            } else { // Player not yet added
                this.players.push(new Player(userID));
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
        constructor(userID) {
            this.userID = userID;
            this.card = undefined;
            this.originalCard = undefined;
            this.votesFor = 0;
            this.interacted = false;
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
        sendInteractMenu(game, channelID, finished) {
            let menu = this.card.interact(game, this, finished);
            bf.reactionMenu(this.userID, "Your card is "+this.card.role+".\n"+menu.message, menu.actions);
        }
        // Vote for whomst to kill.
        startVoting(game, finished) {
            let info = game.getPlayerMenu([], function(event) {
                let chosen = info.sorted[parseInt(event.d.emoji.name.replace(/^bn_([0-9]+)$/, "$1"))-1];
                chosen.votesFor++;
                bf.sendMessage(event.d.channel_id, "You voted for "+bot.users.get(chosen.userID).username+".");
                finished();
            });
            bf.reactionMenu(this.userID, "Choose a user to vote for.\n"+info.list.join("\n"), info.actions);
        }
    }
    let availableFunctions = {
        onuw: {
            aliases: ["onuw", "wwg", "werewolf"],
            shortHelp: "Play One Night Ultimate Werewolf",
            reference: "",
            longHelp: "",
            code: function(userID, channelID, command, d) {
                if (bot.isDMChannel(channelID)) {
                    bf.sendMessage(channelID, "You cannot use these commands in a direct message.");
                    return;
                }
                if (["new", "start", "join"].some(w => command.input.toLowerCase().includes(w))) {
                    startNewGame();
                } else if (["check", "info", "detail"].some(w => command.input.toLowerCase().includes(w))) {
                    check(channelID);
                } else if (["timer", "time"].some(w => command.input.toLowerCase().includes(w))) {
                    let game = games.filter(g => g.channelID == channelID)[0];
                    if (game) {
                        let time = command.switches.time || command.switches.timer || command.switches.minutes || 0;
                        let strict;
                        if (command.flags.on.includes("strict")) strict = "on";
                        if (command.flags.off.includes("strict")) strict = "off";
                        if (!parseInt(time)) {
                            bf.sendMessage(channelID, `The correct syntax is **${command.prefix}${command.name} timer time=*minutes* ±strict**.`);
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
                        bf.sendMessage(channelID, output,
                            function(e,id) {
                                if (id) lastCheckMessage[channelID] = id;
                            },
                            {mention: userID});
                    } else {
                        bf.sendMessage(channelID, "There is no ongoing game in this channel.",
                            function(e,id) {
                                if (id) lastCheckMessage[channelID] = id;
                            },
                            {mention: userID});
                    }
                    bot.deleteMessage({channelID: channelID, messageID: lastCheckMessage[channelID]});
                } else if (["end", "stop", "quit", "vote"].some(w => command.input.toLowerCase().includes(w))) {
                    endGame();
                } else if (["reset", "erase", "delete"].some(w => command.input.toLowerCase().includes(w))) {
                    if (games.some(g => g.channelID == channelID)) {
                        games = games.filter(g => g.channelID != channelID);
                        bf.sendMessage(channelID, "The game in this channel was reset.", {mention: userID});
                    } else {
                        games = [];
                        bf.sendMessage(channelID, "All games were reset.", {mention: userID});
                    }
                } else {
                    if (games.some(g => g.channelID == channelID)) {
                        check(channelID);
                    } else {
                        startNewGame();
                    }
                    //bf.sendMessage(channelID, "Incorrect command usage.", {mention: userID});
                }
                function check(channelID) {
                    let game = games.filter(g => g.channelID == channelID)[0];
                    if (game) {
                        bf.sendMessage(channelID, "**Current ONUW game details**\n"+
                            "**Players**: "+cf.listify(game.players.map(p => bot.users.get(p.userID).username).sort(), "nobody")+"\n"+
                            "**Cards**: "+cf.listify((cardSets[game.players.length] || []).map(c => c.role), "N/A")+"\n"+
                            "**Timer**: "+(game.phase == "day" ? (game.timer.time ? (game.timer.time-Date.now()+game.startedAt >= 0 ? (Math.floor((game.timer.time-Date.now()+game.startedAt)/60000)+":"+(Math.floor((game.timer.time-Date.now()+game.startedAt)/1000%60)+"").padStart(2, "0")+" remaining") : "expired!") : "off") : (game.timer.time ? parseInt((game.timer.time/60000).toFixed(2))+" "+cf.plural("minute", game.timer.time/60000)+", "+(game.timer.strict ? "strict" : "not strict") : "off")),
                            function(e,id) {
                                if (id) lastCheckMessage[channelID] = id;
                            },
                            {mention: userID});
                    } else {
                        bf.sendMessage(channelID, "There is no ongoing game in this channel.",
                            function(e,id) {
                                if (id) lastCheckMessage[channelID] = id;
                            },
                            {mention: userID});
                    }
                    bot.deleteMessage({channelID: channelID, messageID: lastCheckMessage[channelID]});
                }
                function startNewGame(players) {
                    if (!players) players = [];
                    if (games.some(g => g.channelID == channelID)) {
                        bf.sendMessage(channelID, "<@"+userID+"> There is already an ongoing game in this channel. Why not join in?");
                        return;
                    }
                    let game = new Game(channelID);
                    games.push(game);
                    players.forEach(p => game.addOrRemove(p));
                    let template = "**One Night Ultimate Werewolf**\n";
                    let id;
                    bf.reactionMenu(channelID, template+"Current players (**"+game.players.length+"**): "+cf.listify(game.players.map(p => "<@"+p.userID+">"), "nobody"), [
                        {emoji: bf.buttons["plusminus"], remove: "user", actionType: "js", actionData: function(event) {
                            game.addOrRemove(event.d.user_id);
                            game.lastActive = Date.now();
                            //game.addOrRemove("359203132980461568");
                            bf.editMessage(channelID, event.d.message_id, template+"Current players (**"+game.players.length+"**): "+cf.listify(game.players.map(p => "<@"+p.userID+">"), "nobody"));
                        }},
                        {emoji: bf.buttons["question"], remove: "user", actionType: "js", actionData: function(event) {
                            check(event.d.channel_id);
                        }},
                        {emoji: bf.buttons["clock"], remove: "user", actionType: "js", actionData: function(event) {
                            if (game.timer == 0) {
                                game.timer = 300000;
                            } else {
                                game.timer = 0;
                            }
                            bf.sendMessage(channelID, `The game timer has been turned ${game.timer ? "on" : "off"}. Use **${command.prefix}${command.name} timer time=*minutes* ±strict** to adjust the length and strict game ending more precisely.`,
                                function(e,id) {
                                    if (id) lastCheckMessage[channelID] = id;
                                },
                                {mention: event.d.user_id});
                            bot.deleteMessage({channelID: channelID, messageID: lastCheckMessage[channelID]});
                        }},
                        {emoji: bf.buttons["tick"], remove: "user", actionType: "js", actionData: function(event) {
                            if (cardSets[game.players.length]) {
                                //bot.deleteMessage({channelID: game.channelID, messageID: id});
                                bot.removeAllReactions({channelID: game.channelID, messageID: id});
                                game.phase = "night";
                                let cards = [...cardSets[game.players.length]];
                                game.players.forEach(p => {
                                    p.takeRandomCard(cards);
                                });
                                game.setUpCentreCards(cards);
                                let interactID;
                                game.players.forEach(p => {
                                    //bot.mute({userID: p.userID, serverID: game.serverID});
                                    p.sendInteractMenu(game, event.d.channel_id, function(order, code) {
                                        p.interacted = true;
                                        if (typeof(order) == "number" && code) game.pendingActions.push({order: order, code: code});
                                        if (++game.progressCount == game.players.length) {
                                            game.pendingActions.sort((a,b) => a.order-b.order).forEach(a => {
                                                a.code();
                                            });
                                            game.pendingActions.length = 0;
                                            game.phase = "day";
                                            bot.deleteMessage({channelID: game.channelID, messageID: interactID});
                                            //game.players.forEach(p => bot.unmute({userID: p.userID, serverID: game.serverID}));
                                            const timeLimits = [
                                                {before: 0, message: "**Time's up!** "+game.players.map(p => "<@"+p.userID+">")},
                                                {before: 30000, message: "30 seconds remaining!"},
                                                {before: 60000, message: "1 minute remaining."}
                                            ];
                                            let lastTimerID;
                                            if (game.timer.time) {
                                                timeLimits.forEach((l,i) => {
                                                    if (game.timer.time > l.before) {
                                                        setTimeout(function() {
                                                            if (game.phase == "day") {
                                                                bf.sendMessage(channelID, l.message,
                                                                    function(e,id) {
                                                                        lastTimerID = id;
                                                                    });
                                                                bot.deleteMessage({channelID: channelID, messageID: lastTimerID});
                                                                if (i == 0 && game.timer.strict) endGame();
                                                            }
                                                        }, game.timer.time-l.before);
                                                    }
                                                });
                                                bf.sendMessage(channelID, "Everyone has interacted and the game timer has started.");
                                            } else {
                                                bf.sendMessage(channelID, "Everyone has interacted.");
                                            }
                                            game.lastActive = Date.now();
                                            game.startedAt = Date.now();
                                        } else {
                                            showInteractions();
                                        }
                                    });
                                });
                                bf.sendMessage(channelID, "Please wait...", function(err, id) {
                                    interactID = id;
                                    showInteractions();
                                });
                                function showInteractions() {
                                    let template = "**Players who have not finished interacting:**\n";
                                    bf.editMessage(channelID, interactID, template+game.players.filter(p => !p.interacted).map(p => "<@"+p.userID+">").join("\n"));
                                }
                            } else {
                                bf.sendMessage(channelID, `<@${event.d.user_id}> You cannot start the game with ${game.players.length} ${cf.plural("player", game.players.length)}.`);
                                //games = games.filter(g => g.channelID != game.channelID);
                            }
                        }}
                    ], (e,r) => {id = r});
                }
                function endGame() {
                    let game = games.filter(g => g.channelID == channelID)[0];
                    if (!game) {
                        bf.sendMessage(channelID, "There is no game in progress. Why not start a new one?", {mention: userID});
                        return;
                    }
                    if (game.phase != "day") {
                        bf.sendMessage(channelID, "The current game is not in a valid state to be stopped.", {mention: userID});
                        return;
                    }
                    bf.sendMessage(channelID, "The voting phase has started.");
                    game.phase = "voting";
                    game.lastActive = Date.now();
                    game.players.forEach(p => {
                        bot.mute({userID: p.userID, serverID: game.serverID});
                        p.startVoting(game, function() {
                            let votesUsed = 0;
                            game.players.forEach(p => votesUsed += p.votesFor);
                            if (votesUsed == game.players.length) {
                                let sortedPlayers = game.players.sort((a,b) => (b.votesFor-a.votesFor));
                                let deadPlayers = (sortedPlayers[0].votesFor != 1 ? sortedPlayers.filter(p => p.votesFor == sortedPlayers[0].votesFor) : []);
                                //let includedTeams = [];
                                let teamStatus = {all: []};
                                sortedPlayers.forEach(p => {
                                    //if (!includedTeams.map(t => t.name).includes(p.card.team.name)) includedTeams.push(p.card.team);
                                    teamStatus[p.card.team.name] = teamStatus[p.card.team.name] || [];
                                    teamStatus[p.card.team.name].push(deadPlayers.map(p => p.userID).includes(p.userID) ? "dead" : "alive");
                                    teamStatus["all"].push(deadPlayers.map(p => p.userID).includes(p.userID) ? "dead" : "alive");
                                });
                                bf.reactionMenu(channelID,
                                    "**The vote results are in!**\n"+
                                    "Here are all the players, in order of votes:\n"+
                                    sortedPlayers.map(p => (p.card.team.isWinner(game, teamStatus) ? "🏆" : "🥔")+
                                                           (deadPlayers.map(p => p.userID).includes(p.userID) ? "💀" : "❤")+" "+
                                    `**${p.votesFor}**: <@${p.userID}> (${p.originalCard.role} → ${p.card.role})`).join("\n")+"\n\n"+
                                    "Use the buttons to view more info or to start a new game.",
                                    //"Here are all the players that died:\n"+
                                    //cf.listify(deadPlayers.map(p => bot.users.get(p.userID).username), "Nobody (because everyone received exactly one vote).")+"\n"+
                                    //"Here is the result of all the teams:\n"+
                                    //includedTeams.map(t => `${t.name}
                                    [
                                        {emoji: bf.buttons["info"], ignore: "none", remove: "user", actionType: "js", actionData: function() {
                                            //TODO
                                        }},
                                        {emoji: bf.buttons["redo"], allowedUsers: game.players.map(p => p.userID), ignore: "total", remove: "all", actionType: "js", actionData: function() {
                                            startNewGame(game.players.map(p => p.userID));
                                        }}
                                    ]);
                                games = games.filter(g => g.channelID != game.channelID);
                                game.players.forEach(p => bot.unmute({userID: p.userID, serverID: game.serverID}));
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
