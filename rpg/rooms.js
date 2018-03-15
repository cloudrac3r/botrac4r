module.exports = {
    "start/bedroom": {
        exits: [
            {
                direction: "south",
                aliases: ["hallway"],
                target: "start/hallway1",
                entrance: "outside door",
                exit: ""
            }
        ],
        location: ["K'velin", "Castle", "Bedroom"],
        description:
            "You are in the bedroom of a castle. A door to the south leads to a hallway."
    },
    "start/hallway1": {
        exits: [
            {
                direction: "north",
                aliases: ["bedroom"],
                target: "start/bedroom",
                exit: "outside door",
                entrance: ""
            },{
                direction: "west",
                aliases: [],
                target: "start/maze",
                exit: "bottom of stairs",
                entrance: "start"
            },{
                direction: "south",
                aliases: ["portal"],
                target: "start/portal",
                exit: "nook",
                entrance: ""
            }
        ],
        subrooms: [
            {
                location: "outside door",
                connections: ["top of stairs"],
                position: {x: 0, y: 0, z: 0}
            },{
                location: "top of stairs",
                connections: ["outside door", "nook", "bottom of stairs"],
                position: {x: -8, y: 0, z: 0}
            },{
                location: "nook",
                connections: ["top of stairs"],
                position: {x: -8, y: 2, z: 0}
            },{
                location: "bottom of stairs",
                connections: ["top of stairs"],
                position: {x: -14, y: 0, z: -3}
            }
        ],
        location: ["K'velin", "Castle", "Hallway"],
        description:
            "A hallway."
    },
    "start/maze": {
        exits: [
            {
                direction: "east",
                aliases: ["hallway"],
                target: "start/hallway1",
                exit: "start",
                entrance: "bottom of stairs"
            }
        ],
        subrooms: [
            {
                location: "start",
                connections: ["glade", "dungeon"],
                position: {x: 0, y: 0, z: 0}
            },{
                location: "glade",
                connections: ["start", "daisy", "forest"],
                position: {x: 0, y: 0, z: 0}
            },{
                location: "daisy",
                connections: ["glade"],
                position: {x: 0, y: 0, z: 0}
            },{
                location: "forest",
                connections: ["glade", "cliff 1"],
                position: {x: 0, y: 0, z: 0}
            },{
                location: "cliff 1",
                connections: ["forest"],
                position: {x: 0, y: 0, z: 0}
            },{
                location: "dungeon",
                connections: ["start", "monsters", "spiral"],
                position: {x: 0, y: 0, z: 0}
            },{
                location: "monsters",
                connections: ["dungeon", "treasure"],
                position: {x: 0, y: 0, z: 0}
            },{
                location: "treasure",
                connections: ["monsters", "chasm"],
                position: {x: 0, y: 0, z: 0}
            },{
                location: "chasm",
                connections: ["treasure", "bear pit"],
                position: {x: 0, y: 0, z: 0}
            },{
                location: "bear pit",
                connections: ["chasm", "corner", "spiral"],
                position: {x: 0, y: 0, z: 0}
            },{
                location: "spiral",
                connections: ["dungeon", "tower", "corner", "bear pit"],
                position: {x: 0, y: 0, z: 0}
            },{
                location: "tower",
                connections: ["spiral"],
                position: {x: 0, y: 0, z: 0}
            },{
                location: "corner",
                connections: ["cliff 2", "fool's loop", "bear pit", "spiral"],
                position: {x: 0, y: 0, z: 0}
            },{
                location: "cliff 2",
                connections: ["corner", "final turn"],
                position: {x: 0, y: 0, z: 0}
            },{
                location: "final turn",
                connections: ["fool's loop", "cliff 2", "slope"],
                position: {x: 0, y: 0, z: 0}
            },{
                location: "fool's loop",
                connections: ["final turn", "corner"],
                position: {x: 0, y: 0, z: 0}
            },{
                location: "slope",
                connections: ["final turn", "end"],
                position: {x: 0, y: 0, z: 0}
            },{
                location: "end",
                connections: ["slope"],
                position: {x: 0, y: 0, z: 0}
            },
        ],
        location: ["K'velin", "Castle", "Maze"],
        description:
            "A maze."
    },
    "start/portal": {
        exits: [
            {
                direction: "north",
                aliases: ["hallway"],
                target: "start/hallway1",
                exit: "",
                entrance: "nook"
            },{
                direction: "south",
                aliases: ["town"],
                target: "start/town",
                exit: "",
                entrance: "gates"
            }
        ],
        location: ["???"],
        description:
            "A jank ass-portal that's only here to get you to somewhere more likely to have NPCs. A town, for instance."
    },
    "start/town": {
        exits: [
            {
                direction: "north",
                aliases: ["portal"],
                target: "start/portal",
                exit: "gates",
                entrance: ""
            }
        ],
        subrooms: [
            {
                location: "gates",
                connections: ["path 1"],
                position: {x: 0, y: 0, z: 0}
            },{
                location: "path 1",
                connections: ["gates", "path 2"],
                position: {x: 5, y: -2, z: 0}
            },{
                location: "path 2",
                connections: ["path 1", "square"],
                position: {x: 10, y: -4, z: 0}
            },{
                location: "square",
                connections: ["path 2"],
                position: {x: 15, y: -4, z: 0}
            }
        ],
        location: ["K'velin", "Town", "Main street"],
        description:
            "Blah blah blah town blah"
    }
}
