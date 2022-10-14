const fs = require("fs");

// Create script
/*
fs.writeFile("straw.berry", 'ROUTE users AT "newpath";', function (err) {
    if (err) {
        console.error("File creation unexpectedly malfunctioned. Error: " + err);
    } else {
        console.log("straw.berry file has been successfully created");
    }
});
*/

var symbolTable = {}, paths = [];
let currentToken = "", index = 0, line = 0, lineTokenPosition = 0, file, 
    currentIdentifier = null, currentHTTPMethod = null, currentHTTPPath = null, 
    currentReferenceTypes = [], currentReferenceValues = [];

// Starts the compiling process
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
    if (hasNext()) {
        next();
        parseBlock();
    }

    while (hasNext()) {
        parseBlock();
    }

    if (symbolTable["DEBUG"] !== undefined && symbolTable["DEBUG"].value === "true") {
        console.log("[DEBUG]: Logging Symbol Table...\n");
        console.log(symbolTable);
        
        console.log("\n[DEBUG]: Logging Path List...\n");
        console.log(paths);
    }

    compileIntoCode();
}

// Block := Config | HTTP | Route | Function | Auth | Option
function parseBlock() {
    if (currentToken === "S") parseConfig();
    else if (currentToken === "R") parseRoute();
    else if (currentToken === "F") parseFunction();
    else if (currentToken === "A") throwError("AUTH Functions are not yet supported");
    else if (currentToken === "O") throwError("OPTION Functions are not yet supported");
    else {
        if (currentToken === "G" || currentToken === "D" || currentToken === "P") parseHTTP();
        else throwError("Illegal Block. Either CONFIG, HTTP, Route, Function, Auth or Option expected");
    }

    parseOptionalWS();
}

// Function := "FUNCTION" ws $FunctionIdentifier$ opt_ws "{" $JavaScript$ "}"
function parseFunction() {
    throwError("[DEBUG]: Functions are not yet supported");

    parseKeyword("FUNCTION");
    parseWS();

    const functionIdentifier = getVariableIdentifier();
    console.log("New Function: " + functionIdentifier);

    parseOptionalWS();
    parseToken("{");
    parseToken("}");
}

// Route := "ROUTE" ws $RouteName$ OptionalPath opt_ws ";"
function parseRoute() {
    parseKeyword("ROUTE");
    parseWS();

    const route = getPathIdentifier();
    console.log("New route: " + route);

    parseWS();

    parseOptionalPath();
    parseOptionalWS();

    parseToken(";");
}

// OptionalPath := ("AT" ws $Path$)
function parseOptionalPath() {
    if (currentToken === "A") {
        next();
        if (currentToken === "T") {
            next();

            parseWS();
            parseQuote();

            const id = getVariableIdentifier();
            console.log("New id: " + id);

            next();
        } else throwError("Illegal character: " + currentToken + ". T expected.");
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

// HTTP := HTTPMethod ws $PathIdentifier$ ws OptionalAuth* MethodType opt_ws ";" 
function parseHTTP() {
    parseHTTPMethod();
    
    parseWS();
    currentHTTPPath = getPathIdentifier();
    parseWS();

    parseOptionalAuth();
    
    putHTTPMethod(getMethodType());

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
                currentReferenceTypes.push("REDIRECT");
                parseReference();
                return "REDIRECT";
            } else throwError("Either REDIRECT or RENDER expect. Illegal token: " + currentToken);

            
        } else throwError("Either REDIRECT or RENDER expect. Illegal token: " + currentToken);
    } 
    else if (currentToken === "O") {
        parseKeyword("OPTION");
        parseOptionalWS();
        currentReferenceTypes.push("OPTION");
        parseReference();
        return "OPTION";
    }  else if (currentToken === "F") {
        parseKeyword("FUNCTION");
        parseOptionalWS();
        currentReferenceTypes.push("FUNCTION");
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
        currentReferenceTypes.push("AUTH");
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
        
        currentReferenceValues.push(reference);
    }

    parseToken("]");
}

// HTTPMethod := "GET" | "POST" | "DELETE"
function parseHTTPMethod() {
    if (currentToken === "G") {
        parseKeyword("GET");
        currentHTTPMethod = "GET";
    } else if (currentToken === "P") {
        parseKeyword("POST");
        currentHTTPMethod = "POST";
    } else if (currentToken === "D") {
        parseKeyword("DELETE");
        currentHTTPMethod = "DELETE";
    }
    else throwError("Either GET, PUT or DELETE HTTP method expected");
}

