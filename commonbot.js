module.exports = function(bot, cf) {
    let availableFunctions = {
        // Send a message to a channel.
        sendMessage: function(channelID, message, callback, additional) {
            if (!message) { // Empty messages don't work, so don't try
                cf.log("Cannot send empty message", "info");
                return;
            }
            if (!callback) callback = new Function(); // Create an empty callback to fall back to
            if (typeof(message) == "object") { // Convert objects to strings
                if (additional.largeObject) {
                    message = JSON.stringify(message, null, 4);
                } else {
                    message = JSON.stringify(message);
                }
            }
            bot.sendMessage(Object.assign({to: channelID, message: message}, additional), function(err, res) { // Actually send the message
                if (err) { // Handle various errors
                    if (err.statusMessage == "TOO MANY REQUESTS") { // Rate limit
                        cf.log("Message blocked by rate limit, retrying in "+err.response.retry_after, "info");
                        setTimeout(function() { // Try again after the timeout
                            module.exports(bot, cf).sendMessage(channelID, message, callback, additional);
                        }, err.response.retry_after);
                    } else { // Unknown error
                        cf.log(cf.stringify(err, true), "error");
                        callback(err);
                    }
                } else { // Success
                    let channelName = "unnamed channel";
                    if (bot.users[channelID]) {
                        channelName = "@"+bot.users[channelID].username;
                    } else if (bot.directMessages[channelID]) {
                        channelName = "@"+bot.directMessages[channelID].recipient.username;
                    } else {
                        channelName = "#"+bot.channels[channelID].name;
                    }
                    cf.log(`Sent a message to ${channelName} (${channelID}): ${message}`, "spam"); // Log information about what happened
                    callback(false);
                }
            });
        }
    }
    return availableFunctions;
};