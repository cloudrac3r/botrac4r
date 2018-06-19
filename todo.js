module.exports = function(input) {
    let {bot, cf, bf, db} = input;

    const status = {
        complete: "<:hippor10:275174742535700480>",
        incomplete: "<:hippor16:275174748672229376>",
        inprogress: "<a:hipporainbow:393993949880254464>",
        sublist: bf.buttons.right
    }
    const keywords = [
        {name: "list", regex: /list/},
        {name: "remove", regex: /remove/},
        {name: "complete", regex: /complete/},
        {name: "incomplete", regex: /incomplete/},
        {name: "sublist", regex: /sublist/},
        {name: "inprogress", regex: /inprogress/},
        {name: "emoji", regex: bf.ceregex},
        {name: "progress", regex: /progress:\d+/}
    ];

    function rowToLine(row, indent) {
        let icon;
        if (row.status.startsWith("progress:")) {
            let progress = Math.floor(Number(row.status.split(":")[1])/2);
            if (progress > 49) icon = status.complete;
            else if (progress < 0) icon = status.incomplete;
            else {
                progress = progress.toString().padEnd(2, "_");
                icon = bf.stringifyEmoji(bf.guildObject("331163970629271553").emojis.find(e => e.name == progress));
            }
        } else if (bf.matchEmoji(row.status)) {
            icon = row.status;
        } else {
            icon = status[row.status];
        }
        let depth = row.path.split("/").length - indent - 1;
        return " ".repeat(depth)+icon+" "+row.path.split("/").slice(-1)[0];
    }

    let availableFunctions = {
        todo: {
            aliases: ["todo"],
            shortHelp: "Manage lists of things you're putting off",
            reference: "[*path*] [remove|complete|incomplete|sublist|inprogress|*emoji*|progress:*0-100*]",
            longHelp: `Use "todo" on its own to see your complete todo list.\n`+
                      `Use "todo something" to see a smaller view of that thing.\n`+
                      `If you name something that does not exist, you will be prompted to add it.\n`+
                      `If you name something and follow it up with a word from the usage, the entry will be edited.`,
            eris: true,
            code: function(msg, command) {
                let path = command.input;
                if (path.includes("\n")) {
                    bf.sendMessage(msg.channel, "Error: Path must be a single line");
                    return;
                }
                path = path.match(new RegExp("^/*(.*)/*$"))[1].replace(new RegExp("/{2,}", "g"), "/");
                if (!path) path = "";
                let keyword = keywords.find(k => path.split(" ").slice(-1)[0].match(k.regex));
                if (keyword) {
                    keyword = path.split(" ").slice(-1)[0];
                    let match = path.match(/(^.*) /);
                    if (match) path = match[1];
                } else {
                    keyword = "list";
                }
                db.all("SELECT * FROM Todo WHERE userID=? AND path LIKE ?", [msg.author.id, path+"%"], (err, dbr) => {
                    if (path && !dbr.length) {
                        let emojis = Object.assign({}, status);
                        if (bf.matchEmoji(keyword)) emojis[keyword] = keyword;
                        db.all("SELECT * FROM Todo WHERE userID=?", msg.author.id, (err, dbr) => {
                            let split = path.split("/");
                            let extras = split.slice(0,-1).map((p,i) => split.slice(0,i+1).join("/")).filter(p => !dbr.find(r => r.path == p));
                            let message = "`"+path+"` does not exist. Press one of the reactions to create it with that status.";
                            if (extras.length) message += "\n\nThese paths will also be created as sublists: "+extras.map(p => "`"+p+"`");
                            bf.reactionMenu(msg.channel, message,
                                Object.keys(emojis).map(k => ({emoji: emojis[k], ignore: "total", cancel: true, actionType: "js", actionData: (menu) => {
                                    if (!extras.length) {
                                        db.run("INSERT INTO Todo VALUES (?, ?, ?)", [msg.author.id, path, k], () => {
                                            bf.addReaction(menu, bf.buttons["green tick"]);
                                        });
                                    } else {
                                        db.run("BEGIN TRANSACTION", () => {
                                            Promise.all(extras.map(p => new Promise(resolve => {
                                                db.run("INSERT INTO Todo VALUES (?, ?, ?)", [msg.author.id, p, "sublist"], resolve);
                                            }))).then(() => {
                                                db.run("INSERT INTO Todo VALUES (?, ?, ?)", [msg.author.id, path, k], () => {
                                                    db.run("END TRANSACTION", () => {
                                                        bf.addReaction(menu, bf.buttons["green tick"]);                                                        
                                                    });
                                                });
                                            });
                                        });
                                    }
                                }}))
                            );
                        });
                    } else {
                        switch (keyword) {
                        case "list":
                            let startDepth = dbr[0] ? dbr.map(row => row.path.split("/").length-1).sort((a,b) => (a-b))[0] : 0;
                            let list = dbr.sort((a,b) => (a.path < b.path ? -1 : 1)).map(row => {
                                return rowToLine(row, startDepth);
                            });
                            let output = ["__**Todo list**__"];
                            if (!list.length) list = ["(nothing here)"];
                            output = output.concat(list);
                            bf.sendMessage(msg.channel, output.join("\n"));
                            break;
                        case "remove":
                            db.run("DELETE FROM Todo WHERE userID=? AND path LIKE ?", [msg.author.id, path+"%"], () => {
                                bf.addReaction(msg, bf.buttons["green tick"]);
                            });
                            break;
                        default:
                            db.run("UPDATE Todo SET status=? WHERE userID=? AND path=?", [keyword, msg.author.id, path], () => {
                                bf.addReaction(msg, bf.buttons["green tick"]);
                            });
                            break;
                        }
                    }
                });
            }
        }
    }
    return availableFunctions;
}