// Value := Quote $VariableValue$ Quote
function parseValue() {
    parseQuote();
    putConfig(getVariableIdentifier());
    parseQuote();
}

// Variable := Quote $VariableName$ Quote
function parseVariable() {
    parseQuote();
    const variable = getVariableIdentifier();
    parseQuote();

    currentIdentifier = variable; 
}

// Token := ?
function parseToken(token) {
    if (currentToken === token) next();
    else throwError("Illegal token. Token " + token + " expected, but found: " + currentToken);
}

// Keyword := ?
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

// Quote := "'"|"""
function parseQuote() {
    if (/\u0022/.test(currentToken) || /\u0027/.test(currentToken)) {
        next();
    } else throwError("Either a single or double quote expected");
}

// ws := [Any white space like " ", "\t", etc.]
function parseWS() {
    if (!isWS()) throwError("White Space required.");
    else parseOptionalWS();
}

// opt_ws := (ws)*
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
// Expects the first quote to have been parsed
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

// Adds the value to the symbol table
function putConfig(value) {
    if (symbolTable[currentIdentifier] !== undefined) throwError("Configuration variable already exists.");
    else if (currentIdentifier === null) throw new Error("No identifier recognised, but value parsed");
    else {
        symbolTable[currentIdentifier] = { 
            type: "config", 
            value: value
        };
        currentIdentifier = null;
    }
}

// Adds the http method to the paths list
function putHTTPMethod(httpType) {
    if (paths === null) throwError("[DEBUG]: Warning: Paths list shouldn't be null.");
    else if (currentHTTPMethod === null || currentHTTPPath === null) 
        throw new Error("No method or path recognised, but value type parsed");
    else {
        paths.push({
            type: "http-method",
            method: currentHTTPMethod,
            path: currentHTTPPath,
            httpType: httpType,
            referenceTypes: currentReferenceTypes,
            referenceValues: currentReferenceValues
        });

        currentHTTPMethod = currentHTTPPath = null;
        currentReferenceTypes = [];
        currentReferenceValues = [];
    }
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

// Returns true if there is still a token to jump to next during parsing
function hasNext() {
    return index < file.length;
}

// Starts the code generation phase
function compileIntoCode() {
    const boilerplateImports = 
        "const express = require('express');\n"
        + "const path = require('path');\n"
        + "const fs = require('fs');"
        + "\n";
    
    const serverCreation = "const server = express();\n"
        + "server.use(express.static(path.join(__dirname, 'public')));";

    let viewEngineDefined = false;
    let viewEngine = symbolTable['VIEW_ENGINE'];
    if (viewEngine !== undefined) {
        if (viewEngine.value === 'EJS') {
            viewEngine = "server.setViewEngine('ejs');\n";
            viewEngineDefined = true;
        } else throw new Error("Currently only EJS is supported as a view engine. Not accepting: " + viewEngine.value);
    }

    let methods = "";
    for (let httpMethod of paths) {
        let header = "";
        if (httpMethod.method === "GET") {
            header = `server.get('${httpMethod.path}', (res, req) => {\n`;
            if (httpMethod.httpType === "RENDER") {
                let file = "";
                if (httpMethod.path === "/") {
                    file = "./views/index.ejs";
                } else {
                    file = "./views/" + httpMethod.path.substring(1) + ".ejs";
                }
                header += `\tserver.render('${file}');\n});\n\n`
            } else if (httpMethod.httpType === "REDIRECT") {
                let redirectOptionIndex = -1;
                for (let i = 0; i < httpMethod.referenceTypes.length; i++) {
                    if (httpMethod.referenceTypes[i] === "REDIRECT") {
                        redirectOptionIndex = i;
                        i = httpMethod.referenceTypes.length;
                    }
                }

                if (redirectOptionIndex === -1) throw new Error("Illegal State: The redirect option was not found.");
                else {
                    const redirectValue = httpMethod.referenceValues[redirectOptionIndex];
                    const file = "./views/" + redirectValue + ".ejs";
                    header += `\tserver.redirect('${file}');\n});\n\n`;
                }
            }
        }

        methods += header;
    }

    const port = "const PORT = process.env.PORT || 5000;\n"
        + "server.listen(PORT, () => console.log(`Server running on port ${PORT}`));";

    const code = 
        boilerplateImports + "\n"
        + serverCreation + "\n"
        + (viewEngineDefined ? viewEngine : "") + "\n"
        + methods
        + port
    ; 

    console.log(code);
}