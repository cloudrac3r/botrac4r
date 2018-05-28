const Canvas = require("canvas");
const request = require("request");
const util = require("util");
const fs = require("fs");

module.exports = function(input) {
    let {bot, cf, bf, db} = input;

    let messagesChanged = [];

    function transparentify(msg, words) {
        msg.channel.sendTyping().then(() => {
            if (!words) words = "Here's that image with white changed into transparency.";
            let imageURL;
            if (msg.embeds.some(e => e.type == "image" && e.url)) imageURL = msg.embeds.find(e => e.type == "image" && e.url).url;
            else if (msg.embeds.some(e => e.type == "rich" && e.image.url)) imageURL = msg.embeds.find(e => e.type == "rich" && e.image.url).image.url;
            else imageURL = msg.attachments.find(a => a.filename.endsWith(".png")).url;
            request(imageURL, {encoding: null}, (e,r,b) => {
                let img = new Canvas.Image();
                img.src = b;
                let canvas = Canvas.createCanvas(img.width, img.height);
                let ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, img.width, img.height);
                let data = ctx.getImageData(0, 0, img.width, img.height);
                let d = data.data;
                for (let i = 0; i < d.length; i+=4) {
                    //if (i < 800) console.log(i, d[i], d[i+1], d[i+2], d[i+3]);
                    if (d[i] == 255 && d[i+1] == 255 && d[i+2] == 255) d[i+3] = 0;
                    /*ctx.fillStyle = "rgba(0, 0, 0, 0)";
                    ctx.fillRect(0, 0, 1, 1);
                    ctx.lineTo(img.width, img.height);*/
                }
                ctx.putImageData(data, 0, 0);
                let buffer = canvas.toBuffer();
                bf.sendMessage(msg.channel, {content: words, file: buffer, filename: "image.png"});
            });
        });
    }

    /*bf.addTemporaryListener(bot, "messageUpdate", __filename, msg => {
        if (msg.author.id == bf.users.rsrb && msg.embeds.length) {
            let e = msg.embeds[0];
            if (e.title && e.title.startsWith("Welcome to the shop") && e.fields && e.fields.length == 1) {
                let f = e.fields[0];
                if (f.name == "Take this, edit it, and reupload it.") {
                    if (!messagesChanged.includes(msg.id)) {
                        messagesChanged.push(msg.id);
                        bf.reactionMenu(msg, [{emoji: bf.buttons.down, ignore: "total", remove: "user", actionType: "js", actionData: () => {
                            transparentify(msg, "I removed the white from the canvas to make it easier for you to layer stuff behind other stuff.");
                        }}]);
                    }
                }
            }
        }
    });*/

    const prettyMs = require("pretty-ms");
    let availableFunctions = {
        transparent: {
            aliases: ["transparent"],
            shortHelp: "",
            reference: "",
            longHelp: "",
            eris: true,
            code: (msg, command) => {
                msg.channel.getMessages(10).then(messages => {
                    let msg = messages.find(m => m.embeds.some(e => e.type == "image" && e.url) || m.embeds.some(e => e.type == "rich" && e.image.url) || m.attachments.some(a => a.filename.endsWith(".png")));
                    if (msg) transparentify(msg);
                });
            }
        }
    }
    return availableFunctions;
}