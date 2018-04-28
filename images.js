module.exports = function(input) {
    let {bot, cf, bf, db} = input;
    let request = require("request");
    let availableFunctions = {
        space: {
            aliases: ["space"],
            shortHelp: "Post an image of spaaaaaaaaace",
            reference: "",
            longHelp: "",
            code: function(userID, channelID, command, d) {
                bot.simulateTyping(channelID);
                request("https://api.cheweybot.ga/space", (e,r,b) => {
                    try {
                        let url = JSON.parse(b).data;
                        if (!url) throw "SyntaxError: data is undefined";
                        bf.sendMessage(channelID, "", {mention: userID, embed: {
                            title: "Sp"+"a".repeat(Math.floor(Math.random()*24+6))+"ce"+"!".repeat(Math.round(Math.random()*2)),
                            image: {url: encodeURI(url)},
                            color: bot.isDMChannel(channelID) ? 0x5c53d4 : bf.userIDToColour(bot.user.id, bot.channelGuildMap[channelID])
                        }});
                    } catch (e) {
                        if (e.toString().match(/^SyntaxError.*JSON/) || e.toString() == "SyntaxError: data is undefined") {
                            bf.sendMessage(channelID, "API returned invalid data.", {mention: userID});
                        } else {
                            throw e;
                        }
                    }
                });
            }
        }
    };
    return availableFunctions;
}
