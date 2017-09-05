module.exports = function(bot, cf) {
    let availableFunctions = {
        sendMessage: function(channelID, message, callback, additional) {
            if (!message) {
                cf.log("Cannot send empty message", "info");
                return;
            }
            if (!callback) callback = new Function();
            if (typeof(message) == "object") {
                if (additional.largeObject) {
                    message = JSON.stringify(message, null, 4);
                } else {
                    message = JSON.stringify(message);
                }
            }
            bot.sendMessage(Object.assign({to: channelID, message: message}, additional), function(err, res) {
                if (err) {
                    if (err.statusMessage == "TOO MANY REQUESTS") {
                        //cf.log(err, "error");
                        cf.log("Message blocked by rate limit, retrying in "+err.response.retry_after, "info");
                        setTimeout(function() {
                            module.exports(bot, cf).sendMessage(channelID, message, callback, additional);
                        }, err.response.retry_after);
                    } else {
                        cf.log(cf.stringify(err, true), "error");
                    }
                } else {
                    cf.log(`Sent a message to #${bot.channels[channelID].name} (${channelID}): ${message}`, "spam");
                    callback(false);
                }
            });
        }
    }
    return availableFunctions;
};