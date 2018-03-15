module.exports = {
    "test1": {
        start: "welcome",
        list: {
            "welcome": {
                text: "Welcome to Mashville!",
                options: [
                    {
                        name: "(ok)",
                        route: "END"
                    }
                ]
            }
        }
    },
    "test2": {
        start: "welcome",
        list: {
            "welcome": {
                text: "Welcome to Mashville, home of the giant flying hippo!",
                options: [
                    {
                        name: "Ask about the giant flying hippo",
                        route: "hippo"
                    },{
                        name: "Pour some lemonade",
                        route: "lemonade",
                        code: (i) => {
                            i.caller.inventory.push(new i.Classes.InventoryItem("Lemonade", "🍹", 0));
                        }
                    },{
                        name: "Smile and pass by (end)",
                        route: "END"
                    }
                ]
            },
            "lemonade": {
                text: "Alright, here you go! Have a nice day!",
                options: [
                    {
                        name: "(ok)",
                        route: "END"
                    }
                ]
            },
            "hippo": {
                text:
                    "You don't know about the giant flying hippo? Okay, well, guess I'll tell you the whole story.\n"+
                    "Many years ago, an evil sorcerer arrived in town. He looked super powerful, and had really bad looking hair, "+
                    "but he didn't really bother us so we left him alone.\n"+
                    "One day, we heard an awful smashing and shouting coming from the sorcerer's house. One poor man went out to investigate. "+
                    "He knocked on the door of the sorcerer's house, which flew open, knocking him to the ground unconscious. "+
                    "Out of the door flew — well, I'm not really sure what it was, I was too terrified to remember anything from that day, "+
                    "but others tell me that it was... \\*lowers voice\\* the head of a hippo. And it was huge.\n\n"+
                    "(He seems unwilling to explain further.)",
                options: [
                    {
                        name: "Ask about the appearance of the hippo",
                        route: "hippo2"
                    },{
                        name: "Ask about the sorcerer",
                        route: "sorcerer"
                    },{
                        name: "Muse for a moment, thank him and move on (end)",
                        route: "END"
                    }
                ]
            },
            "sorcerer": {
                text:
                    "The sorcerer? Well, he was a funny fellow. As I said, he mostly just stayed in his house, and we didn't really go near him "+
                    "in case he suddenly destroyed the village in a rage, but I *do* remember the day he went to buy some fish. "+
                    "\\*chuckles, then stops abruptly\\* Well. Sorcerers have to eat too, you know. He comes to the market once a week and buys "+
                    "all the food and materials he needs until his next visit. He never haggles for prices unlike most of the town folk, "+
                    "so that's good business for the village at least. One day he walks up to Samone, the fish seller, and asks for her "+
                    "finest beef. Don't ask why. Except the market was really busy and noisy that day, and Samone misheard him, and thought he "+
                    "wanted some *teeth.* And she's really confused, because why would you ask for teeth at a fish stand, right? But the day before "+
                    "she had actually managed to catch a shark, and after she'd cut it up she'd taken the teeth to the jeweller's and made "+
                    "a nice necklace out of them. She was going to give the necklace to her daughter, because her birthday was coming up. "+
                    "But because she didn't want to make the sorcerer angry, she took it out of the box in her fish stand and offered it to him. "+
                    "Well, he didn't like that very much, since he'd asked for beef and this woman was insulting him by offering him inedible "+
                    "shark teeth! In a rage, he snatched the necklace from her hand and threw it to the ground, then started shouting at how "+
                    "she had the nerve to deny him. As Samone was listening terrified to his rant, she heard him say \"beef\" and realised "+
                    "that she had misheard. Good thing she did, otherwise I probably wouldn't be alive right now. She gave him his beef, he calmed "+
                    "down, paid and walked away.",
                options: [
                    {
                        name: "Nod sympathetically (end)",
                        route: "END"
                    }
                ]
            },
            "hippo2": {
                text:
                    "What did the hippo look like? Well, let's see. Remember, I never saw it in person, so this is going by what other people have "+
                    "told me...\nAlright, imagine a hippopotamus head. But then round off the chin, and make the eyes huge, and— accttuuuallllyyyyy... "+
                    "I'm pretty sure they actually made a statue commemorating the event. It's \*points\* down in the town hall, just go south a bit, "+
                    "turn left, and you should have no problem finding it. Then you can see it in person, instead of me trying to explain it second-hand. "+
                    "Got that? Good. On your way, now.\n\n(He shoos you away.)",
                options: [
                    {
                        name: "(ok)",
                        route: "END"
                    }
                ]
            }
        }
    }
}