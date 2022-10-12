const fs = require("fs");

fs.writeFile("straw.berry", 'GET /index AUTH[test] RENDER;', function (err) {
    if (err) {
        console.error("File creation unexpectedly malfunctioned. Error: " + err);
    } else {
        console.log("straw.berry file has been successfully created");
    }
});

let currentToken = "", index = 0, line = 0, lineTokenPosition = 0, file;

async function setup() {
    try {
        return await fs.promises.readFile("straw.berry", (err, data) => {
            if (err) console.error("straw.berry file couldn't be read. Error: " + err);
        })
        .then(data => data.toString())
        .then(data => file = data)
        .then(() => parseDocument());
    } catch (err) {
        console.error("An error occured while setting up the file.\n" + err);
    } 
}

setup();

// Document := (Block)*
function parseDocument() {
    console.log(file);
    next();
    parseBlock();
}

// Block := Config | HTTP | Route | Function | Auth | Option
function parseBlock() {
    if (currentToken === "S") parseConfig();
    else if (currentToken === "R") {}
    else if (currentToken === "F") {}
    else if (currentToken === "A") {}
    else if (currentToken === "O") {}
    else {
        if (currentToken === "G" || currentToken === "D" || currentToken === "P") parseHTTP();
        else throwError("Illegal Block. Either CONFIG, HTTP, Route, Function, Auth or Option expected");
    }
}

// Config := "SET" ws Variable opt_ws "=" opt_ws Value opt_ws ";"
function parseConfig() {
    parseKeyword("SET");
    parseWS();

    parseVariable();

    parseOptionalWS();
    parseToken("=");
    parseOptionalWS();

    parseValue();
    parseOptionalWS();

    parseToken(";");
}

// HTTP := HTTPMethod ws HTTPPath ws OptionalAuth* MethodType opt_ws ";" 
function parseHTTP() {
    parseHTTPMethod();
    
    parseWS();
    parseHTTPPath();
    parseWS();

    parseOptionalAuth();
    
    const type = getMethodType();
    console.log("New HTTP Method Type: " + type);

    parseOptionalWS();
    parseToken(";");
}

// MethodType := RENDER | REDIRECT[$RedirectReference$] | OPTION[$OptionReference$] | FUNCTION[$FunctionReference$]
function getMethodType() {
    if (currentToken === "R") {
        next();
        if (currentToken === "E") {
            next();

            if (currentToken === "N") {
                parseKeyword("NDER");
                return "RENDER";
            } else if (currentToken === "D") {
                parseKeyword("DIRECT");
                parseOptionalWS();
                parseReference();
                return "REDIRECT";
            } else throwError("Either REDIRECT or RENDER expect. Illegal token: " + currentToken);

            
        } else throwError("Either REDIRECT or RENDER expect. Illegal token: " + currentToken);
    } 
    else if (currentToken === "O") {
        parseKeyword("OPTION");
        parseOptionalWS();
        parseReference();
        return "OPTION";
    }  else if (currentToken === "F") {
        parseKeyword("FUNCTION");
        parseOptionalWS();
        parseReference();
        return "FUNCTION";
    } else throwError("Illegal method type. Only RENDER, REDIRECT, OPTION or FUNCTION allowed");
}

// OptionalAuth := ("AUTH" opt_ws Reference ws)
function parseOptionalAuth() {
    if (currentToken === "A") {
        parseKeyword("AUTH");
        parseOptionalWS();

        parseReference();
        parseWS();
    }
}

// Reference := "[" $Reference$ "]"
function parseReference() {
    parseToken("[");

    if (currentToken === "]") throwError("Reference may not be empty");
        else {
        let reference = "";
        while (currentToken !== "]") {
            if (isWS()) throwError("Reference may not contain white space");
            else {
                reference += currentToken;

                if (hasNext) next();
                else throwError("End of file reached. Closing ']' token expected");
            }
        }
        console.log("New Reference: " + reference);
    }

    parseToken("]");
}

function parseHTTPPath() {
    const path = getPathIdentifier();

    console.log("New HTTP Path: " + path);
}

function parseHTTPMethod() {
    if (currentToken === "G") parseKeyword("GET");
    else if (currentToken === "P") parseKeyword("POST");
    else if (currentToken === "D") parseKeyword("DELETE");
    else throwError("Either GET, PUT or DELETE HTTP method expected");
}

// Value := Quote $VariableValue$ Quote
function parseValue() {
    parseQuote();
    const value = getVariableIdentifier();
    parseQuote();

    console.log("new value: " + value);
}

// Variable := Quote $VariableName$ Quote
function parseVariable() {
    parseQuote();
    const variable = getVariableIdentifier();
    parseQuote();

    console.log("new variable: " + variable);
}

function parseToken(token) {
    if (currentToken === token) next();
    else throwError("Illegal token. Token " + token + " expected.");
}

function parseKeyword(keywordName) {
    let i = 0;

    while (i < keywordName.length) {
        let requiredToken = keywordName.charAt(i);

        if (requiredToken === currentToken) next();
        else throwError("Illegal token. " + keywordName + " keyword expected. Token '" + requiredToken 
            + "' required and '" + currentToken + "' received");
        i++;
    }
}

function parseQuote() {
    if (/\u0022/.test(currentToken) || /\u0027/.test(currentToken)) {
        next();
    } else throwError("Either a single or double quote expected");
}

function parseWS() {
    if (!isWS()) throwError("White Space required.");
    else parseOptionalWS();
}

function parseOptionalWS() {
    while (isWS()) {
        next();
    }
}

// Returns whether the current token is a white space token
function isWS() {
    return /\s/.test(currentToken); 
}

// Returns the path identifier, expecting to be emptied of WS. Finished when WS is found.
function getPathIdentifier() {
    let identifier = "";
        
    if (isWS()) throwError("Illegal White Space. Path identifier may not contain white space");
    else {
        while (!isWS()) {
            identifier += currentToken;

            if (hasNext()) next();
            else throwError("End of file reached. White space expected");
        }
        
        return identifier;
    }
}

// Returns the built variable identifier of the current tokens until WS is met
function getVariableIdentifier() {
    let identifier = "";
        
    while (currentToken !== "'" && currentToken !== '"') {
        identifier += currentToken;

        if (hasNext()) next();
        else throwError("End of file reached. Identifier quote expected");
    }
    
    return identifier;
}

// Prints a debug error message
function throwError(message) {
    throw new Error(message + "\nLine: " + line + "[" + lineTokenPosition + "]")
} 

// Gathers the next token and increments the line numbers if neccessary
function next() {
    lineTokenPosition++;

    currentToken = file.charAt(index);

    if (currentToken === "\n") {
        line++;
        lineTokenPosition = 1;
    }

    index++;
}

function hasNext() {
    return index < file.length;
}