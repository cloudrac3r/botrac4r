module.exports = {
    log: function(text, severity) {
        let prefixes = {"error": "[#]", "warning": "[!]", "info": "[.]", "spam": "[ ]", "unknown": "[?]", "responseInfo": "( )", "responseError": "(!)"}; // Names and types of logging
        text = module.exports.stringify(text);
        let prefix = (prefixes[severity] || prefixes.unknown)+" ["+module.exports.getSixTime()+"] ";
        text = text.replace(/\n/g, "\n"+prefix.replace(/([[(]).([\])])/, "$1^$2")); // Deal with newlines (prefix each line)
        console.log(prefix+text);
    },
    getSixTime: function(when, seperator) {
        let d = new Date(when || Date.now());
        if (!seperator) seperator = "";
        return d.getHours().toString().padStart(2, "0")+seperator+d.getMinutes().toString().padStart(2, "0")+seperator+d.getSeconds().toString().padStart(2, "0");
    },
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
    stringify: function(input, longJSON) {
        if (!input) return "undefined";
        if (typeof(input) == "number") return input.toString();
        if (typeof(input) == "boolean") return input.toString();
        if (typeof(input) == "object") {
            if (longJSON) return JSON.stringify(input, null, 4);
            else return JSON.stringify(input);
        }
        if (typeof(input) == "string") return input;
        return "unknown";
    },
    rint: function(min, max) {
        return Math.floor(Math.random()*(max-min+1)+min);
    },
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
    rarray: function(array) {
        return array[module.exports.rint(0, array.length-1)];
    },
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
    trim: function(string, remove) {
        if (!remove) remove = " ";
        return string.replace(new RegExp(`^${remove}+|${remove}+$`, "g"), "");
    }
}