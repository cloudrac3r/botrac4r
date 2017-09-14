module.exports = {
    // Log a message to console with a prefix
    log: function(text, severity) {
        let prefixes = {"error": "[#]", "warning": "[!]", "info": "[.]", "spam": "[ ]", "unknown": "[?]", "responseInfo": "( )", "responseError": "(!)"}; // Names and types of logging
        text = module.exports.stringify(text);
        let prefix = (prefixes[severity] || prefixes.unknown)+" ["+module.exports.getSixTime()+"] ";
        text = text.replace(/\n/g, "\n"+prefix.replace(/([[(]).([\])])/, "$1^$2")); // Deal with newlines (prefix each line)
        console.log(prefix+text);
    },
    // Given a time, return "HHMMSS"
    getSixTime: function(when, seperator) {
        let d = new Date(when || Date.now());
        if (!seperator) seperator = "";
        return d.getHours().toString().padStart(2, "0")+seperator+d.getMinutes().toString().padStart(2, "0")+seperator+d.getSeconds().toString().padStart(2, "0");
    },
    // Get specific arguments from a string.
    sarg: function(input, count, char) {
        if (!char) char = " "; // Split at spaces unless told otherwise
        input = module.exports.stringify(input);
        if (typeof(count) == "number") { // Given a number? Just .split
            return input.split(char)[count];
        } else if (typeof(count) == "string") { // Given a string? Treat - as an extender
            if (count.charAt(0) == "-") { // If it starts with -
                return input.split(char).slice(parseInt(count.slice(1))).join(char); // Select everything before
            } else { // (If it ends with -)
                return input.split(char).slice(parseInt(count.split("-")[0])).join(char); // Select everything after
            }
        }
    },
    // Convert any object (well, not yet) to a string for logging, sending, etc.
    stringify: function(input, longJSON) {
        if (typeof(input) == "number") return input.toString();
        if (typeof(input) == "boolean") return input.toString();
        if (!input) return "undefined";
        if (typeof(input) == "object") {
            if (longJSON) return JSON.stringify(input, null, 4);
            else return JSON.stringify(input);
        }
        if (typeof(input) == "string") return input;
        return "unknown";
    },
    // Get a random number between two inputs. Includes maximum value.
    rint: function(min, max) {
        return Math.floor(Math.random()*(max-min+1)+min);
    },
    // The better command argument function.
    carg: function(input, split, altSplit) {
        if (!split) split = " ";
        if (!altSplit) altSplit = ";";
        let output = {};
        output.words = input.split(split);
        output.regularWords = output.words.filter(i => !i.match(/^[+-][a-z]/i) && !i.match(/\w=[^\s]/));
        output.nonNumbers = output.regularWords.filter(i => parseFloat(i) != i);
        output.altWords = input.split(altSplit).map(i => module.exports.trim(i, split));
        output.numbers = output.regularWords.filter(i => parseFloat(i) == i);
        output.flags = {on: output.words.filter(i => i.match(/^\+[a-z]/i)).map(i => i.slice(1)), off: output.words.filter(i => i.match(/^-[a-z]/i)).map(i => i.slice(1))};
        output.switches = {};
        output.words.filter(i => i.match(/\w=[^\s]/)).forEach(i => output.switches[module.exports.trim(i).split("=")[0]] = module.exports.trim(i).split("=")[1]);
        return output;
    },
    // Return a random element from a supplied array.
    rarray: function(array) {
        return array[module.exports.rint(0, array.length-1)];
    },
    // Convert an array of strings to a humanised list.
    listify: function(array, empty) {
        if (!empty) empty = "nothing";
        switch (array.length) {
        case 0:
            return empty; // For empty arrays, return "nothing" (or the specified result)
        case 1:
            return array[0]; // For arrays with 1 item, just return that item
        case 2:
            return array[0]+" and "+array[1]; // For arrays with 2 items, connect them with " and ".
        default:
            return array[0]+", "+module.exports.listify(array.slice(1)); // For arrays with more than 2 items, recurse.
        }
    },
    // Trim leading and trailing spaces (or another character) from a string.
    trim: function(string, remove) {
        if (!remove) remove = " ";
        return string.replace(new RegExp(`^${remove}+|${remove}+$`, "g"), "");
    },
    // Check if one object has all the same immediate properties as another.
    slimMatch: function(objects) {
        let result = Object.keys(objects[0]).every(p => objects[0][p]==objects[1][p]);
        if (!result) {
            return false;
        } else if (objects.length <= 2) {
            return true;
        } else {
            return module.exports.slimMatch(objects.slice(1));;
        }
    }
}