module.exports = function(input) {
    let {bot, cf, bf, db} = input;
    let game;
    class Card {
        constructor(role, team) {
            this.role = role;
            this.team = team;
        }
    }
    class Villager extends Card {
        constructor() {
            super("villager");
        }
        interact(game, player, finished) {
            let message = "";
            let actions = [];
            message = "Villagers cannot do anything during the night.";
            finished();
            return {message: message, actions: actions};
        }
    }
    class Werewolf extends Card {
        constructor() {
            super("werewolf");
        }
        interact(game, player, finished) {
            let message = "";
            let actions = [];
            let wolfList = game.players.filter(p => p.userID != player.userID)
                                       .filter(p => p.card.role == "werewolf")
                                       .map(p => p.userID);
            if (wolfList.length == 0) {
                message = "There are no other werewolves in this game.\n"+
                          "As the lone wolf, you may look at a centre card by pressing a reaction.";
                function actionManager(event) {
                    let button = parseInt(event.d.emoji.name.replace(/^bn_([0-9])$/, "$1"));
                    if (game.centreCards[button-1]) {
                        bf.sendMessage(event.d.channel_id, `Centre card #${button} is ${game.centreCards[button-1].role}.`);
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
                message = "The other werewolf in this game is "+bf.userIDToNick(wolfList[0], game.serverID, "username")+".";
                finished();
            } else {
                message = "The other werewolves in this game are "+cf.listify(wolfList.map(i => bf.userIDToNick(i, game.serverID, "username")))+".";
                finished();
            }
            return {message: message, actions: actions};
        }
    }
    class Seer extends Card {
        constructor() {
            super("seer");
        }
        interact(game, player, finished) {
            let message = "As seer, you may examine either a single card of another player, or two cards from the centre.\n"+
                          "Click either the player or the cards reaction.";
            let actions = [
                {emoji: bf.buttons["person"], ignore: "total", actionType: "js", actionData: function(event) {
                    let info = game.getPlayerMenu([player.userID]);
                    function actionManager(event) {
                        let chosen = info.sorted[parseInt(event.d.emoji.name.replace(/^bn_([0-9]+)$/, "$1"))-1];
                        bf.sendMessage(event.d.channel_id, `${bot.users[chosen.userID].username}'s card is ${chosen.card.role}.`);
                        finished();
                    }
                    bf.reactionMenu(event.d.channel_id, "Choose a player.\n"+info.list.join("\n"),
                        info.sorted.map((p,i) => ({emoji: bf.buttons[i+1+""], ignore: "total", actionType: "js", actionData: actionManager})));
                }},
                {emoji: bf.buttons["cards"], ignore: "total", actionType: "js", actionData: function(event) {
                    let seenCount = 0;
                    function actionManager(event) {
                        if (seenCount >= 2) {
                            bf.sendMessage(event.d.channel_id, "You may not look at any more cards.");
                        } else {
                            let button = parseInt(event.d.emoji.name.replace(/^bn_([0-9])$/, "$1"));
                            bf.sendMessage(event.d.channel_id, `Centre card #${button} is ${game.centreCards[button-1].role}.`);
                            seenCount++;
                            if (seenCount == 2) finished();
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
            super("robber");
        }
        interact(game, player, finished) {
            let message = "As robber, you may steal a card from another player.\n"+
                          "Choose the player that you want to steal from.\n";
            let info = game.getPlayerMenu([player.userID], function(event) {
                let chosen = info.sorted[parseInt(event.d.emoji.name.replace(/^bn_([0-9]+)$/, "$1"))-1];
                let newCard = player.exchangeCard(chosen);
                bf.sendMessage(event.d.channel_id, "You stole and became a "+newCard.role+".");
                finished();
            });
            message += info.list;
            let actions = info.actions.concat([{emoji: bf.buttons["times"], ignore: "total", actionType: "js", actionData: function(event) {
                bf.sendMessage(event.d.channel_id, "You decided not to steal from anybody. What a nice person you must be!!");
                finished();
            }}]);
            return {message: message, actions: actions};
        }
    }
    const cardSets = {
        2: [new Robber(), new Seer(), new Werewolf(), new Robber(), new Robber()],
        3: [new Werewolf(), new Werewolf(), new Seer(), new Seer(), new Seer(), new Seer()]
    };
    Object.keys(cardSets).filter(n => cardSets[n].length-3 != n).forEach(n => {
        cf.log("ONUW role set "+n+" does not have the correct array length.", "error");
    });
    class Game {
        constructor(channelID) { // Set up new game
            this.players = [];
            this.centreCards;
            this.serverID = bot.channels[channelID].guild_id;
            this.channelID = channelID;
            this.phase = "not started"; // "night", "day", "voting"
            this.timer = {time: 0, strict: false};
            this.progressCount = 0;
        }
        // Return a list of the players in the game
        getPlayerMenu(exclude, actionData) {
            let info = {};
            info.sorted = this.players.filter(p => !exclude.includes(p.userID))
                                      .sort((a,b) => (bf.userIDToNick(a.userID, this.serverID, "username") > bf.userIDToNick(b.userID, this.serverID, "username") ? 1 : -1));
            info.list = info.sorted.map((p,i) => `${bf.buttons[i+1+""]} ${bf.userIDToNick(p.userID, this.serverID, "username")}`);
            info.actions = info.sorted.map((p,i) => ({emoji: bf.buttons[i+1+""], ignore: "total", actionType: "js", actionData: actionData}));
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
    }
    class Player {
        constructor(userID) {
            this.userID = userID;
            this.card = undefined;
        }
        // Swap cards with another player.
        exchangeCard(player) {
            let t = this.card;
            cf.log(player, "warning");
            this.card = player.card;
            player.card = t;
            return this.card;
        }
        // Take a random card from the presented choices and return the others.
        takeRandomCard(cards) {
            let card = cf.rint(0, cards.length-1);
            this.card = cards.splice(cf.rint(0, cards.length-1), 1)[0];
            return cards;
        }
        // Send the interaction menu DM to the player.
        sendInteractMenu(game, channelID, finished) {
            let menu = this.card.interact(game, this, finished);
            cf.log(menu.actions, "error");
            bf.reactionMenu(this.userID, "Your card is "+this.card.role+".\n"+menu.message, menu.actions);
        }
    }
    let availableFunctions = {
        onuw: {
            aliases: ["onuw", "wwg", "werewolf"],
            shortHelp: "Play One Night Ultimate Werewolf",
            reference: "",
            longHelp: "",
            code: function(userID, channelID, command, d) {
                game = new Game(channelID);
                let template = "**One Night Ultimate Werewolf**\nCurrent players: ";
                bf.reactionMenu(channelID, template+"nobody", [
                    {emoji: bf.buttons["plusminus"], remove: "user", actionType: "js", actionData: function(event) {
                        game.addOrRemove(event.d.user_id);
                        game.addOrRemove("359203132980461568");
                        bf.editMessage(channelID, event.d.message_id, template+cf.listify(game.players.map(p => "<@"+p.userID+">"), "nobody"));
                    }},
                    {emoji: bf.buttons["right"], remove: "all", ignore: "total", actionType: "js", actionData: function(event) {
                        if (cardSets[game.players.length]) {
                            let cards = [...cardSets[game.players.length]];
                            game.players.forEach(p => {
                                p.takeRandomCard(cards);
                            });
                            game.setUpCentreCards(cards)
                            game.players.forEach(p => {
                                p.sendInteractMenu(game, event.d.channel_id, function() {
                                    if (++game.progressCount == game.players.length) {
                                        bf.sendMessage(channelID, "Everyone has interacted.");
                                        cf.log(game, "info");
                                    }
                                });
                            });
                        } else {
                            bf.sendMessage(channelID, `<@${event.d.user_id}> You cannot start the game with ${game.players.length} ${cf.plural("player", game.players.length)}.`);
                        }
                    }}
                ]);
            }
        }
    }
    return availableFunctions;
}