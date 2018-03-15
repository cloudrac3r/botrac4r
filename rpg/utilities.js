module.exports = {
    // Given a string and an array to choose from, return the most useful match
    partialMatch(input, choices, path, custom) {
        let matchFunctions = [
            (input, item) => (item == input),
            (input, item) => (item.toLowerCase() == input.toLowerCase()),
            (input, item) => (item.toLowerCase().startsWith(input.toLowerCase())),
            (input, item) => (item.toLowerCase().includes(input.toLowerCase()))
        ];
        matchFunctions = matchFunctions.map(m => ({path: path, code: m}));
        if (custom) { // If custom functions were provided, add them. Format: {position: Number, code: Function}
            custom.forEach(c => {
                matchFunctions.splice(c.position, 0, c);
            });
        }
        let results = [];
        matchFunctions.forEach(f => { // Use each match function in turn
            results = results.concat(choices.filter(c => {
                let d = c;
                if (f.path) { // Descend into objects
                    f.path.forEach(p => {
                        if (d[p] != undefined) d = d[p];
                    });
                }
                if (typeof(d) == "string") {
                    return f.code(input, d);
                } else {
                    return false;
                }
            }));
        });
        return results[0];
    },
    findSubroomPath(subrooms, start, end, used) {
        if (!used) used = [start];
        console.log(start);
        let sr = subrooms.find(s => s.location == start);
        if (sr.connections.includes(end)) {
            return [end];
        } else {
            return sr.connections.filter(c => !used.includes(c)).map(c => {
                used.push(c);
                let output = module.exports.findSubroomPath(subrooms, c, end, used);
                if (output) {
                    return [c].concat(output);
                }
            }).find(c => c);
        }
    },
    subroomTree(subrooms, start, maxDepth) {
        let stage1 = [];
        // Collect rooms into array of location and depth
        let used = [];
        doStage1(start, 0);
        function doStage1(start, currentDepth) {
            stage1.push({location: start, depth: currentDepth});
            used.push(start);
            if (currentDepth < maxDepth) {
                subrooms.find(s => s.location == start).connections.filter(c => !used.includes(c)).forEach(c => {
                    doStage1(c, currentDepth+1);
                });
            }
        }
        // Remove duplicates
        stage1 = stage1.filter(t => {
            return !stage1.find(u => u.depth < t.depth && u.location == t.location);
        });
        // Convert to ASCII art
        //stage2 = "```\n"+stage1.map(t => "  ".repeat(t.depth)+t.location).join("\n")+"```";
        let stage2 = "```\n"+stage1.map((t,i) => {
            let prefix = "";
            if (t.depth > 0) {
                for (let i = 1; i < t.depth; i++) {
                    if (!stage1.slice(i+1).find(u => u.depth == i)) {
                        prefix += prefix = "┃ "; //SC: Box & en space
                    } else {
                        prefix += prefix = "  "; //SC: Space & en space
                    }
                }
                if (!stage1[i+1] || stage1[i+1].depth < t.depth) {
                    prefix += "┗";
                } else {
                    prefix += "┣";
                }
                prefix += " ";
            }
            return prefix+t.location;
        }).join("\n")+"```";
        return stage2;
    }
}
