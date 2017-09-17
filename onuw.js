module.exports = function(input) {
    let {bot, cf, bf, db} = input;
    let game;
    const roleSets = {
        3: ["werewolf", "werewolf", "villager", "seer", "robber", "troublemaker"]
    };
    class Game {
        constructor(serverID) { // Set up new game
            this.players = [];
            this.serverID = serverID;
            this.phase = "not started";
            this.timer;
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
    }
    class Player {
        constructor(userID) {
            this.userID = userID;
        }
    }
    class Card {
        constructor(name) {
        }
    }
    let availableFunctions = {
        onuw: {
            aliases: ["onuw", "wwg", "werewolf"],
            shortHelp: "Play One Night Ultimate Werewolf",
            reference: "",
            longHelp: "",
            code: function(userID, channelID, command, d) {
                game = new Game(bot.channels[channelID].guild_id);
                let template = "**One Night Ultimate Werewolf**\nCurrent players: ";
                bf.reactionMenu(channelID, template+"nobody", [
                    {emoji: "<:bn_pm:327986149022760960>", remove: "user", actionType: "js", actionData: function(event) {
                        game.addOrRemove(event.d.user_id);
                        bf.editMessage(channelID, event.d.message_id, template+cf.listify(game.players.map(p => "<@"+p.userID+">"), "nobody"));
                    }},
                    {emoji: "<:bn_fo:328724374465282049>", remove: "user", actionType: "js", actionData: function(event) {
                        if (roleSets[game.players.length]) {
                            // Do something cool
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