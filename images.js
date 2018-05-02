module.exports = function(input) {
    let {bot, cf, bf, db} = input;
    let request = require("request");
    let availableFunctions = {
        space: {
            aliases: ["space"],
            shortHelp: "Post an image of spaaaaaaaaace",
            reference: "",
            longHelp: "",
            eris: true,
            code: function(msg) {
                bot.sendChannelTyping(msg.channel.id);
                request("https://api.cheweybot.ga/space", (e,r,b) => {
                    try {
                        let url = JSON.parse(b).data;
                        if (!url) throw "SyntaxError: data is undefined";
                        bf.sendMessage(msg.channel, {mention: msg.author, embed: {
                            title: "Sp"+"a".repeat(Math.floor(Math.random()*24+6))+"ce"+"!".repeat(Math.round(Math.random()*2)),
                            image: {url: encodeURI(url)},
                            color: bf.isDMChannel(msg.channel) ? 0x5c53d4 : bf.userToColour(bot.user, bot.channelGuildMap[msg.channel.id])
                        }});
                    } catch (e) {
                        if (e.toString().match(/^SyntaxError.*JSON/) || e.toString() == "SyntaxError: data is undefined") {
                            bf.sendMessage(msg.channel, "API returned invalid data.", {mention: msg.author});
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
