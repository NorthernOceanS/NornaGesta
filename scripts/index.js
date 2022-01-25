import * as __WEBPACK_EXTERNAL_MODULE_mojang_minecraft_d96a568b__ from "mojang-minecraft";
/******/ var __webpack_modules__ = ([
/* 0 */,
/* 1 */
/***/ ((module) => {

var x = y => { var x = {}; __webpack_require__.d(x, y); return x; }
var y = x => () => x
module.exports = __WEBPACK_EXTERNAL_MODULE_mojang_minecraft_d96a568b__;

/***/ }),
/* 2 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

/*
** This file is licensed in BSD 2 Clause.
*/

let constructors = __webpack_require__(3);
let {runNOS} = __webpack_require__(4);

Object.assign(exports, constructors);

let {BlockType} = constructors;

const emptyPlatform = {
    use() { /* no-op */ }
}

exports.emptyPlatform = emptyPlatform;

let VALID_COMMAND = [
    "nextGenerator",
    "perviousGenerator",
    "addPosition",
    "addBlockType",
    "addDirection",
    "removePosition",
    "removeBlockType",
    "removeDirection",
    "useItem",
    "isValidParameter",
    "generate",
    "UIHandler",
    "exit",
    "getCurrentGeneratorName",
    "getCurrentUI",
    "getCurrentState"
];

class System {
    constructor() {
        this._platform = null;
        this._generators = [];
        this._users = new Map();
        this._ids = new Map();
        this._auths = new Map();
        this._nativeNOSPrograms = new Map([
            ["set", programSet],
            ["add", programAdd]
        ]);
        this._namespaces = new Map();
    }
    /*
    ** Following functions are used by platform.
    ** If you are a generator developer,

    ** please don't rely on these functions.
    */
    inject(platform) {
        this._platform = platform;
    }
    createUser(id) {
        let user = new UserSystem(this);
        this._users.set(id, user);
        this._ids.set(user, id);
        user.init();
        return user;
    }
    hasUser(id) {
        return this._users.has(id);
    }
    getUser(id) {
        if(!this.hasUser(id)) {
            throw new Error(`unknown playid: ${id}
users: system: ${[...this._users.entries()]}`);
        }
        return this._users.get(id);
    }
    _getID(user) {
        return this._ids.get(user);
    }
    /*
    ** Following functions are used by users,

    ** If you are a generator developer,

    ** please don't rely on these functions.
    */
    removeUser(user) {
        let id = this._ids.get(user);
        this._users.delete(id);
        this._ids.delete(user);
    }
    getGenerators() {
        return Array.from(this._generators);
    }
    createRuntime(auth) {
        let runtime = this._platform.createRuntime(this._getID(auth.user));
        runtime = this._mixinSystemRuntime(runtime);
        runtime = this._hijack(runtime, auth);
        return runtime;
    }
    _createSubRuntime(runtime) {
        let auth = this._auths.get(runtime);
        let newAuth = Object.assign({}, auth);
        return this.createRuntime(newAuth);
    }
    _getCurrentState(runtime) {
        let auth = this._auths.get(runtime);
        if(!this._users.has(auth.user)) {
            throw new ReferenceError('No such user.')
        }
        return auth.user.getCurrentState();
    }
    _executeUserSystemCommand(runtime, command, ...args) {
        let auth = this._auths.get(runtime);
        if(!this._users.has(auth.user)) {
            throw new ReferenceError('No such user.')
        }
        if(VALID_COMMAND.find(command) === undefined) {
            throw new ReferenceError('No such command: ${command}.')
        }
        return auth.user[command](...args);
    }
    _mixinSystemRuntime(runtime) {
        runtime.createSubRuntime = this._createSubRuntime.bind(this, runtime);
        runtime.execl = this._execl.bind(this, runtime);
        runtime.execv = this._execv.bind(this, runtime);
        runtime.runNOS = runNOS.bind(undefined, runtime);
        runtime.getCurrentState = this._getCurrentState.bind(this, runtime);
        runtime.executeUserSystemCommand = this._executeUserSystemCommand.bind(this, runtime);
        return runtime;
    }
    _hijack(runtime, auth) {
        this._auths.set(runtime, auth);
        return runtime;
    }
    _findNOSProgram(name) {
        let nativProgram = this._nativeNOSPrograms.get(name);
        if(nativProgram !== undefined) {
            return nativProgram;
        }
        let names = name.split(".");
        let namespaceName = names.shift();
        let namespace = this._namespaces.get(namespaceName);
        for (name in names) {
            if(namespace === undefined) {
                break;
            }
            namespace = namespace[name];
        }
        if(namespace !== undefined) {
            return namespace;
        }
        return undefined;
    }
    _execv(runtime, name, input, args) {
        let program = this._findNOSProgram(name);
        if(program === undefined) {
            throw new ReferenceError(`There is no program called ${name}.`);
        }
        return program({
            runtime: runtime.createSubRuntime(),
            input,
            args
        });
    }
    _execl(runtime, name, input, ...args) {
        return this._execv(runtime, name, input, args);
    }
    /*
    ** Following functions are register API of system.
    */
    registerGenerator(generator) {
        this._generators.push(generator);
    }
    registerCanonicalGenerator(o) {
        this.registerGenerator(canonicalGeneratorFactory(o));
    }
    registerNOSProgram(name, programs) {
        this._namespaces.set(name, programs);
    }
}

function programSet(e) {
    let {runtime, args, input} = e;
    if(args[1] !== "o" && args[1] !== "option" && args[1] !== "s" && args[1] !== "state") {
        throw new Error(`${args[0]} can only set state.`);
    }
    let state = runtime.getCurrentState();
    state[args[2]] = args[3];
    return undefined;
}

function programAdd(e) {
    let {runtime, args, input} = e;
    if(args[1] !== "b") {
        throw new Error(`${args[0]} can only add blockType.`);
    }
    let blockType = new BlockType(args[2], JSON.parse(args[3]));
    runtime.executeUserSystemCommand("addBlockType", blockType);
    return undefined;
}


exports.System = System;

exports.systemInstance = new System();

class UserSystem {
    constructor(system) {
        this._system = system;
        this.session = {};
        this._generators = system.getGenerators();
        this._generatorStates = Array(this._generators.length);
        for(let i = 0; i < this._generatorStates.length; ++i) {
            this._generatorStates[i] = {};
        }
        this._generatorIndex = 0;
    }
    init() {
        for(let i = 0; i < this._generatorStates.length; ++i) {
            this._generators[i].onInit({
                state: this._generatorStates[i],
                runtime: this._createRuntime(this._generators[i]),
            });
        }
    }
    nextGenerator() {
        let newIndex = (this._generatorIndex + 1) % this._generators.length;
        this.switchGenerator(newIndex);
    }
    perviousGenerator() {
        let newIndex = this._generatorIndex + this._generators.length - 1;
        newIndex %= this._generators.length;
        this.switchGenerator(newIndex);
    }
    switchGenerator(index) {
        if(this._generatorIndex === index) {
            return;
        }
        let oldGen = this._generators[this._generatorIndex];
        oldGen.onBlur && oldGen.onBlur({
            state: this._generatorStates[this._generatorIndex],
            runtime: this._createRuntime(oldGen),
        });
        this._generatorIndex = index;
        let newGen = this._generators[this._generatorIndex];
        newGen.onFocus && newGen.onFocus({
            state: this._generatorStates[this._generatorIndex],
            runtime: this._createRuntime(newGen),
        });
    }
    addPosition(position) {
        let gen = this._generators[this._generatorIndex];
        gen.onAddPosition({
            state: this._generatorStates[this._generatorIndex],
            position,

            runtime: this._createRuntime(gen),
        });
    }
    addBlockType(blockType) {
        let gen = this._generators[this._generatorIndex];
        gen.onAddBlockType({
            state: this._generatorStates[this._generatorIndex],
            blockType,

            runtime: this._createRuntime(gen),
        });
    }
    addDirection(direction) {
        let gen = this._generators[this._generatorIndex];
        gen.onAddDirection({
            state: this._generatorStates[this._generatorIndex],
            direction,

            runtime: this._createRuntime(gen),
        });
    }
    removePosition(index) {
        let gen = this._generators[this._generatorIndex];
        gen.onRemovePosition({
            state: this._generatorStates[this._generatorIndex],
            index,

            runtime: this._createRuntime(gen),
        });
    }
    removeBlockType(index) {
        let gen = this._generators[this._generatorIndex];
        gen.onRemoveBlockType({
            state: this._generatorStates[this._generatorIndex],
            index,

            runtime: this._createRuntime(gen),
        });
    }
    useItem(data) {
        let gen = this._generators[this._generatorIndex];
        gen.onItemUsed && gen.onItemUsed({
            state: this._generatorStates[this._generatorIndex],
            data,

            runtime: this._createRuntime(gen),
        });
    }
    isValidParameter() {
        let gen = this._generators[this._generatorIndex];
        if(!gen.isValidParameter) return true;
        return gen.isValidParameter({
            state: this._generatorStates[this._generatorIndex],
            runtime: this._createRuntime(gen),
        });
    }
    generate() {
        let gen = this._generators[this._generatorIndex];
        return gen.generate({
            state: this._generatorStates[this._generatorIndex],
            runtime: this._createRuntime(gen),
        });
    }
    removeDirection(index) {
        let gen = this._generators[this._generatorIndex];
        gen.onRemoveDirection({
            state: this._generatorStates[this._generatorIndex],
            index,

            runtime: this._createRuntime(gen),
        });
    }
    UIHandler(data) {
        let gen = this._generators[this._generatorIndex];
        gen.UIHandler({
            data,

            state: this._generatorStates[this._generatorIndex],
            runtime: this._createRuntime(gen),
        });
    }
    exit() {
        for(let i = 0; i < this._generatorStates.length; ++i) {
            this._generators[i].onExit({
                state: this._generatorStates[i],
                runtime: this._createRuntime(this._generators[i]),
            });
        }
        this._system.removeUser(this);
    }
    getCurrentGeneratorName() {
        return this._generators[this._generatorIndex].name;
    }
    getGeneratorNames() {
        return this._generators.map((g) => g.name);
    }
    getCurrentUI() {
        return this._generators[this._generatorIndex].ui;
    }
    getCurrentState() {
        return this._generatorStates[this._generatorIndex];
    }
    runNOS(nos, input) {
        let runtime = this._createRuntime(this);
        return runtime.runNOS(nos, input);
    }
    execv(name, input, args) {
        let runtime = this._createRuntime(this);
        return runtime.execv(name, input, args);
    }
    execl(name, input, ...args) {
        let runtime = this._createRuntime(this);
        return runtime.execl(name, input, ...args);
    }
    _createGeneratorBasicE(index) {
        return {
            state: this._generatorStates[index],
            runtime: this._createRuntime(this._generators[index]),
        }
    }
    _createRuntime(plugin) {
        return this._system.createRuntime({
            user: this,

            plugin,

        });
    }
}

exports.UserSystem = UserSystem;

function canonicalGeneratorFactory({
    description,

    criteria: {
        positionArrayLength,

        blockTypeArrayLength,

        directionArrayLength
    },
    option,

    method: {
        generate, UIHandler
    }
}) {
    function onAdd(type, arrayname) {
        return function (e) {
            let { state, runtime } = e;
            let { logger } = runtime;
            let data = e[type];
            let array = state[arrayname];
            let indexOfVacancy = array.indexOf(undefined);
            if (indexOfVacancy !== -1) {
                array[indexOfVacancy] = data
                logger && logger.log("info", `New ${type} accepted.`);
            } else {
                logger && logger.log("warning", `Too many ${type}s!New one is ignored`);
            }
        };
    }
    function onRemove(type, arrayname) {
        return function (e) {
            let { state, index, runtime } = e;
            let { logger } = runtime;
            let array = state[arrayname];
            if (index === undefined) {
                for (index = array.length - 1;
                     index >= 0 && array[index] == undefined;
                     index--);
            }
            if (index >= 0) array[index] = undefined;
            logger && logger.logObject("info", array);
        };
    }
    function createGenerate(generate, postGenerate) {
        return async function (e) {
            let result = await generate(e);
            await postGenerate(e);
            return result;
        };
    }
    function defaultPostGenerate(e) {
        let {state} = e;
        state.positions.fill(undefined);
        state.blockTypes.fill(undefined);
        state.directions.fill(undefined);
    }
    function defaultIsValidParameter(e) {
        let { state, runtime } = e;
        let result = "";
        if (state.blockTypes.indexOf(undefined) != -1)
            result += "Too few blockTypes!Refusing to execute.\n";
        if (state.positions.indexOf(undefined) != -1)
            result += "Too few positions!Refusing to execute.\n";
        if (state.directions.indexOf(undefined) != -1)
            result += "Too few directions!Refusing to execute.";
        if (result == "") return true;
        let { logger } = runtime;
        if(logger) logger.log("error", result);
        return false;
    }
    return {
        name: description.name,

        ui: description.usage.optionUsage,

        onInit(e) {
            let {state} = e;
            Object.assign(state, JSON.parse(JSON.stringify(option)));
            state.positions = new Array(positionArrayLength).fill(undefined);
            state.blockTypes = new Array(blockTypeArrayLength).fill(undefined);
            state.directions = new Array(directionArrayLength).fill(undefined);
        },
        onAddPosition: onAdd("position", "positions"),
        onAddBlockType: onAdd("blockType", "blockTypes"),
        onAddDirection: onAdd("direction", "directions"),
        onRemovePosition: onRemove("position", "positions"),
        onRemoveBlockType: onRemove("blockType", "blockTypes"),
        onRemoveDirection: onRemove("direction", "directions"),
        isValidParameter: defaultIsValidParameter,

        generate: createGenerate(generate, defaultPostGenerate),
        UIHandler,

        onExit(e) { /* no-op */ },
    }
}

exports.canonicalGeneratorFactory = canonicalGeneratorFactory;


/***/ }),
/* 3 */
/***/ ((module) => {

/*
** This file is licensed in BSD 2 Clause.
*/

//TODO:Wrap up the constructor && find better solution.
class Coordinate {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
    add({ x, y, z }) {
        this.x += x;
        this.y += y;
        this.z += z;
    }
}
class Position {
    constructor(coordinate, dimension = "overworld") {
        this.coordinate = coordinate;
        this.dimension = dimension;
    }
}
class BlockType {
    constructor(blockIdentifier, blockState, blockNBT = {}) {
        this.blockIdentifier = blockIdentifier;
        this.blockState = blockState;
        this.blockNBT = blockNBT
    }
}
class Direction {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}
class Block {
    constructor(position, blockType) {
        this.position = position;
        this.blockType = blockType;
    }
}


class Usage {
    constructor(positionUsage, blockTypeUsage, directionUsage, optionUsage) {
        this.positionUsage = positionUsage;
        this.blockTypeUsage = blockTypeUsage;
        this.directionUsage = directionUsage;
        this.optionUsage = optionUsage;
    }
}
class Description {
    constructor(name, usage) {
        this.name = name;
        this.usage = usage;
    }
}
//TODO:Refactor generator
class Generator {
    constructor(description,
        positionArray, blockTypeArray, directionArray, option,
        addPosition, addBlockType, addDirection,
        removePosition, removeBlockType, removeDirection,
        validateParameter, generate, postGenerate, UIHandler) {
        this.description = description;

        this.positionArray = positionArray;
        this.blockTypeArray = blockTypeArray;
        this.directionArray = directionArray;
        this.option = option;

        this.addPosition = addPosition;
        this.addBlockType = addBlockType;
        this.addDirection = addDirection;
        this.removePosition = removePosition;
        this.removeBlockType = removeBlockType;
        this.removeDirection = removeDirection;

        this.validateParameter = validateParameter;
        this.generate = generate;
        this.postGenerate = postGenerate;
        this.UIHandler = UIHandler;
    }
}

class BuildInstruction {
    constructor(type, data) {
        this.type = type;
        this.data = data;
    }
}

module.exports = { Coordinate, Position, BlockType, Block, Direction, Usage, Description, Generator, BuildInstruction };


/***/ }),
/* 4 */
/***/ ((__unused_webpack_module, exports) => {

/*
** This file is licensed in BSD 2 Clause.
*/

class Token{
    constructor(typeName, offset, length, raw, value) {
        return {typeName, offset, length, raw, value};
    }
}

function saferEval(literal) {
    return new Function(`return ${literal};`)();
}

function lex(string) {
    // This doesn't consider UTF-32, which may be fixed soon
    let tokens = [];
    let raw = "";
    let STATES = {
        NORMAL: "NORMAL",
        IN_STRING: "IN_STRING",
        ESCAPE: "ESCAPE"
    };
    let index = 0;
    let quotationMark = undefined;
    let state = STATES.NORMAL;
    for(let i = 0; i < string.length; ++i) {
        let ch = string[i];
        switch(state) {
        case STATES.NORMAL:
            switch(ch) {
            case "\"":
            case "'":
            case "`":
                if(raw !== "") {
                    tokens.push(new Token("directLiteral", index, raw.length, raw, raw));
                }
                raw = ch;
                index = i;
                quotationMark = ch;
                state = STATES.IN_STRING;
                break;
            case " ":
                if(raw !== "") {
                    tokens.push(new Token("directLiteral", index, raw.length, raw, raw));
                }
                raw = "";
                index = i + 1;
                break;
            case "|":
                if(raw !== "") {
                    tokens.push(new Token("directLiteral", index, raw.length, raw, raw));
                }
                raw = "|";
                index = i;
                tokens.push(new Token("operator", index, raw.length, raw, raw));
                raw = "";
                index = i + 1;
                break;
            default:
                raw += ch;
                break;
            }
            break;
        case STATES.IN_STRING:
            switch(ch) {
            case "\\":
                raw += ch;
                state = STATES.ESCAPE;
                break;
            case quotationMark:
                raw += ch;
                if(quotationMark === "`") {
                    throw new SyntaxError("Template literal is still not support.");
                }
                tokens.push(new Token("stringLiteral", index, raw.length, raw, saferEval(raw)));
                raw = "";
                index = i + 1;
                quotationMark = undefined;
                state = STATES.NORMAL;
                break;
            default:
                raw += ch;
                break;
            }
            break;
        case STATES.ESCAPE:
            switch(ch) {
            default:
                raw += ch;
                state = STATES.IN_STRING;
                break;
            }
            break;
        default:
            throw new Error("This never happen!");
            break;
        }
    }
    if(state !== STATES.NORMAL) {
        throw new SyntaxError(`Unclosed string literal ${raw}.`);
    }
    if(raw !== "") {
        tokens.push(new Token("directLiteral", index, raw.length, raw, raw));
    }
    return tokens;
}

exports.lex = lex;

function runNOS(runtime, nos, input) {
    let tokens = lex(nos);
    return tokens.reduce((argss, token) => {
        if(token.typeName === "operator" && token.value === "|") {
            argss.push([]);
        } else {
            argss[argss.length - 1].push(token.value);
        }
    }, [[]])
    .reduce((input, args) => {
        if(args.length === 0) {
            throw new SyntaxError("Unexpected token |");
        }
        runtime.execv(args[0], input, args);
    }, input)
}

exports.runNOS = runNOS;


/***/ }),
/* 5 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _nc_index_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(6);
/*
** This file is planed to be automatically upgraded,
** but currently it isn't.
*/
// import './lxl/index.js'

// import './nz/index.js'

/***/ }),
/* 6 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var norma_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2);
/* harmony import */ var norma_core__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(norma_core__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _utils_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(7);



// import * as preset from './presetBuildingsInterface.js';

norma_core__WEBPACK_IMPORTED_MODULE_0__.systemInstance.registerCanonicalGenerator({
    description:
        new norma_core__WEBPACK_IMPORTED_MODULE_0__.Description("Create a solid cube with two points.",
            new norma_core__WEBPACK_IMPORTED_MODULE_0__.Usage(
                [],
                [],
                [],
                [
                    {
                        viewtype: "button",
                        text: "Toggle quick execution.(Execute on all parameters satisfied)",
                        key: "__executeOnAllSatisfied",
                        data: [
                            { value: true, text: "On", dataForUIHandler: "resetAll" },
                            { value: false, text: "Off", dataForUIHandler: "resetAll" }
                        ]
                    },
                    {
                        viewtype: "button",
                        text: "Infer coordinates from three coordinates.",
                        key: "inferCoordinates",
                        data: [
                            { value: true, text: "On", dataForUIHandler: "threeCoordinates" },
                            { value: false, text: "Off", dataForUIHandler: "twoCoordinates" }
                        ]
                    }
                ])
        ),
    criteria: {
        positionArrayLength: 2,
        blockTypeArrayLength: 1,
        directionArrayLength: 0
    },
    option: {
        "positionsLengthRequired": 2,
        "blockTypesLengthRequired": 1,
        "__executeOnAllSatisfied": false,
        "generateByServer": true,
        "inferCoordinates": false
    },
    method: {
        generate: function (e) {
            let { state } = e
            let { positions, blockTypes, directions } = state

            let halt = false
            if (blockTypes.indexOf(undefined) != -1) halt = true
            if (positions.indexOf(undefined) != -1) halt = true
            if (directions.indexOf(undefined) != -1) halt = true
            if (halt) return
            if (state.generateByServer) {
                if (state.inferCoordinates) {
                    [positions[0].coordinate, positions[1].coordinate] = [
                        new norma_core__WEBPACK_IMPORTED_MODULE_0__.Coordinate(
                            Math.min(
                                positions[0].coordinate.x,
                                positions[1].coordinate.x,
                                positions[2].coordinate.x
                            ),
                            Math.min(
                                positions[0].coordinate.y,
                                positions[1].coordinate.y,
                                positions[2].coordinate.y
                            ),
                            Math.min(
                                positions[0].coordinate.z,
                                positions[1].coordinate.z,
                                positions[2].coordinate.z
                            )
                        ),
                        new norma_core__WEBPACK_IMPORTED_MODULE_0__.Coordinate(
                            Math.max(
                                positions[0].coordinate.x,
                                positions[1].coordinate.x,
                                positions[2].coordinate.x
                            ),
                            Math.max(
                                positions[0].coordinate.y,
                                positions[1].coordinate.y,
                                positions[2].coordinate.y
                            ),
                            Math.max(
                                positions[0].coordinate.z,
                                positions[1].coordinate.z,
                                positions[2].coordinate.z
                            )
                        )
                    ]
                }
                return [{
                    "type": "fill", "data": {
                        blockType: blockTypes[0],
                        startCoordinate: positions[0].coordinate,
                        endCoordinate: positions[1].coordinate
                    }
                }]
            }
            else {
                let blocks = []

                //logger.log("verbose", "NZ is JULAO!")

                let minCoordinate = new norma_core__WEBPACK_IMPORTED_MODULE_0__.Coordinate(
                    Math.min(positions[0].coordinate.x, positions[1].coordinate.x),
                    Math.min(positions[0].coordinate.y, positions[1].coordinate.y),
                    Math.min(positions[0].coordinate.z, positions[1].coordinate.z),
                )
                let maxCoordinate = new norma_core__WEBPACK_IMPORTED_MODULE_0__.Coordinate(
                    Math.max(positions[0].coordinate.x, positions[1].coordinate.x),
                    Math.max(positions[0].coordinate.y, positions[1].coordinate.y),
                    Math.max(positions[0].coordinate.z, positions[1].coordinate.z)
                )

                //logger.log("verbose", "Yes, NZ is JULAO!")

                for (let x = minCoordinate.x; x <= maxCoordinate.x; x++) {
                    for (let y = minCoordinate.y; y <= maxCoordinate.y; y++) {
                        for (let z = minCoordinate.z; z <= maxCoordinate.z; z++) {

                            blocks.push(new norma_core__WEBPACK_IMPORTED_MODULE_0__.Block(
                                new norma_core__WEBPACK_IMPORTED_MODULE_0__.Position(
                                    new norma_core__WEBPACK_IMPORTED_MODULE_0__.Coordinate(x, y, z),
                                    positions[0].dimension
                                ),
                                blockTypes[0])
                            )
                        }
                    }
                }

                return blocks
            }
        },
        UIHandler: function (e) {
            let { state, data } = e;
            let { positions, blockTypes, directions } = state;
            if (data == "resetAll") {
                positions.fill(undefined);
                blockTypes.fill(undefined);
                directions.fill(undefined);
            }
            if (data == "threeCoordinates") {
                positions.push(undefined)
            }
            if (data == "twoCoordinates") {
                positions.pop()
            }
        }
    }
});

norma_core__WEBPACK_IMPORTED_MODULE_0__.systemInstance.registerCanonicalGenerator({
    description: new norma_core__WEBPACK_IMPORTED_MODULE_0__.Description("Clone, ignoring direction.",
        new norma_core__WEBPACK_IMPORTED_MODULE_0__.Usage(
            [],
            [],
            [],
            [])
    ),
    criteria: {
        positionArrayLength: 3,
        blockTypeArrayLength: 0,
        directionArrayLength: 0
    },
    option: {
        "positionArrayLengthRequired": 3,
        "blockTypeArrayLengthRequired": 0,
        "generateByServer": true
    },
    method: {
        generate: function (e) {
            let { state } = e;
            if (state.generateByServer)
                return [{
                    "type": "clone",
                    "data": {
                        startCoordinate: state.positions[0].coordinate,
                        endCoordinate: state.positions[1].coordinate,
                        targetCoordinate: state.positions[2].coordinate
                    }
                }]
            else return []
        },
        UIHandler: function (e) { }
    }
});

let createLineGenerator = (0,norma_core__WEBPACK_IMPORTED_MODULE_0__.canonicalGeneratorFactory)({
    description: new norma_core__WEBPACK_IMPORTED_MODULE_0__.Description("Create a line with given interval.",
        new norma_core__WEBPACK_IMPORTED_MODULE_0__.Usage(
            ["Start point"],
            ["BlockType"],
            ["Direction"],
            [
                {
                    viewtype: "edittext",
                    text: "Length:",
                    key: "length",
                },
                {
                    viewtype: "edittext",
                    text: "Interval:",
                    key: "interval",
                },
                {
                    viewtype: "button",
                    text: "Overwrite default behaviour:discard old position.",
                    key: "doAcceptNewPosition",
                    data: [
                        { value: false, text: "No" },
                        { value: true, text: "Yes" }
                    ]
                },
                {
                    viewtype: "edittext",
                    text: "Vertical gradient:",
                    key: "gradient",
                }
            ])
    ),
    criteria: {
        positionArrayLength: 1,
        blockTypeArrayLength: 1,
        directionArrayLength: 1
    },
    option: {
        "positionArrayLengthRequired": 1,
        "blockTypeArrayLengthRequired": 1,
        "directionArrayLengthRequired": 1,
        "length": 0,
        "interval": 0,
        "gradient": 0,
        "doAcceptNewPosition": false
    },
    method: {
        generate: function (e) {
            let { state } = e;
            let blockArray = [];

            //let logger = runtime.logger;
            //logger.log("verbose", "NZ is JULAO!")

            let positionArray = state.positions
            let blockTypeArray = state.blockTypes
            let directionArray = state.directions

            //logger.log("verbose", "Yes, NZ is JULAO!")


            let direction = (function () {
                if (-45 <= directionArray[0].y && directionArray[0].y <= 45) return "+z"
                else if (-135 <= directionArray[0].y && directionArray[0].y <= -45) return "+x"
                else if (45 <= directionArray[0].y && directionArray[0].y <= 135) return "-x"
                else return "-z"
            }());

            switch (direction) {
                case "+z": {
                    let x = positionArray[0].coordinate.x
                    let y = positionArray[0].coordinate.y
                    for (let z = positionArray[0].coordinate.z; z < state.length + positionArray[0].coordinate.z; z += (state.interval + 1))
                        blockArray.push(new norma_core__WEBPACK_IMPORTED_MODULE_0__.Block(
                            new norma_core__WEBPACK_IMPORTED_MODULE_0__.Position(
                                new norma_core__WEBPACK_IMPORTED_MODULE_0__.Coordinate(x, state.gradient * (z - positionArray[0].coordinate.z) + y, z),
                                positionArray[0].dimension
                            ),
                            blockTypeArray[0])
                        )
                    break;
                }
                case "-z": {
                    let x = positionArray[0].coordinate.x
                    let y = positionArray[0].coordinate.y
                    for (let z = positionArray[0].coordinate.z; z > -state.length + positionArray[0].coordinate.z; z -= (state.interval + 1))
                        blockArray.push(new norma_core__WEBPACK_IMPORTED_MODULE_0__.Block(
                            new norma_core__WEBPACK_IMPORTED_MODULE_0__.Position(
                                new norma_core__WEBPACK_IMPORTED_MODULE_0__.Coordinate(x, -state.gradient * (z - positionArray[0].coordinate.z) + y, z),
                                positionArray[0].dimension
                            ),
                            blockTypeArray[0])
                        )
                    break;
                }
                case "+x": {
                    let z = positionArray[0].coordinate.z
                    let y = positionArray[0].coordinate.y
                    for (let x = positionArray[0].coordinate.x; x < state.length + positionArray[0].coordinate.x; x += (state.interval + 1))
                        blockArray.push(new norma_core__WEBPACK_IMPORTED_MODULE_0__.Block(
                            new norma_core__WEBPACK_IMPORTED_MODULE_0__.Position(
                                new norma_core__WEBPACK_IMPORTED_MODULE_0__.Coordinate(x, state.gradient * (x - positionArray[0].coordinate.x) + y, z),
                                positionArray[0].dimension
                            ),
                            blockTypeArray[0])
                        )
                    break;
                }
                case "-x": {
                    let z = positionArray[0].coordinate.z
                    let y = positionArray[0].coordinate.y
                    for (let x = positionArray[0].coordinate.x; x > -state.length + positionArray[0].coordinate.x; x -= (state.interval + 1))
                        blockArray.push(new norma_core__WEBPACK_IMPORTED_MODULE_0__.Block(
                            new norma_core__WEBPACK_IMPORTED_MODULE_0__.Position(
                                new norma_core__WEBPACK_IMPORTED_MODULE_0__.Coordinate(x, -state.gradient * (x - positionArray[0].coordinate.x) + y, z),
                                positionArray[0].dimension
                            ),
                            blockTypeArray[0])
                        )
                    break;
                }
            }

            return blockArray;
        },
        UIHandler: function (e) { }
    }
})

createLineGenerator.addPosition = function () {
    let { state, position, runtime } = e;
    if (state.doAcceptNewPosition) {
        let indexOfVacancy = state.positions.indexOf(undefined)
        if (indexOfVacancy == -1) {
            runtime.logger && runtime.logger.log("warning", `Too many positions!Discarding the old one...`)
            state.positions = state.positions.slice(1)
            state.positions.push(position)
        }
        else state.positions[indexOfVacancy] = position
        runtime.logger && runtime.logger.log("info", `New position accepted.`)
    }
    else _utils_js__WEBPACK_IMPORTED_MODULE_1__.utils.generators.canonical.addFunction("position", position, state.positions);
}

norma_core__WEBPACK_IMPORTED_MODULE_0__.systemInstance.registerGenerator(createLineGenerator);


norma_core__WEBPACK_IMPORTED_MODULE_0__.systemInstance.registerCanonicalGenerator({
    description:
        new norma_core__WEBPACK_IMPORTED_MODULE_0__.Description("造马路",
            new norma_core__WEBPACK_IMPORTED_MODULE_0__.Usage(
                [],
                [],
                [],
                [
                    {
                        viewtype: "edittext",
                        text: "长度:",
                        key: "length",
                    },
                    {
                        viewtype: "button",
                        text: "马路风格",
                        key: "roadStyle",
                        data: [
                            { value: "NS", text: "北冥/南冥", dataForUIHandler: "preset" },
                            { value: "DB", text: "东沙/冰岛", dataForUIHandler: "preset" },
                            { value: "custom", text: "自定", dataForUIHandler: "custom" }
                        ]
                    },
                    {
                        viewtype: "checkbox",
                        text: "加护栏",
                        key: "isBarred",
                        data: [
                            { value: true, text: "是" },
                            { value: false, text: "否" },
                        ]
                    },
                    {
                        viewtype: "edittext",
                        text: "每一边车道数:",
                        key: "numberOfLanesPerSide",
                    },
                    {
                        viewtype: "edittext",
                        text: "车道宽:",
                        key: "widthOfLanes",
                    },
                    {
                        viewtype: "edittext",
                        text: "白线间隔:",
                        key: "dashLineInterval",
                    },
                    {
                        viewtype: "edittext",
                        text: "白线长度:",
                        key: "dashLineLength",
                    },
                ])
        ),
    criteria: {
        positionArrayLength: 1,
        blockTypeArrayLength: 0,
        directionArrayLength: 1
    },
    option: {
        "length": 10,
        "roadStyle": "NS",
        "isBarred": false,
        "numberOfLanesPerSide": 2,
        "widthOfLanes": 5,
        "dashLineInterval": 3,
        "dashLineLength": 4
    },
    method: {
        generate: function (e) {
            let { state } = e;
            let blockArray = []

            //logger.log("verbose", "NZ is JULAO!")

            let positionArray = state.positions
            let blockTypeArray = state.blockTypes
            let directionArray = state.directions

            //logger.log("verbose", "Yes, NZ is JULAO!")

            //{"blockIdentifier":"minecraft:stained_hardened_clay","blockState":{"color":"cyan"}}

            let materials
            if (state["roadStyle"] == "NS") materials = {
                "surface": new norma_core__WEBPACK_IMPORTED_MODULE_0__.BlockType("minecraft:stained_hardened_clay", { "color": "cyan" }),
                "white_line": new norma_core__WEBPACK_IMPORTED_MODULE_0__.BlockType("minecraft:concrete", { "color": "white" }),
                "yellow_line": new norma_core__WEBPACK_IMPORTED_MODULE_0__.BlockType("minecraft:stained_hardened_clay", { "color": "yellow" }),
                "bar": new norma_core__WEBPACK_IMPORTED_MODULE_0__.BlockType("minecraft:cobblestone_wall", { "wall_block_type": "cobblestone" })
            }
            else if (state["roadStyle"] == "DB") {
                materials = {
                    "surface": new norma_core__WEBPACK_IMPORTED_MODULE_0__.BlockType("minecraft:wool", { "color": "black" }),
                    "white_line": new norma_core__WEBPACK_IMPORTED_MODULE_0__.BlockType("minecraft:wool", { "color": "white" }),
                    "yellow_line": new norma_core__WEBPACK_IMPORTED_MODULE_0__.BlockType("minecraft:wool", { "color": "yellow" }),
                    "bar": new norma_core__WEBPACK_IMPORTED_MODULE_0__.BlockType("minecraft:cobblestone_wall", { "wall_block_type": "cobblestone" })
                }
            }
            else if (state["roadStyle"] == "custom") {
                materials = {
                    "surface": blockTypeArray[0],
                    "white_line": blockTypeArray[1],
                    "yellow_line": blockTypeArray[2],
                    "bar": blockTypeArray[3]
                }
            }

            let playerFacingAxis = (function () {
                if (-45 <= directionArray[0].y && directionArray[0].y <= 45) return "+z"
                else if (-135 <= directionArray[0].y && directionArray[0].y <= -45) return "+x"
                else if (45 <= directionArray[0].y && directionArray[0].y <= 135) return "-x"
                else return "-z"
            }());

            //This assumes the original facing axis is +x.
            let transform = (function (facingAxis) {
                switch (facingAxis) {
                    case "+x": {
                        return _utils_js__WEBPACK_IMPORTED_MODULE_1__.utils.coordinateGeometry.transform(
                            (x, y, z) => x,
                            (x, y, z) => y,
                            (x, y, z) => z
                        )
                    }
                    case "-x": {
                        return _utils_js__WEBPACK_IMPORTED_MODULE_1__.utils.coordinateGeometry.transform(
                            (x, y, z) => 2 * positionArray[0].coordinate.x - x,
                            (x, y, z) => y,
                            (x, y, z) => 2 * positionArray[0].coordinate.z - z
                        )
                    }
                    case "+z": {
                        return _utils_js__WEBPACK_IMPORTED_MODULE_1__.utils.coordinateGeometry.transform(
                            (x, y, z) => positionArray[0].coordinate.x - (z - positionArray[0].coordinate.z),
                            (x, y, z) => y,
                            (x, y, z) => positionArray[0].coordinate.z + (x - positionArray[0].coordinate.x)
                        )
                    }
                    case "-z": {
                        return _utils_js__WEBPACK_IMPORTED_MODULE_1__.utils.coordinateGeometry.transform(
                            (x, y, z) => positionArray[0].coordinate.x + (z - positionArray[0].coordinate.z),
                            (x, y, z) => y,
                            (x, y, z) => positionArray[0].coordinate.z - (x - positionArray[0].coordinate.x)
                        )
                    }
                }
            }(playerFacingAxis))



            let palette = [];

            for (let i = 0; i < state["numberOfLanesPerSide"]; i++) {
                for (let j = 0; j < state["widthOfLanes"]; j++) palette.push("lane")
                if (i < state["numberOfLanesPerSide"] - 1) palette.push("dash_line")
            }
            palette.push("division_line")
            for (let i = 0; i < state["numberOfLanesPerSide"]; i++) {
                for (let j = 0; j < state["widthOfLanes"]; j++) palette.push("lane")
                if (i < state["numberOfLanesPerSide"] - 1) palette.push("dash_line")
            }
            if (state["isBarred"]) palette[0] = palette[palette.length - 1] = "edge"

            const offset = (palette.length - 1) / 2;
            for (let i = 0; i < palette.length; i++) {
                switch (palette[i]) {
                    case "edge": {
                        for (let coordinate of _utils_js__WEBPACK_IMPORTED_MODULE_1__.utils.coordinateGeometry.generateLineWithTwoPoints(
                            positionArray[0].coordinate.x, positionArray[0].coordinate.y, positionArray[0].coordinate.z + i - offset,
                            positionArray[0].coordinate.x + state["length"] - 1, positionArray[0].coordinate.y, positionArray[0].coordinate.z + i - offset)
                        ) {
                            blockArray.push(
                                new norma_core__WEBPACK_IMPORTED_MODULE_0__.Block(
                                    new norma_core__WEBPACK_IMPORTED_MODULE_0__.Position(
                                        transform(coordinate),
                                        positionArray[0].dimension
                                    ),
                                    materials["surface"]
                                )
                            )
                        }
                        for (let coordinate of _utils_js__WEBPACK_IMPORTED_MODULE_1__.utils.coordinateGeometry.generateLineWithTwoPoints(
                            positionArray[0].coordinate.x, positionArray[0].coordinate.y + 1, positionArray[0].coordinate.z + i - offset,
                            positionArray[0].coordinate.x + state["length"] - 1, positionArray[0].coordinate.y + 1, positionArray[0].coordinate.z + i - offset)
                        ) {
                            blockArray.push(
                                new norma_core__WEBPACK_IMPORTED_MODULE_0__.Block(
                                    new norma_core__WEBPACK_IMPORTED_MODULE_0__.Position(
                                        transform(coordinate),
                                        positionArray[0].dimension
                                    ),
                                    materials["bar"]
                                )
                            )
                        }
                        break;
                    }
                    case "lane": {
                        for (let coordinate of _utils_js__WEBPACK_IMPORTED_MODULE_1__.utils.coordinateGeometry.generateLineWithTwoPoints(
                            positionArray[0].coordinate.x, positionArray[0].coordinate.y, positionArray[0].coordinate.z + i - offset,
                            positionArray[0].coordinate.x + state["length"] - 1, positionArray[0].coordinate.y, positionArray[0].coordinate.z + i - offset)
                        ) {
                            blockArray.push(
                                new norma_core__WEBPACK_IMPORTED_MODULE_0__.Block(
                                    new norma_core__WEBPACK_IMPORTED_MODULE_0__.Position(
                                        transform(coordinate),
                                        positionArray[0].dimension
                                    ),
                                    materials["surface"]
                                )
                            )
                        }
                        break;
                    }
                    case "dash_line": {
                        for (let j = 0; j <= state["length"] - 1; j++) {
                            let position = new norma_core__WEBPACK_IMPORTED_MODULE_0__.Position(transform(new norma_core__WEBPACK_IMPORTED_MODULE_0__.Coordinate(positionArray[0].coordinate.x + j, positionArray[0].coordinate.y, positionArray[0].coordinate.z + i - offset)), positionArray[0].dimension)
                            if ((j % (state["dashLineInterval"] + state["dashLineLength"])) < state["dashLineInterval"]) //Black first.
                                blockArray.push(new norma_core__WEBPACK_IMPORTED_MODULE_0__.Block(position, materials["surface"]))
                            else
                                blockArray.push(new norma_core__WEBPACK_IMPORTED_MODULE_0__.Block(position, materials["white_line"]))
                        }
                        break;
                    }
                    case "division_line": {
                        for (let coordinate of _utils_js__WEBPACK_IMPORTED_MODULE_1__.utils.coordinateGeometry.generateLineWithTwoPoints(
                            positionArray[0].coordinate.x, positionArray[0].coordinate.y, positionArray[0].coordinate.z + i - offset,
                            positionArray[0].coordinate.x + state["length"] - 1, positionArray[0].coordinate.y, positionArray[0].coordinate.z + i - offset)
                        ) {
                            blockArray.push(
                                new norma_core__WEBPACK_IMPORTED_MODULE_0__.Block(
                                    new norma_core__WEBPACK_IMPORTED_MODULE_0__.Position(
                                        transform(coordinate),
                                        positionArray[0].dimension
                                    ),
                                    materials["yellow_line"]
                                )
                            )
                        }
                        break;
                    }
                }
            }

            // following are postGenerate
            state.positions = [undefined]
            if (state["roadStyle"] == "custom") state.blockTypes = [undefined, undefined, undefined, undefined];
            else state.blockTypeArray = [];
            state.blockTypes = [];
            state.directions = [undefined];
            return blockArray
        },
        UIHandler: function (e) {
            let { state, data } = e;
            if (data == "custom") {
                //logger.log("info", "Using custom materials.")
                //logger.log("info", "First block type for surface.")
                //logger.log("info", "Second for white line.")
                //logger.log("info", "Third for yellow line.")
                //logger.log("info", "Fourth for bar.")
                state.blockTypes = [undefined, undefined, undefined, undefined]
            }
            else {
                //logger.log("info", "Using preset materials. Custom materials are erased!")
                state.blockTypes = []
            }
        }
    }
});

norma_core__WEBPACK_IMPORTED_MODULE_0__.systemInstance.registerCanonicalGenerator({
    description:
        new norma_core__WEBPACK_IMPORTED_MODULE_0__.Description("Construct railway",
            new norma_core__WEBPACK_IMPORTED_MODULE_0__.Usage(
                [],
                [],
                [],
                [
                    {
                        viewtype: "edittext",
                        text: "Length:",
                        key: "length",
                    },
                    {
                        viewtype: "checkbox",
                        text: "加护栏",
                        key: "isBarred",
                        data: [
                            { value: true, text: "是" },
                            { value: false, text: "否" },
                        ]
                    }
                ])
        ),
    criteria: {
        positionArrayLength: 1,
        blockTypeArrayLength: 0,
        directionArrayLength: 1
    },
    option: {
        "length": 10,
        "isBarred": false
    },
    method: {
        generate: function (e) {
            let { state } = e;
            let blockArray = []

            //logger.log("verbose", "NZ is JULAO!")

            let positionArray = state.positions
            let blockTypeArray = state.blockTypes
            let directionArray = state.directions
            //logger.log("verbose", "Yes, NZ is JULAO!")

            let directionMark = (function () {
                if (-45 <= directionArray[0].y && directionArray[0].y <= 45) return "+z"
                else if (-135 <= directionArray[0].y && directionArray[0].y <= -45) return "+x"
                else if (45 <= directionArray[0].y && directionArray[0].y <= 135) return "-x"
                else return "-z"
            }());

            let materials = {
                "glass_pane": new norma_core__WEBPACK_IMPORTED_MODULE_0__.BlockType("minecraft:glass_pane", null),
                "iron_block": new norma_core__WEBPACK_IMPORTED_MODULE_0__.BlockType("minecraft:iron_block", null),
                "red_stone_torch": new norma_core__WEBPACK_IMPORTED_MODULE_0__.BlockType("minecraft:redstone_torch", { "torch_facing_direction": "top" }),
                "rail": _utils_js__WEBPACK_IMPORTED_MODULE_1__.utils.blockGeometry.setBlockDirection(new norma_core__WEBPACK_IMPORTED_MODULE_0__.BlockType("minecraft:golden_rail", { "rail_data_bit": false, "rail_direction": 0 }), (directionMark == "+x" || directionMark == "-x") ? "x" : "z")
            }



            //This assumes the original facing axis is +x.
            let transform = (function (facingAxis) {
                switch (facingAxis) {
                    case "+x": {
                        return _utils_js__WEBPACK_IMPORTED_MODULE_1__.utils.coordinateGeometry.transform(
                            (x, y, z) => x,
                            (x, y, z) => y,
                            (x, y, z) => z
                        )
                    }
                    case "-x": {
                        return _utils_js__WEBPACK_IMPORTED_MODULE_1__.utils.coordinateGeometry.transform(
                            (x, y, z) => 2 * positionArray[0].coordinate.x - x,
                            (x, y, z) => y,
                            (x, y, z) => 2 * positionArray[0].coordinate.z - z
                        )
                    }
                    case "+z": {
                        return _utils_js__WEBPACK_IMPORTED_MODULE_1__.utils.coordinateGeometry.transform(
                            (x, y, z) => positionArray[0].coordinate.x - (z - positionArray[0].coordinate.z),
                            (x, y, z) => y,
                            (x, y, z) => positionArray[0].coordinate.z + (x - positionArray[0].coordinate.x)
                        )
                    }
                    case "-z": {
                        return _utils_js__WEBPACK_IMPORTED_MODULE_1__.utils.coordinateGeometry.transform(
                            (x, y, z) => positionArray[0].coordinate.x + (z - positionArray[0].coordinate.z),
                            (x, y, z) => y,
                            (x, y, z) => positionArray[0].coordinate.z - (x - positionArray[0].coordinate.x)
                        )
                    }
                }
            }(directionMark))

            let palette = ["rail", "redstone", "rail"];

            if (state["isBarred"]) {
                palette.unshift("edge")
                palette.push("edge")
            }

            const offset = (palette.length - 1) / 2;
            for (let i = 0; i < palette.length; i++) {
                switch (palette[i]) {
                    case "edge": {
                        for (let coordinate of _utils_js__WEBPACK_IMPORTED_MODULE_1__.utils.coordinateGeometry.generateLineWithTwoPoints(
                            positionArray[0].coordinate.x, positionArray[0].coordinate.y, positionArray[0].coordinate.z + i - offset,
                            positionArray[0].coordinate.x + state["length"] - 1, positionArray[0].coordinate.y, positionArray[0].coordinate.z + i - offset)
                        ) {
                            blockArray.push(
                                new norma_core__WEBPACK_IMPORTED_MODULE_0__.Block(
                                    new norma_core__WEBPACK_IMPORTED_MODULE_0__.Position(
                                        transform(coordinate),
                                        positionArray[0].dimension
                                    ),
                                    materials["iron_block"]
                                )
                            )
                        }
                        for (let coordinate of _utils_js__WEBPACK_IMPORTED_MODULE_1__.utils.coordinateGeometry.generateLineWithTwoPoints(
                            positionArray[0].coordinate.x, positionArray[0].coordinate.y + 1, positionArray[0].coordinate.z + i - offset,
                            positionArray[0].coordinate.x + state["length"] - 1, positionArray[0].coordinate.y + 1, positionArray[0].coordinate.z + i - offset)
                        ) {
                            blockArray.push(
                                new norma_core__WEBPACK_IMPORTED_MODULE_0__.Block(
                                    new norma_core__WEBPACK_IMPORTED_MODULE_0__.Position(
                                        transform(coordinate),
                                        positionArray[0].dimension
                                    ),
                                    materials["glass_pane"]
                                )
                            )
                        }
                        break;
                    }
                    case "rail": {
                        for (let coordinate of _utils_js__WEBPACK_IMPORTED_MODULE_1__.utils.coordinateGeometry.generateLineWithTwoPoints(
                            positionArray[0].coordinate.x, positionArray[0].coordinate.y, positionArray[0].coordinate.z + i - offset,
                            positionArray[0].coordinate.x + state["length"] - 1, positionArray[0].coordinate.y, positionArray[0].coordinate.z + i - offset)
                        ) {
                            blockArray.push(
                                new norma_core__WEBPACK_IMPORTED_MODULE_0__.Block(
                                    new norma_core__WEBPACK_IMPORTED_MODULE_0__.Position(
                                        transform(coordinate),
                                        positionArray[0].dimension
                                    ),
                                    materials["iron_block"]
                                )
                            )
                        }
                        for (let coordinate of _utils_js__WEBPACK_IMPORTED_MODULE_1__.utils.coordinateGeometry.generateLineWithTwoPoints(
                            positionArray[0].coordinate.x, positionArray[0].coordinate.y + 1, positionArray[0].coordinate.z + i - offset,
                            positionArray[0].coordinate.x + state["length"] - 1, positionArray[0].coordinate.y + 1, positionArray[0].coordinate.z + i - offset)
                        ) {
                            blockArray.push(
                                new norma_core__WEBPACK_IMPORTED_MODULE_0__.Block(
                                    new norma_core__WEBPACK_IMPORTED_MODULE_0__.Position(
                                        transform(coordinate),
                                        positionArray[0].dimension
                                    ),
                                    materials["rail"]
                                )
                            )
                        }
                        break;
                    }
                    case "redstone": {
                        for (let coordinate of _utils_js__WEBPACK_IMPORTED_MODULE_1__.utils.coordinateGeometry.generateLineWithTwoPoints(
                            positionArray[0].coordinate.x, positionArray[0].coordinate.y, positionArray[0].coordinate.z + i - offset,
                            positionArray[0].coordinate.x + state["length"] - 1, positionArray[0].coordinate.y, positionArray[0].coordinate.z + i - offset)
                        ) {
                            blockArray.push(
                                new norma_core__WEBPACK_IMPORTED_MODULE_0__.Block(
                                    new norma_core__WEBPACK_IMPORTED_MODULE_0__.Position(
                                        transform(coordinate),
                                        positionArray[0].dimension
                                    ),
                                    materials["iron_block"]
                                )
                            )
                        }
                        for (let j = 0; j < state["length"] - 1; j++) {
                            let position = new norma_core__WEBPACK_IMPORTED_MODULE_0__.Position(transform(new norma_core__WEBPACK_IMPORTED_MODULE_0__.Coordinate(positionArray[0].coordinate.x + j, positionArray[0].coordinate.y + 1, positionArray[0].coordinate.z + i - offset)), positionArray[0].dimension)
                            if (j % 15 == 0) blockArray.push(new norma_core__WEBPACK_IMPORTED_MODULE_0__.Block(position, materials["red_stone_torch"]))
                        }
                        break;
                    }
                }
            }

            return blockArray
        },
        UIHandler: function (e) { /* no-op */ },
    }
});

norma_core__WEBPACK_IMPORTED_MODULE_0__.systemInstance.registerCanonicalGenerator({
    description:
        new norma_core__WEBPACK_IMPORTED_MODULE_0__.Description("Create a triangle.(Broken)",
            new norma_core__WEBPACK_IMPORTED_MODULE_0__.Usage(
                [],
                [],
                [],
                []
            )
        ),
    criteria: {
        positionArrayLength: 3,
        blockTypeArrayLength: 1,
        directionArrayLength: 0
    },
    option: {
    },
    method: {
        generate: function (e) {
            let { state } = e;
            let blockArray = []

            //logger.log("verbose", "NZ is JULAO!")

            let positionArray = state.positions
            let blockTypeArray = state.blockTypes

            //logger.log("verbose", "Yes, NZ is JULAO!")

            let coordinateArray = _utils_js__WEBPACK_IMPORTED_MODULE_1__.utils.coordinateGeometry.generateFilledPlanarTriangle(
                positionArray[0].coordinate.x, positionArray[0].coordinate.y, positionArray[0].coordinate.z,
                positionArray[1].coordinate.x, positionArray[1].coordinate.y, positionArray[1].coordinate.z,
                positionArray[2].coordinate.x, positionArray[2].coordinate.y, positionArray[2].coordinate.z)

            for (const coordinate of coordinateArray) {
                blockArray.push(new norma_core__WEBPACK_IMPORTED_MODULE_0__.Block(
                    new norma_core__WEBPACK_IMPORTED_MODULE_0__.Position(
                        coordinate,
                        positionArray[0].dimension
                    ),
                    blockTypeArray[0])
                )
            }

            return blockArray;
        },
        UIHandler: function (e) { /* no-op */ },
    }
});

norma_core__WEBPACK_IMPORTED_MODULE_0__.systemInstance.registerCanonicalGenerator({
    description: new norma_core__WEBPACK_IMPORTED_MODULE_0__.Description("Clear terrain",
        new norma_core__WEBPACK_IMPORTED_MODULE_0__.Usage(
            [],
            [],
            [],
            []
        )
    ),
    criteria: {
        positionArrayLength: 2,
        blockTypeArrayLength: 0,
        directionArrayLength: 0
    },
    option: {
        "generateByServer": true,
    },
    method: {
        generate: function (e) {
            let { state } = e;
            if (state.generateByServer) {
                //logger.log("verbose", "NZ is JULAO!")

                let x_min = Math.min(state.positions[0].coordinate.x, state.positions[1].coordinate.x)
                let z_min = Math.min(state.positions[0].coordinate.z, state.positions[1].coordinate.z)

                let x_max = Math.max(state.positions[0].coordinate.x, state.positions[1].coordinate.x)
                let z_max = Math.max(state.positions[0].coordinate.z, state.positions[1].coordinate.z)

                let y_start = (Math.abs(state.positions[0].coordinate.y - 69) < Math.abs(state.positions[1].coordinate.y - 69)) ? state.positions[0].coordinate.y : state.positions[1].coordinate.y

                return [{
                    "type": "fill",
                    "data": {
                        "startCoordinate": new norma_core__WEBPACK_IMPORTED_MODULE_0__.Coordinate(x_min, y_start + 1, z_min),
                        "endCoordinate": new norma_core__WEBPACK_IMPORTED_MODULE_0__.Coordinate(x_max, 255, z_max),
                        "blockType": {
                            "blockIdentifier": "minecraft:air",
                            "blockState": null
                        }
                    }
                }]
            }
            else {
                let blockArray = []

                //logger.log("verbose", "NZ is JULAO!")

                let positionArray = state.positions
                let blockTypeArray = state.blockTypes

                let x_min = Math.min(positionArray[0].coordinate.x, positionArray[1].coordinate.x)
                let z_min = Math.min(positionArray[0].coordinate.z, positionArray[1].coordinate.z)

                let x_max = Math.max(positionArray[0].coordinate.x, positionArray[1].coordinate.x)
                let z_max = Math.max(positionArray[0].coordinate.z, positionArray[1].coordinate.z)

                let y_start = (Math.abs(positionArray[0].coordinate.y - 69) < Math.abs(positionArray[1].coordinate.y - 69)) ? positionArray[0].coordinate.y : positionArray[1].coordinate.y

                for (let x = x_min; x <= x_max; x++) {
                    for (let y = y_start; y <= 256; y++) {
                        for (let z = z_min; z <= z_max; z++) {

                            blockArray.push(new norma_core__WEBPACK_IMPORTED_MODULE_0__.Block(
                                new norma_core__WEBPACK_IMPORTED_MODULE_0__.Position(
                                    new norma_core__WEBPACK_IMPORTED_MODULE_0__.Coordinate(x, y, z),
                                    positionArray[0].dimension
                                ),
                                {
                                    "blockIdentifier": "minecraft:air",
                                    "blockState": null
                                })
                            )
                        }
                    }
                }

                return blockArray
            }
        },
        UIHandler: function (e) { /* no-op */ },
    }
});

norma_core__WEBPACK_IMPORTED_MODULE_0__.systemInstance.registerCanonicalGenerator({
    description: new norma_core__WEBPACK_IMPORTED_MODULE_0__.Description("Create polygon.",
        new norma_core__WEBPACK_IMPORTED_MODULE_0__.Usage(
            [],
            [],
            [],
            [
                {
                    viewtype: "edittext",
                    text: "Number of sides:",
                    key: "numberOfSides",
                },
                {
                    viewtype: "edittext",
                    text: "Radius:",
                    key: "r",
                }
            ])
    ),
    criteria: {
        positionArrayLength: 1,
        blockTypeArrayLength: 0,
        directionArrayLength: 0
    },
    option: {
        "numberOfSides": 6,
        "r": 10,
    },
    method: {
        generate: function (e) {
            let { state } = e;
            let blockArray = [];

            //logger.log("verbose", "NZ is JULAO!")

            let positionArray = state.positions

            let coordinateArray = []

            for (let theta = 0; theta <= 2 * Math.PI; theta += 2 * Math.PI / state.numberOfSides) {
                coordinateArray = coordinateArray.concat(_utils_js__WEBPACK_IMPORTED_MODULE_1__.utils.coordinateGeometry.withBresenhamAlgorithm.generateLineWithTwoPoints(
                    positionArray[0].coordinate.x + state.r * Math.cos(theta), positionArray[0].coordinate.y, positionArray[0].coordinate.z + state.r * Math.sin(theta),
                    positionArray[0].coordinate.x + state.r * Math.cos(theta + 2 * Math.PI / state.numberOfSides), positionArray[0].coordinate.y, positionArray[0].coordinate.z + state.r * Math.sin(theta + 2 * Math.PI / state.numberOfSides)
                ))
            }


            for (let coordinate of coordinateArray)
                blockArray.push(new norma_core__WEBPACK_IMPORTED_MODULE_0__.Block(
                    new norma_core__WEBPACK_IMPORTED_MODULE_0__.Position(
                        coordinate,
                        positionArray[0].dimension
                    ),
                    new norma_core__WEBPACK_IMPORTED_MODULE_0__.BlockType("minecraft:stained_hardened_clay", { "color": "cyan" })
                ))

            return blockArray
        },
        UIHandler: function (e) { /* no-op */ },
    }
});

norma_core__WEBPACK_IMPORTED_MODULE_0__.systemInstance.registerCanonicalGenerator({
    description: new norma_core__WEBPACK_IMPORTED_MODULE_0__.Description("Create circle.(on xz plane)",
        new norma_core__WEBPACK_IMPORTED_MODULE_0__.Usage(
            [],
            [],
            [],
            [
                {
                    viewtype: "edittext",
                    text: "Radius:(Must be integer?)",
                    key: "r",
                }
            ])
    ),
    criteria: {
        positionArrayLength: 1,
        blockTypeArrayLength: 1,
        directionArrayLength: 0
    },
    option: {
        "r": 10,
    },
    method: {
        generate: function (e) {
            let { state } = e;
            let blockArray = []



            //logger.log("verbose", "NZ is JULAO!")

            let positionArray = state.positions
            let blockTypeArray = state.blockTypes

            let coordinateArray = []

            _utils_js__WEBPACK_IMPORTED_MODULE_1__.utils.coordinateGeometry.withBresenhamAlgorithm.generate2DCircle(positionArray[0].coordinate.x, positionArray[0].coordinate.z, state.r)
                .forEach((coordinate) => {
                    coordinateArray.push(new norma_core__WEBPACK_IMPORTED_MODULE_0__.Coordinate(coordinate.x, positionArray[0].coordinate.y, coordinate.y))
                })


            for (let coordinate of coordinateArray)
                blockArray.push(new norma_core__WEBPACK_IMPORTED_MODULE_0__.Block(
                    new norma_core__WEBPACK_IMPORTED_MODULE_0__.Position(
                        coordinate,
                        positionArray[0].dimension
                    ),
                    blockTypeArray[0]
                ))

            return blockArray
        },
        UIHandler: function (e) { /* no-op */ },
    }
});

norma_core__WEBPACK_IMPORTED_MODULE_0__.systemInstance.registerCanonicalGenerator({
    description: new norma_core__WEBPACK_IMPORTED_MODULE_0__.Description("Create sphere.",
        new norma_core__WEBPACK_IMPORTED_MODULE_0__.Usage(
            [],
            [],
            [],
            [
                {
                    viewtype: "edittext",
                    text: "Radius:",
                    key: "r",
                },
                {
                    viewtype: "button",
                    text: "Hollow",
                    key: "isHollow",
                    data: [
                        { value: true, text: "Yes" },
                        { value: false, text: "No" }
                    ]
                }
            ])
    ),
    criteria: {
        positionArrayLength: 1,
        blockTypeArrayLength: 1,
        directionArrayLength: 0
    },
    option: {
        "r": 10,
        "isHollow": false,
    },
    method: {
        generate: function (e) {
            let { state } = e;
            let blockArray = []



            //logger.log("verbose", "NZ is JULAO!")

            let positionArray = state.positions
            let blockTypeArray = state.blockTypes

            let coordinateArray = state.isHollow ?
                _utils_js__WEBPACK_IMPORTED_MODULE_1__.utils.coordinateGeometry.generateHollowSphere(positionArray[0].coordinate.x, positionArray[0].coordinate.y, positionArray[0].coordinate.z, state.r) :
                _utils_js__WEBPACK_IMPORTED_MODULE_1__.utils.coordinateGeometry.generateSphere(positionArray[0].coordinate.x, positionArray[0].coordinate.y, positionArray[0].coordinate.z, state.r)

            for (let coordinate of coordinateArray)
                blockArray.push(new norma_core__WEBPACK_IMPORTED_MODULE_0__.Block(
                    new norma_core__WEBPACK_IMPORTED_MODULE_0__.Position(
                        coordinate,
                        positionArray[0].dimension
                    ),
                    blockTypeArray[0]
                ))

            return blockArray
        },
        UIHandler: function (e) { /* no-op */ },
    }
});

let flagGenerator = (0,norma_core__WEBPACK_IMPORTED_MODULE_0__.canonicalGeneratorFactory)({
    description: new norma_core__WEBPACK_IMPORTED_MODULE_0__.Description("Generate The Flag of Norma Federal Republic",
        new norma_core__WEBPACK_IMPORTED_MODULE_0__.Usage(
            [],
            [],
            [],
            [
                {
                    viewtype: "edittext",
                    text: "Height:(Must be even)",
                    key: "height",
                }
            ])
    ),
    criteria: {
        positionArrayLength: 1,
        blockTypeArrayLength: 0,
        directionArrayLength: 0
    },
    option: {
        "height": 10,
    },
    method: {
        generate: function (e) {
            let { state } = e;
            let blockArray = []
            let positionArray = state.positions;
            let option = state;

            for (let x = positionArray[0].coordinate.x; x < positionArray[0].coordinate.x + option.height; x++)
                for (let y = positionArray[0].coordinate.y; y > positionArray[0].coordinate.y - option.height; y--) {
                    let z = x - positionArray[0].coordinate.x + positionArray[0].coordinate.z;
                    let blockType = (function () {
                        if ((x - positionArray[0].coordinate.x <= positionArray[0].coordinate.y - y) && (positionArray[0].coordinate.y - y < option.height - (x - positionArray[0].coordinate.x))) return new norma_core__WEBPACK_IMPORTED_MODULE_0__.BlockType("minecraft:wool", { "color": "blue" })
                        else if (positionArray[0].coordinate.y - y < option.height / 2) return new norma_core__WEBPACK_IMPORTED_MODULE_0__.BlockType("minecraft:wool", { "color": "yellow" })
                        else return new norma_core__WEBPACK_IMPORTED_MODULE_0__.BlockType("minecraft:wool", { "color": "red" })
                    })()
                    blockArray.push(new norma_core__WEBPACK_IMPORTED_MODULE_0__.Block(new norma_core__WEBPACK_IMPORTED_MODULE_0__.Position(new norma_core__WEBPACK_IMPORTED_MODULE_0__.Coordinate(x, y, z), positionArray[0].dimension), blockType))
                }


            return blockArray
        },
        UIHandler: function (e) { /* no-op */ },
    }
});

flagGenerator.isValidParameter = function (e) {
    let { state, runtime } = e;
    let result = "";
    if (state.blockTypes.indexOf(undefined) != -1)
        result += "Too few blockTypes!Refusing to execute.\n"
    if (state.positions.indexOf(undefined) != -1)
        result += "Too few positions!Refusing to execute."
    if (state.height % 2 != 0) result += "The height is odd!"
    if (result == "") return true;

    runtime.logger && runtime.logger.log("info", result);
    return false;
};

norma_core__WEBPACK_IMPORTED_MODULE_0__.systemInstance.registerGenerator(flagGenerator);

norma_core__WEBPACK_IMPORTED_MODULE_0__.systemInstance.registerCanonicalGenerator({
    description: new norma_core__WEBPACK_IMPORTED_MODULE_0__.Description("Construct subway",
        new norma_core__WEBPACK_IMPORTED_MODULE_0__.Usage(
            [],
            [],
            [],
            [
                {
                    viewtype: "edittext",
                    text: "Length:",
                    key: "length",
                },
                {
                    viewtype: "checkbox",
                    text: "Use glass",
                    key: "useGlass",
                    data: [
                        { value: true, text: "Yes" },
                        { value: false, text: "No" },
                    ]
                },
                {
                    viewtype: "checkbox",
                    text: "Carnival!\(Require \' Use glass\' to be opened\)",
                    key: "useColorfulGlass",
                    data: [
                        { value: true, text: "Yes" },
                        { value: false, text: "No" },
                    ]

                }
            ])
    ),
    criteria: {
        positionArrayLength: 1,
        blockTypeArrayLength: 0,
        directionArrayLength: 1,
    },
    option: {
        "length": 10,
        "useGlass": false,
        "useColorfulGlass": false,
    },
    method: {
        generate: function (e) {
            let { state } = e;
            let blockArray = []

            //logger.log("verbose", "NZ is JULAO!")

            let positionArray = state.positions;
            let blockTypeArray = state.blockTypes;
            let directionArray = state.directions;
            let option = state;
            //logger.log("verbose", "Yes, NZ is JULAO!")

            const directionMark = _utils_js__WEBPACK_IMPORTED_MODULE_1__.utils.geometry.getDirectionMark.horizontal(directionArray[0].y)


            const materials = {
                "glass": new norma_core__WEBPACK_IMPORTED_MODULE_0__.BlockType("minecraft:glass", null),
                "brick": new norma_core__WEBPACK_IMPORTED_MODULE_0__.BlockType("minecraft:stonebrick", { "stone_brick_type": "default" }),
                "prismarine": new norma_core__WEBPACK_IMPORTED_MODULE_0__.BlockType("minecraft:prismarine", { "prismarine_block_type": "bricks" }),
                "lantern": new norma_core__WEBPACK_IMPORTED_MODULE_0__.BlockType("minecraft:seaLantern", null),
                "air": new norma_core__WEBPACK_IMPORTED_MODULE_0__.BlockType("minecraft:air", null),
                "red_stone_torch": new norma_core__WEBPACK_IMPORTED_MODULE_0__.BlockType("minecraft:redstone_torch", { "torch_facing_direction": "top" }),
                "rail": _utils_js__WEBPACK_IMPORTED_MODULE_1__.utils.blockGeometry.setBlockDirection(new norma_core__WEBPACK_IMPORTED_MODULE_0__.BlockType("minecraft:golden_rail", { "rail_data_bit": false, "rail_direction": 0 }), (directionMark == "+x" || directionMark == "-x") ? "x" : "z"),
                "sponge": new norma_core__WEBPACK_IMPORTED_MODULE_0__.BlockType("minecraft:sponge", { "sponge_type": "dry" })
            }

            const schematics = [
                ["void", "ceiling", "ceiling", "ceiling", "ceiling", "ceiling", "void"],
                ["wall", "void", "void", "void", "void", "void", "wall"],
                ["wall/light", "void", "void", "void", "void", "void", "wall/light"],
                ["wall", "void", "void", "void", "void", "void", "wall"],
                ["wall", "void", "rail", "void/redstone", "rail", "void", "wall"],
                ["ground", "ground", "ground", "ground", "ground", "ground", "ground"]
            ]

            let offset = { x: 0, y: -5, z: 3 }
            function getRandomColor() {
                const colorSet = ["white",
                    "orange",
                    "magenta",
                    "light_blue",
                    "yellow",
                    "lime",
                    "pink",
                    "gray",
                    "silver",
                    "cyan",
                    "purple",
                    "blue",
                    "brown",
                    "green",
                    "red",
                    "black"]
                return colorSet[Math.floor(Math.random() * colorSet.length)]
            }
            //Assuming the building is in +x direction.
            const recipe = {
                "void": function (coordinate) { return materials["air"] },
                "wall": function (coordinate) { return option.useGlass ? (option.useColorfulGlass ? new norma_core__WEBPACK_IMPORTED_MODULE_0__.BlockType("minecraft:stained_glass", { color: getRandomColor() }) : materials["glass"]) : materials["brick"] },
                "ceiling": function (coordinate) { return option.useGlass ? (option.useColorfulGlass ? new norma_core__WEBPACK_IMPORTED_MODULE_0__.BlockType("minecraft:stained_glass", { color: getRandomColor() }) : materials["glass"]) : materials["brick"] },
                "ground": function (coordinate) {
                    return option.useGlass ? materials["prismarine"] : materials["brick"]
                },
                "wall/light": function (coordinate) {
                    if (coordinate.x % 5 == 0) return materials["lantern"]
                    else return option.useGlass ? (option.useColorfulGlass ? new norma_core__WEBPACK_IMPORTED_MODULE_0__.BlockType("minecraft:stained_glass", { color: getRandomColor() }) : materials["glass"]) : materials["brick"]
                },
                "rail": function (coordinate) { return materials["rail"] },
                "void/redstone": function (coordinate) {
                    //logger.logObject("debug", coordinate)
                    if (coordinate.x % 16 == 0) return materials["red_stone_torch"]
                    else return materials["air"]
                }
            }

            blockArray = (function (position, length, directionMark, schematics, offset, recipe, y_sequence) {
                let blockArray = []
                if (y_sequence == undefined) {
                    y_sequence = new Array(schematics.length)
                    for (let i = 0; i < schematics.length; i++) y_sequence[i] = i
                }
                let transform = (function (facingAxis) {
                    switch (facingAxis) {
                        case "+x": {
                            return _utils_js__WEBPACK_IMPORTED_MODULE_1__.utils.coordinateGeometry.transform(
                                (x, y, z) => x,
                                (x, y, z) => y,
                                (x, y, z) => z
                            )
                        }
                        case "-x": {
                            return _utils_js__WEBPACK_IMPORTED_MODULE_1__.utils.coordinateGeometry.transform(
                                (x, y, z) => - x,
                                (x, y, z) => y,
                                (x, y, z) => - z
                            )
                        }
                        case "+z": {
                            return _utils_js__WEBPACK_IMPORTED_MODULE_1__.utils.coordinateGeometry.transform(
                                (x, y, z) => -z,
                                (x, y, z) => y,
                                (x, y, z) => x
                            )
                        }
                        case "-z": {
                            return _utils_js__WEBPACK_IMPORTED_MODULE_1__.utils.coordinateGeometry.transform(
                                (x, y, z) => z,
                                (x, y, z) => y,
                                (x, y, z) => -x
                            )
                        }
                    }
                }(directionMark))
                for (let x = 0; x < length; x++)
                    for (let y of y_sequence)
                        for (let z = 0; z < schematics[y].length; z++) {
                            let rawCoordinate = new norma_core__WEBPACK_IMPORTED_MODULE_0__.Coordinate(x - offset.x, -y - offset.y, z - offset.z)
                            let relativeCoordinate = transform(rawCoordinate)
                            let absoluteCordinate = new norma_core__WEBPACK_IMPORTED_MODULE_0__.Coordinate(
                                relativeCoordinate.x + position.coordinate.x,
                                relativeCoordinate.y + position.coordinate.y,
                                relativeCoordinate.z + position.coordinate.z,
                            )
                            e.runtime.logger.log("verbose", "NZ IS JULAO")
                            blockArray.push(new norma_core__WEBPACK_IMPORTED_MODULE_0__.Block(
                                new norma_core__WEBPACK_IMPORTED_MODULE_0__.Position(absoluteCordinate, position.dimension),
                                recipe[schematics[y][z]](rawCoordinate)
                            ))
                        }
                return blockArray
            }(positionArray[0], option.length, directionMark, schematics, offset, recipe, [0, 1, 2, 3, 5, 4]))
            e.runtime.logger.log("verbose", "NZ IS JUJULAO")
            let transform = (function (facingAxis) {
                switch (facingAxis) {
                    case "+x": {
                        return _utils_js__WEBPACK_IMPORTED_MODULE_1__.utils.coordinateGeometry.transform(
                            (x, y, z) => x,
                            (x, y, z) => y,
                            (x, y, z) => z
                        )
                    }
                    case "-x": {
                        return _utils_js__WEBPACK_IMPORTED_MODULE_1__.utils.coordinateGeometry.transform(
                            (x, y, z) => - x,
                            (x, y, z) => y,
                            (x, y, z) => - z
                        )
                    }
                    case "+z": {
                        return _utils_js__WEBPACK_IMPORTED_MODULE_1__.utils.coordinateGeometry.transform(
                            (x, y, z) => -z,
                            (x, y, z) => y,
                            (x, y, z) => x
                        )
                    }
                    case "-z": {
                        return _utils_js__WEBPACK_IMPORTED_MODULE_1__.utils.coordinateGeometry.transform(
                            (x, y, z) => z,
                            (x, y, z) => y,
                            (x, y, z) => -x
                        )
                    }
                }
            }(directionMark))

            let fillStartCoordinate = (function () {
                let position = positionArray[0]
                let rawCoordinate = new norma_core__WEBPACK_IMPORTED_MODULE_0__.Coordinate(0, 5, -3)
                let relativeCoordinate = transform(rawCoordinate)
                let absoluteCordinate = new norma_core__WEBPACK_IMPORTED_MODULE_0__.Coordinate(
                    relativeCoordinate.x + position.coordinate.x,
                    relativeCoordinate.y + position.coordinate.y,
                    relativeCoordinate.z + position.coordinate.z,
                )
                return absoluteCordinate
            })()
            let fillEndCoordinate = (function () {
                let position = positionArray[0]
                let rawCoordinate = new norma_core__WEBPACK_IMPORTED_MODULE_0__.Coordinate(option.length - 1, 0, 3)
                let relativeCoordinate = transform(rawCoordinate)
                let absoluteCordinate = new norma_core__WEBPACK_IMPORTED_MODULE_0__.Coordinate(
                    relativeCoordinate.x + position.coordinate.x,
                    relativeCoordinate.y + position.coordinate.y,
                    relativeCoordinate.z + position.coordinate.z,
                )
                return absoluteCordinate
            })()
            e.runtime.logger.log("verbose", "NZ IS JUJUJULAO")
            blockArray.splice(0, 0, new norma_core__WEBPACK_IMPORTED_MODULE_0__.BuildInstruction("fill", {
                blockType: new norma_core__WEBPACK_IMPORTED_MODULE_0__.BlockType("minecraft:sponge", { "sponge_type": "dry" }),
                startCoordinate: fillStartCoordinate,
                endCoordinate: fillEndCoordinate
            })
            )
            return blockArray
        },
        UIHandler: function (e) { /* no-op */ },
    }
});

norma_core__WEBPACK_IMPORTED_MODULE_0__.systemInstance.registerCanonicalGenerator({
    description: new norma_core__WEBPACK_IMPORTED_MODULE_0__.Description("Construct blue ice \"railway\"",
        new norma_core__WEBPACK_IMPORTED_MODULE_0__.Usage(
            [],
            [],
            [],
            [
                {
                    viewtype: "edittext",
                    text: "Length:",
                    key: "length",
                },
                {
                    viewtype: "edittext",
                    text: "Width of the ice:",
                    key: "widthOfIce"
                }
            ]
        )
    ),
    criteria: {
        positionArrayLength: 1,
        blockTypeArrayLength: 0,
        directionArrayLength: 1,
    },
    option: {
        "length": 10,
        "useGlass": false,
        "widthOfIce": 2
    },
    method: {
        generate: function (e) {
            let { state, runtime } = e;
            let { logger } = runtime;
            logger && logger.log("verbose", "NZ is JULAO!")

            let positionArray = state.positions;
            let blockTypeArray = state.blockTypes;
            let directionArray = state.directions;
            let option = state;
            logger && logger.log("verbose", "Yes, NZ is JULAO!")

            const directionMark = _utils_js__WEBPACK_IMPORTED_MODULE_1__.utils.geometry.getDirectionMark.horizontal(directionArray[0].y)


            const materials = {
                "glass_pane": new norma_core__WEBPACK_IMPORTED_MODULE_0__.BlockType("minecraft:glass_pane", null),
                "iron_block": new norma_core__WEBPACK_IMPORTED_MODULE_0__.BlockType("minecraft:iron_block", null),
                "air": new norma_core__WEBPACK_IMPORTED_MODULE_0__.BlockType("minecraft:air", null),
                "blue_ice": new norma_core__WEBPACK_IMPORTED_MODULE_0__.BlockType("minecraft:blue_ice", null)
            }

            let schematics = [[], []]

            schematics[0].push("glass_pane")
            schematics[1].push("iron_block")

            schematics[0].push(...(new Array(option.widthOfIce)).fill("air"))
            schematics[1].push(...(new Array(option.widthOfIce)).fill("blue_ice"))

            schematics[0].push("glass_pane")
            schematics[1].push("iron_block")

            let offset = { x: 0, y: -1, z: Math.ceil(option.widthOfIce / 2) }
            //Assuming the building is in +x direction.
            const recipe = {
                "glass_pane": (coordinate) => materials["glass_pane"],
                "iron_block": (coordinate) => materials["iron_block"],
                "air": (coordinate) => materials["air"],
                "blue_ice": (coordinate) => materials["blue_ice"]
            }
            let blockArray = (function (position, length, directionMark, schematics, offset, recipe, y_sequence) {
                let blockArray = []
                if (y_sequence == undefined) {
                    y_sequence = new Array(schematics.length)
                    for (let i = 0; i < schematics.length; i++) y_sequence[i] = i
                }
                let transform = (function (facingAxis) {
                    switch (facingAxis) {
                        case "+x": {
                            return _utils_js__WEBPACK_IMPORTED_MODULE_1__.utils.coordinateGeometry.transform(
                                (x, y, z) => x,
                                (x, y, z) => y,
                                (x, y, z) => z
                            )
                        }
                        case "-x": {
                            return _utils_js__WEBPACK_IMPORTED_MODULE_1__.utils.coordinateGeometry.transform(
                                (x, y, z) => - x,
                                (x, y, z) => y,
                                (x, y, z) => - z
                            )
                        }
                        case "+z": {
                            return _utils_js__WEBPACK_IMPORTED_MODULE_1__.utils.coordinateGeometry.transform(
                                (x, y, z) => -z,
                                (x, y, z) => y,
                                (x, y, z) => x
                            )
                        }
                        case "-z": {
                            return _utils_js__WEBPACK_IMPORTED_MODULE_1__.utils.coordinateGeometry.transform(
                                (x, y, z) => z,
                                (x, y, z) => y,
                                (x, y, z) => -x
                            )
                        }
                    }
                }(directionMark))
                for (let x = 0; x < length; x++)
                    for (let y of y_sequence)
                        for (let z = 0; z < schematics[y].length; z++) {
                            let rawCoordinate = new norma_core__WEBPACK_IMPORTED_MODULE_0__.Coordinate(x - offset.x, -y - offset.y, z - offset.z)

                            let relativeCoordinate = transform(rawCoordinate)
                            let absoluteCordinate = new norma_core__WEBPACK_IMPORTED_MODULE_0__.Coordinate(
                                relativeCoordinate.x + position.coordinate.x,
                                relativeCoordinate.y + position.coordinate.y,
                                relativeCoordinate.z + position.coordinate.z,
                            )
                            blockArray.push(new norma_core__WEBPACK_IMPORTED_MODULE_0__.Block(
                                new norma_core__WEBPACK_IMPORTED_MODULE_0__.Position(absoluteCordinate, position.dimension),
                                recipe[schematics[y][z]](rawCoordinate)
                            ))
                        }
                return blockArray
            }(positionArray[0], option.length, directionMark, schematics, offset, recipe))



            return blockArray
        },
        UIHandler: function (e) { /* no-op */ },
    }
});

// system.registerCanonicalGenerator({
//     description: new Description("Record structure", new Usage([], [], [], [])),
//     criteria: { positionArrayLength: 3, blockTypeArrayLength: 0, directionArrayLength: 0 },
//     option: {},
//     method: {
//         UIHandler: function () { }, generate: function (e) {
//             let { state } = e;
//             return new BuildInstruction("writeBuildingStructureToLog", {
//                 startCoordinate: state.positions[0].coordinate,
//                 endCoordinate: state.positions[1].coordinate,
//                 referenceCoordinate: state.positions[2].coordinate,
//                 dimension: state.positions[2].dimension
//             })
//         }
//     }
// });

// system.registerCanonicalGenerator({
//     description: new Description(" aspdf vhfdwvgcmfs", new Usage([], [], [], [])),
//     criteria: { positionArrayLength: 1, blockTypeArrayLength: 0, directionArrayLength: 0 },
//     option: {},
//     method: {
//         generate: function (e) {
//             let { state } = e;
//             let coordinate = state.positions[0].coordinate

//             return Array.from(preset.presetBuildings.subway_station, a => new Block(new Position(new Coordinate(
//                 coordinate.x + a.coordinate.x, coordinate.y + a.coordinate.y, coordinate.z + a.coordinate.z
//             ), state.positions[0].dimension), a.blockType))

//         }
//     }
// });


/***/ }),
/* 7 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "utils": () => (/* binding */ utils)
/* harmony export */ });
/* harmony import */ var norma_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2);
/* harmony import */ var norma_core__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(norma_core__WEBPACK_IMPORTED_MODULE_0__);
// eslint-disable-next-line no-unused-vars

const blockDirectionTable = {
	"huge_mushroom_bits": {
		"default": {
			"none": 0,
			"-x+y-z": 1,
			"+y-z": 2,
			"+x+y-z": 3,
			"-x+y": 4,
			"+y": 5,
			"+x+y": 6,
			"-x+y+z": 7,
			"+y+z": 8,
			"+x+y+z": 9,
			"+y-y": 10,
			"null": 11,
			"nil": 12,
			"NaN": 13,
			"all": 14,
			"stem": 15
		}
	},
	"pillar_axis": {
		"default": {
			"+x": "x",
			"-x": "x",
			"+y": "y",
			"-y": "y",
			"+z": "z",
			"-z": "z"
		}
	},
	"axis": {
		"default": {
			"+x": "x",
			"-x": "x",
			"+z": "z",
			"-z": "z"
		}
	},
	"facing_direction": {
		"default": {
			"+x": 5,
			"-x": 4,
			"+y": 1,
			"-y": 0,
			"+z": 3,
			"-z": 2
		}
	},
	"direction": {
		"minecraft:bed": {
			"+x": 3,
			"-x": 1,
			"+z": 0,
			"-z": 2
		},
		"minecraft:wooden_door": {
			"+x": 0,
			"-x": 1,
			"+z": 2,
			"-z": 3
		},
		"minecraft:iron_door": {
			"+x": 0,
			"-x": 1,
			"+z": 2,
			"-z": 3
		},
		"minecraft:lit_pumpkin": {
			"+x": 3,
			"-x": 1,
			"+z": 0,
			"-z": 2
		},
		"minecraft:trapdoor": {
			"+x": 0,
			"-x": 1,
			"+z": 2,
			"-z": 3
		},
		"minecraft:fence_gate": {
			"+x": 3,
			"-x": 1,
			"+z": 0,
			"-z": 2
		},
		"minecraft:end_portal_frame": {
			"+x": 3,
			"-x": 1,
			"+z": 0,
			"-z": 2
		},
		"minecraft:cocoa": {
			"+x": 3,
			"-x": 1,
			"+z": 0,
			"-z": 2
		},
		"minecraft:tripwire_hook": {
			"+x": 3,
			"-x": 1,
			"+z": 0,
			"-z": 2
		},
		"minecraft:anvil": {
			"+x": 2,
			"-x": 0,
			"+z": 3,
			"-z": 1
		},
		"minecraft:unpowered_repeater": {
			"+x": 3,
			"-x": 1,
			"+z": 0,
			"-z": 2
		},
		"minecraft:powered_repeater": {
			"+x": 3,
			"-x": 1,
			"+z": 0,
			"-z": 2
		},
		"minecraft:unpowered_comparator": {
			"+x": 3,
			"-x": 1,
			"+z": 0,
			"-z": 2
		},
		"minecraft:powered_comparator": {
			"+x": 3,
			"-x": 1,
			"+z": 0,
			"-z": 2
		},
		"minecraft:iron_trapdoor": {
			"+x": 0,
			"-x": 1,
			"+z": 2,
			"-z": 3
		},
		"minecraft:spruce_fence_gate": {
			"+x": 3,
			"-x": 1,
			"+z": 0,
			"-z": 2
		},
		"minecraft:birch_fence_gate": {
			"+x": 3,
			"-x": 1,
			"+z": 0,
			"-z": 2
		},
		"minecraft:jungle_fence_gate": {
			"+x": 3,
			"-x": 1,
			"+z": 0,
			"-z": 2
		},
		"minecraft:dark_oak_fence_gate": {
			"+x": 3,
			"-x": 1,
			"+z": 0,
			"-z": 2
		},
		"minecraft:acacia_fence_gate": {
			"+x": 3,
			"-x": 1,
			"+z": 0,
			"-z": 2
		},
		"minecraft:spruce_door": {
			"+x": 0,
			"-x": 1,
			"+z": 2,
			"-z": 3
		},
		"minecraft:birch_door": {
			"+x": 0,
			"-x": 1,
			"+z": 2,
			"-z": 3
		},
		"minecraft:jungle_door": {
			"+x": 0,
			"-x": 1,
			"+z": 2,
			"-z": 3
		},
		"minecraft:acacia_door": {
			"+x": 0,
			"-x": 1,
			"+z": 2,
			"-z": 3
		},
		"minecraft:dark_oak_door": {
			"+x": 0,
			"-x": 1,
			"+z": 2,
			"-z": 3
		},
		"minecraft:acacia_trapdoor": {
			"+x": 0,
			"-x": 1,
			"+z": 2,
			"-z": 3
		},
		"minecraft:birch_trapdoor": {
			"+x": 0,
			"-x": 1,
			"+z": 2,
			"-z": 3
		},
		"minecraft:dark_oak_trapdoor": {
			"+x": 0,
			"-x": 1,
			"+z": 2,
			"-z": 3
		},
		"minecraft:jungle_trapdoor": {
			"+x": 0,
			"-x": 1,
			"+z": 2,
			"-z": 3
		},
		"minecraft:spruce_trapdoor": {
			"+x": 0,
			"-x": 1,
			"+z": 2,
			"-z": 3
		},
		"minecraft:carved_pumpkin": {
			"+x": 3,
			"-x": 1,
			"+z": 0,
			"-z": 2
		},
		"minecraft:pumpkin": {
			"+x": 3,
			"-x": 1,
			"+z": 0,
			"-z": 2
		},
		"minecraft:lectern": {
			"+x": 3,
			"-x": 1,
			"+z": 0,
			"-z": 2
		},
		"minecraft:grindstone": {
			"+x": 3,
			"-x": 1,
			"+z": 0,
			"-z": 2
		},
		"minecraft:loom": {
			"+x": 3,
			"-x": 1,
			"+z": 0,
			"-z": 2
		},
		"minecraft:bell": {
			"+x": 3,
			"-x": 1,
			"+z": 0,
			"-z": 2
		},
		"minecraft:campfire": {
			"+x": 3,
			"-x": 1,
			"+z": 0,
			"-z": 2
		},
		"default": {
			"+x": 3,
			"-x": 1,
			"+z": 0,
			"-z": 2
		}
	},
	"ground_sign_direction": {
		"default": {
			"0": 0,
			"22.5": 1,
			"45": 2,
			"67.5": 3,
			"90": 4,
			"112.5": 5,
			"135": 6,
			"157.5": 7,
			"180": 8,
			"-157.5": 9,
			"-135": 10,
			"-112.5": 11,
			"-90": 12,
			"-67.5": 13,
			"-45": 14,
			"-22.5": 15
		}
	},
	"rail_direction": {
		"default": {
			"x": 0,
			"z": 1,
			"+x": 2,
			"-x": 3,
			"+z": 5,
			"-z": 4
		}
	},
	"torch_facing_direction": {
		"default": {
			"-x": "west",
			"+x": "east",
			"-z": "north",
			"+z": "south",
			"y": "top"
		}
	},
	"weirdo_direction": {
		"default": {
			"+x": 0,
			"-x": 1,
			"+z": 2,
			"-z": 3
		}
	},
	"lever_direction": {
		"default": {
			"x-y": "down_east_west",
			"+x": "east",
			"-x": "west",
			"+z": "south",
			"-z": "north",
			"z+y": "up_north_south",
			"x+y": "up_east_west",
			"z-y": "down_north_south"
		}
	},
	"portal_axis": {
		"default": {
			"+x": "x",
			"-x": "x",
			"+z": "z",
			"-z": "z"
		}
	},
	"vine_direction_bits": {
		"default": {
			"NZ IS JULAO": 0,
			"+z": 1,
			"-x": 2,
			"-x+z": 3,
			"-z": 4,
			"+z-z": 5,
			"-x-z": 6,
			"-x+z-z": 7,
			"+x": 8,
			"+x+z": 9,
			"+x-x": 10,
			"+x-x+z": 11,
			"+x-z": 12,
			"+x+z-z": 13,
			"+x-x-z": 14,
			"+x-x+z-z": 15
		}
	}
};
let translator = {
	directionMarkToDirection: function (directionMark) {
		switch (directionMark) {
			case "+x": return new norma_core__WEBPACK_IMPORTED_MODULE_0__.Direction(0, -90);
			case "-x": return new norma_core__WEBPACK_IMPORTED_MODULE_0__.Direction(0, 90);
			case "+y": return new norma_core__WEBPACK_IMPORTED_MODULE_0__.Direction(-90, 0);
			case "-y": return new norma_core__WEBPACK_IMPORTED_MODULE_0__.Direction(90, 0);
			case "+z": return new norma_core__WEBPACK_IMPORTED_MODULE_0__.Direction(0, 0);
			case "-z": return new norma_core__WEBPACK_IMPORTED_MODULE_0__.Direction(0, 180);

			case "x": return new norma_core__WEBPACK_IMPORTED_MODULE_0__.Direction(0, -90);
			case "y": return new norma_core__WEBPACK_IMPORTED_MODULE_0__.Direction(90, 0);
			case "z": return new norma_core__WEBPACK_IMPORTED_MODULE_0__.Direction(0, 0);
			default: {
				return "Ahhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh";
			}
		}
	}
};
let utils = {
	setter: {
		setLogger: function (logger) {
			utils.logger = logger
		}
	},
	misc: {
		generatePlayerIDFromUniqueID: function (uniqueID) {
			let low = uniqueID["64bit_low"] % 10000
			let high = uniqueID["64bit_high"] % 10000
			//hash function:

			return (low + high) * (low + high + 1) / 2 + high;
		}
	},
	generators: {
		canonical: {
			addFunction: function (type, data, target) {
				let indexOfVacancy = target.indexOf(undefined)
				if (indexOfVacancy == -1) utils.logger.log("warning", `Too many ${type}s!New one is ignored`)
				else {
					target[indexOfVacancy] = data
					utils.logger.log("info", `New ${type} accepted.`)
				}
			},
			removeFunction: function (index, target) {
				if (index === undefined)
					for (index = target.length - 1; index >= 0 && target[index] == undefined; index--);
				if (index >= 0) target[index] = undefined
				utils.logger.logObject("info", target)
			},
			validateParameter: function () {
				let result = new String()
				if (this.blockTypeArray.indexOf(undefined) != -1)
					result += "Too few blockTypes!Refusing to execute.\n"
				if (this.positionArray.indexOf(undefined) != -1)
					result += "Too few positions!Refusing to execute.\n"
				if (this.directionArray.indexOf(undefined) != -1)
					result += "Too few directions!Refusing to execute."
				if (result == "") result = "success"
				else utils.logger.log("error", result)

				return result;
			},
			postGenerate: function () {
				this.positionArray.fill(undefined)
				this.blockTypeArray.fill(undefined)
				this.directionArray.fill(undefined)
			},
			//A generator that is canonical must :
			//1.have finite fixed(?) numbers of parameters, in which the arrays are initially filled with undefined. 
			//2.don't need to verifiy options.
			//3.after the generation, the generator only need to reset the array.
			generatorConstrctor: function ({
				description,
				criteria: {
					positionArrayLength,
					blockTypeArrayLength,
					directionArrayLength
				},
				option,
				method: {
					generate, UIHandler
				}
			}) {
				return new norma_core__WEBPACK_IMPORTED_MODULE_0__.Generator(
					description,
					new Array(positionArrayLength).fill(undefined),
					new Array(blockTypeArrayLength).fill(undefined),
					new Array(directionArrayLength).fill(undefined),
					option,
					function (position) { utils.generators.canonical.addFunction("position", position, this.positionArray) },
					function (blockType) { utils.generators.canonical.addFunction("block type", blockType, this.blockTypeArray) },
					function (direction) { utils.generators.canonical.addFunction("direction", direction, this.directionArray) },
					function (index) { utils.generators.canonical.removeFunction(index, this.positionArray) },
					function (index) { utils.generators.canonical.removeFunction(index, this.blockTypeArray) },
					function (index) { utils.generators.canonical.removeFunction(index, this.directionArray) },
					function () { return utils.generators.canonical.validateParameter.call(this) },
					generate,
					function () { utils.generators.canonical.postGenerate.call(this) },
					UIHandler
				)
			}
		}
	},
	geometry: {
		getDirectionMark: {
			horizontal: function (theta) {
				if (-45 <= theta && theta <= 45) return "+z"
				else if (-135 <= theta && theta <= -45) return "+x"
				else if (45 <= theta && theta <= 135) return "-x"
				else return "-z"
			}
		},
	},
	coordinateGeometry: {
		transform: function (f, g, h) {
			return (coordinate) => {
				return new norma_core__WEBPACK_IMPORTED_MODULE_0__.Coordinate(
					f(coordinate.x, coordinate.y, coordinate.z),
					g(coordinate.x, coordinate.y, coordinate.z),
					h(coordinate.x, coordinate.y, coordinate.z),
				);
			};
		},

		generateLine: function (x, y, z, t_span, constraint, t_step) {
			//TODO: t_step<0?t_span[0]>t_span[1]?
			let coordinateArray = [];

			function isRedundant(coordinateArray, newCoordinate) {
				if (coordinateArray.length == 0) return false;
				return (
					coordinateArray[coordinateArray.length - 1].x == newCoordinate.x &&
					coordinateArray[coordinateArray.length - 1].y == newCoordinate.y &&
					coordinateArray[coordinateArray.length - 1].z == newCoordinate.z
				)
			}

			if (t_step == undefined || t_step < 0.0001/* Prevent performance issue. */) t_step = 0.0001
			for (let t = t_span[0]; t <= t_span[1]; t += t_step) {
				let newCoordinate = new norma_core__WEBPACK_IMPORTED_MODULE_0__.Coordinate(Math.round(x(t)), Math.round(y(t)), Math.round(z(t)));
				if (!isRedundant(coordinateArray, newCoordinate) && constraint(newCoordinate.x, newCoordinate.y, newCoordinate.z, t)) {

					coordinateArray.push(newCoordinate);
				}
			}
			return coordinateArray;
		},
		generateLineWithTwoPoints: function (x_start, y_start, z_start, x_end, y_end, z_end) {
			let t_span = [0, 1];
			let x_coefficient = (x_end - x_start) / (t_span[1] - t_span[0]);
			let y_coefficient = (y_end - y_start) / (t_span[1] - t_span[0]);
			let z_coefficient = (z_end - z_start) / (t_span[1] - t_span[0]);
			return this.generateLine(
				(t) => { return ((t - t_span[0]) * x_coefficient + x_start); },
				(t) => { return ((t - t_span[0]) * y_coefficient + y_start); },
				(t) => { return ((t - t_span[0]) * z_coefficient + z_start); },
				t_span, (x, y, z, t) => { return true }, Math.min(x_coefficient == 0 ? t_span[1] - t_span[0] : 1 / x_coefficient, y_coefficient == 0 ? t_span[1] - t_span[0] : 1 / y_coefficient, z_coefficient == 0 ? t_span[1] - t_span[0] : 1 / z_coefficient));
		},
		generateTriangle: function (x1, y1, z1, x2, y2, z2, x3, y3, z3) {
			let coordinateArray = [];
			coordinateArray = coordinateArray.concat(this.generateLineWithTwoPoints(x1, y1, z1, x2, y2, z2))
			coordinateArray = coordinateArray.concat(this.generateLineWithTwoPoints(x2, y2, z2, x3, y3, z3))
			coordinateArray = coordinateArray.concat(this.generateLineWithTwoPoints(x3, y3, z3, x1, y1, z1))

			return coordinateArray
		},
		generateFilledPlanarTriangle: function (x1, y1, z1, x2, y2, z2, x3, y3, z3) {
			const A = (y2 - y1) * (z3 - z1) - (y3 - y1) * (z2 - z1)
			const B = -((x2 - x1) * (z3 - z1) - (x3 - x1) * (z2 - z1))
			const C = (x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1)
			const G = new norma_core__WEBPACK_IMPORTED_MODULE_0__.Coordinate((x1 + x2 + x3) / 3, (y1 + y2 + y3) / 3, (z1 + z2 + z3) / 3)
			let x_span = [Math.min(x1, x2, x3), Math.max(x1, x2, x3)]
			let y_span = [Math.min(y1, y2, y3), Math.max(y1, y2, y3)]
			let z_span = [Math.min(z1, z2, z3), Math.max(z1, z2, z3)]

			function signedDistance(x_start, y_start, x_end, y_end) {
				return (x, y) => { return (y_end - y_start) * x - (x_end - x_start) * y + x_end * y_start - x_start * y_end }
			}

			return this.generateWithConstraint(x_span, y_span, z_span, (x, y, z) => {
				return (Math.abs(A * (x - x1) + B * (y - y1) + C * (z - z1)) < Math.sqrt(A * A + B * B + C * C) / 2)
					&&
					(
						signedDistance(x1, y1, x2, y2)(x, y) * signedDistance(x1, y1, x2, y2)(G.x, G.y) >= 0 &&
						signedDistance(x1, y1, x3, y3)(x, y) * signedDistance(x1, y1, x3, y3)(G.x, G.y) >= 0 &&
						signedDistance(x2, y2, x3, y3)(x, y) * signedDistance(x2, y2, x3, y3)(G.x, G.y) >= 0 &&

						signedDistance(x1, z1, x2, z2)(x, z) * signedDistance(x1, z1, x2, z2)(G.x, G.z) >= 0 &&
						signedDistance(x1, z1, x3, z3)(x, z) * signedDistance(x1, z1, x3, z3)(G.x, G.z) >= 0 &&
						signedDistance(x2, z2, x3, z3)(x, z) * signedDistance(x2, z2, x3, z3)(G.x, G.z) >= 0 &&

						signedDistance(y1, z1, y2, z2)(y, z) * signedDistance(y1, z1, y2, z2)(G.y, G.z) >= 0 &&
						signedDistance(y1, z1, y3, z3)(y, z) * signedDistance(y1, z1, y3, z3)(G.y, G.z) >= 0 &&
						signedDistance(y2, z2, y3, z3)(y, z) * signedDistance(y2, z2, y3, z3)(G.y, G.z) >= 0
					)
			})
		},
		generateSphere: function (x, y, z, r) {
			return this.generateWithConstraint([x - r, x + r], [y - r, y + r], [z - r, z + r], (_x, _y, _z) => { return (_x - x) * (_x - x) + (_y - y) * (_y - y) + (_z - z) * (_z - z) < r * r })
		},
		generateHollowSphere: function (x, y, z, r) {
			return this.generateWithConstraint([x - r, x + r], [y - r, y + r], [z - r, z + r], (_x, _y, _z) => { return (_x - x) * (_x - x) + (_y - y) * (_y - y) + (_z - z) * (_z - z) >= (r - 1) * (r - 1) && (_x - x) * (_x - x) + (_y - y) * (_y - y) + (_z - z) * (_z - z) < r * r })
		},
		generateWithConstraint: function (x_span, y_span, z_span, constraint) {
			let coordinateArray = [];



			const x_step = 1 / 3;
			const y_step = 1 / 3;
			const z_step = 1 / 3;


			if (x_span[0] >= x_span[1])
				[x_span[0], x_span[1]] = [x_span[1], x_span[0]]

			if (y_span[0] >= y_span[1])
				[y_span[0], y_span[1]] = [y_span[1], y_span[0]]

			if (z_span[0] >= z_span[1])
				[z_span[0], z_span[1]] = [z_span[1], z_span[0]]


			function verifier(x, y, z) {
				for (let _x = Math.max(x - x_step, x_span[0]); _x <= Math.min(x + x_step, x_span[1]); _x += x_step)
					for (let _z = Math.max(z - z_step, z_span[0]); _z <= Math.min(z + z_step, z_span[1]); _z += z_step)
						for (let _y = Math.max(y - y_step, y_span[0]); _y <= Math.min(y + y_step, y_span[1]); _y += y_step)
							if (constraint(_x, _y, _z)) return true
				return false
			}

			for (let x = x_span[0]; x <= x_span[1]; x += 1)
				for (let z = z_span[0]; z <= z_span[1]; z += 1)
					for (let y = y_span[0]; y <= y_span[1]; y += 1)
						if (verifier(x, y, z))
							coordinateArray.push(new norma_core__WEBPACK_IMPORTED_MODULE_0__.Coordinate(x, y, z))
			// function isRedundant(coordinateArray, newCoordinate) {
			// 	if (coordinateArray.length == 0) return false;
			// 	return (
			// 		coordinateArray[coordinateArray.length - 1].x == newCoordinate.x &&
			// 		coordinateArray[coordinateArray.length - 1].y == newCoordinate.y &&
			// 		coordinateArray[coordinateArray.length - 1].z == newCoordinate.z
			// 	)
			// }
			// for (let x = x_span[0]; x <= x_span[1]; x += x_step)
			// 	for (let z = z_span[0]; z <= z_span[1]; z += z_step)
			// 		for (let y = y_span[0]; y <= y_span[1]; y += y_step) 
			// 			if (constraint(x, y, z)) {
			// 				let newCoordinate = new Coordinate(Math.round(x), Math.round(y), Math.round(z))
			// 				if (!isRedundant(coordinateArray, newCoordinate))
			// 					coordinateArray.push(newCoordinate)
			// 			}



			return coordinateArray

		},
		withBresenhamAlgorithm: {
			//Shamelessly adopted from http://members.chello.at/~easyfilter/bresenham.html (
			generateLineWithTwoPoints: function (x0, y0, z0, x1, y1, z1) {
				x0 = Math.round(x0)
				y0 = Math.round(y0)
				z0 = Math.round(z0)
				x1 = Math.round(x1)
				y1 = Math.round(y1)
				z1 = Math.round(z1)
				let coordinateArray = []
				let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
				let dy = Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
				let dz = Math.abs(z1 - z0), sz = z0 < z1 ? 1 : -1;
				let dm = Math.max(dx, dy, dz), i = dm;
				x1 = y1 = z1 = Math.floor(dm / 2);

				for (; ;) {
					coordinateArray.push(new norma_core__WEBPACK_IMPORTED_MODULE_0__.Coordinate(x0, y0, z0));
					if (i-- == 0) break;
					x1 -= dx; if (x1 < 0) { x1 += dm; x0 += sx; }
					y1 -= dy; if (y1 < 0) { y1 += dm; y0 += sy; }
					z1 -= dz; if (z1 < 0) { z1 += dm; z0 += sz; }
				}
				return coordinateArray
			},
			generate2DEllipse: function (xm, ym, a, b) {
				let coordinateArray = []
				function setPixel(x, y) {
					coordinateArray.push(new norma_core__WEBPACK_IMPORTED_MODULE_0__.Coordinate(x, y, 0))
				}
				var x = -a, y = 0;           /* II. quadrant from bottom left to top right */
				var e2, dx = (1 + 2 * x) * b * b;                              /* error increment  */
				var dy = x * x, err = dx + dy;                              /* error of 1.step */

				do {
					setPixel(xm - x, ym + y);                                 /*   I. Quadrant */
					setPixel(xm + x, ym + y);                                 /*  II. Quadrant */
					setPixel(xm + x, ym - y);                                 /* III. Quadrant */
					setPixel(xm - x, ym - y);                                 /*  IV. Quadrant */
					e2 = 2 * err;
					if (e2 >= dx) { x++; err += dx += 2 * b * b; }                   /* x step */
					if (e2 <= dy) { y++; err += dy += 2 * a * a; }                   /* y step */
				} while (x <= 0);

				while (y++ < b) {            /* too early stop for flat ellipses with a=1, */
					setPixel(xm, ym + y);                        /* -> finish tip of ellipse */
					setPixel(xm, ym - y);
				}
				return coordinateArray
			},

			generate2DCircle: function (xm, ym, r) {
				let coordinateArray = []
				function setPixel(x, y) {
					coordinateArray.push(new norma_core__WEBPACK_IMPORTED_MODULE_0__.Coordinate(x, y, 0))
				}
				var x = -r, y = 0, err = 2 - 2 * r;                /* bottom left to top right */
				do {
					setPixel(xm - x, ym + y);                            /*   I. Quadrant +x +y */
					setPixel(xm - y, ym - x);                            /*  II. Quadrant -x +y */
					setPixel(xm + x, ym - y);                            /* III. Quadrant -x -y */
					setPixel(xm + y, ym + x);                            /*  IV. Quadrant +x -y */
					r = err;
					if (r <= y) err += ++y * 2 + 1;                                   /* y step */
					if (r > x || err > y) err += ++x * 2 + 1;                         /* x step */
				} while (x < 0);
				return coordinateArray
			},

			//Unsatisfactory. Will cause holes.
			generateFilledPlanarTriangle: function (x1, y1, z1, x2, y2, z2, x3, y3, z3) {
				let coordinateSet = new Set()
				let generateLine = this.generateLine
				generateLine(x2, y2, z2, x3, y3, z3).forEach(({ x, y, z }) => { generateLine(x1, y1, z1, x, y, z).forEach((coordinate) => { coordinateSet.add(coordinate) }) })
				return coordinateSet.values()
			},
			generateEllipseRect: function (x0, y0, x1, y1) {                              /* rectangular parameter enclosing the ellipse */
				var a = Math.abs(x1 - x0), b = Math.abs(y1 - y0), b1 = b & 1;        /* diameter */
				var dx = 4 * (1.0 - a) * b * b, dy = 4 * (b1 + 1) * a * a;              /* error increment */
				var err = dx + dy + b1 * a * a, e2;                             /* error of 1.step */

				if (x0 > x1) { x0 = x1; x1 += a; }        /* if called with swapped points */
				if (y0 > y1) y0 = y1;                                  /* .. exchange them */
				y0 += (b + 1) >> 1; y1 = y0 - b1;                              /* starting pixel */
				a = 8 * a * a; b1 = 8 * b * b;

				do {
					setPixel(x1, y0);                                      /*   I. Quadrant */
					setPixel(x0, y0);                                      /*  II. Quadrant */
					setPixel(x0, y1);                                      /* III. Quadrant */
					setPixel(x1, y1);                                      /*  IV. Quadrant */
					e2 = 2 * err;
					if (e2 <= dy) { y0++; y1--; err += dy += a; }                 /* y step */
					if (e2 >= dx || 2 * err > dy) { x0++; x1--; err += dx += b1; }       /* x */
				} while (x0 <= x1);

				while (y0 - y1 <= b) {                /* too early stop of flat ellipses a=1 */
					setPixel(x0 - 1, y0);                         /* -> finish tip of ellipse */
					setPixel(x1 + 1, y0++);
					setPixel(x0 - 1, y1);
					setPixel(x1 + 1, y1--);
				}
			}

		}

	},
	blockGeometry: {
		hasBlockDirection: function (blockType) {
			let directionRelatedBlockStateKey = (function () {
				//The following function decides which specific key controls how the block rotates, if it exists.
				//It is based on the fact that, only one blockState will decide how.
				//Hope it won't change.
				for (let blockStateKey in blockType.blockState)
					if (blockDirectionTable[blockStateKey] != undefined) return blockStateKey;
				return "";
			}())
			return directionRelatedBlockStateKey != ""
		},
		getBlockDirection: function (blockType) {
			let directionRelatedBlockStateKey = (function () {
				//The following function decides which specific key controls how the block rotates, if it exists.
				//It is based on the fact that, only one blockState will decide how.
				//Hope it won't change.
				for (let blockStateKey in blockType.blockState)
					if (blockDirectionTable[blockStateKey] != undefined) return blockStateKey;
				return "";
			}());
			let directionMap = (function () {
				if (blockDirectionTable[directionRelatedBlockStateKey][blockType.blockIdentifier] == undefined)
					return blockDirectionTable[directionRelatedBlockStateKey]["default"];
				else
					return blockDirectionTable[directionRelatedBlockStateKey][blockType.blockIdentifier];
			}());
			let directionMark = (function () {
				for (let mark in directionMap)
					if (directionMap[mark] == blockType.blockState[directionRelatedBlockStateKey]) return mark;
				return "error";
			}());
			return translator.directionMarkToDirection(directionMark);
		},
		//The degree is absolute degree.
		setBlockDirection: function (blockType, directionMark) {
			//Ignoring special block that doesn't use "+x" etc for now.
			let directionRelatedBlockStateKey = (function () {
				//The following function decides which specific key controls how the block rotates, if it exists.
				//It is based on the fact that, only one blockState will decide how.
				//Hope it won't change.
				for (let blockStateKey in blockType.blockState)
					if (blockDirectionTable[blockStateKey] != undefined) return blockStateKey;
				return "";
			}());
			let directionMap = (function () {
				if (blockDirectionTable[directionRelatedBlockStateKey][blockType.blockIdentifier] == undefined)
					return blockDirectionTable[directionRelatedBlockStateKey]["default"];
				else
					return blockDirectionTable[directionRelatedBlockStateKey][blockType.blockIdentifier];
			}());
			blockType.blockState[directionRelatedBlockStateKey] = directionMap[directionMark];
			return blockType;
		},

	},
};



/***/ })
/******/ ]);
/************************************************************************/
/******/ // The module cache
/******/ var __webpack_module_cache__ = {};
/******/ 
/******/ // The require function
/******/ function __webpack_require__(moduleId) {
/******/ 	// Check if module is in cache
/******/ 	var cachedModule = __webpack_module_cache__[moduleId];
/******/ 	if (cachedModule !== undefined) {
/******/ 		return cachedModule.exports;
/******/ 	}
/******/ 	// Create a new module (and put it into the cache)
/******/ 	var module = __webpack_module_cache__[moduleId] = {
/******/ 		// no module.id needed
/******/ 		// no module.loaded needed
/******/ 		exports: {}
/******/ 	};
/******/ 
/******/ 	// Execute the module function
/******/ 	__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 
/******/ 	// Return the exports of the module
/******/ 	return module.exports;
/******/ }
/******/ 
/************************************************************************/
/******/ /* webpack/runtime/compat get default export */
/******/ (() => {
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = (module) => {
/******/ 		var getter = module && module.__esModule ?
/******/ 			() => (module['default']) :
/******/ 			() => (module);
/******/ 		__webpack_require__.d(getter, { a: getter });
/******/ 		return getter;
/******/ 	};
/******/ })();
/******/ 
/******/ /* webpack/runtime/define property getters */
/******/ (() => {
/******/ 	// define getter functions for harmony exports
/******/ 	__webpack_require__.d = (exports, definition) => {
/******/ 		for(var key in definition) {
/******/ 			if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 				Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 			}
/******/ 		}
/******/ 	};
/******/ })();
/******/ 
/******/ /* webpack/runtime/hasOwnProperty shorthand */
/******/ (() => {
/******/ 	__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ })();
/******/ 
/******/ /* webpack/runtime/make namespace object */
/******/ (() => {
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = (exports) => {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/ })();
/******/ 
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var mojang_minecraft__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1);
/* harmony import */ var norma_core__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2);
/* harmony import */ var norma_core__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(norma_core__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _plugin_index_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(5);





const lastTimeOfPlayerRequest = new Map()

function assembleUseItemData(player, blockLocation) {
    let { x, y, z } = blockLocation
    let dimension = "overworld"//Currently unable to fetch the name of the dimension

    return {
        blockType: getBlock(new norma_core__WEBPACK_IMPORTED_MODULE_1__.Position(new norma_core__WEBPACK_IMPORTED_MODULE_1__.Coordinate(x, y, z), dimension)),
        position: new norma_core__WEBPACK_IMPORTED_MODULE_1__.Position({ x, y, z }, dimension),
        direction: new norma_core__WEBPACK_IMPORTED_MODULE_1__.Direction(-90 * player.viewVector.y, player.bodyRotation)
    }
}
function getBlock(position) {
    let { x, y, z } = position.coordinate
    let rawBlock = mojang_minecraft__WEBPACK_IMPORTED_MODULE_0__.world.getDimension(position.dimension).getBlock(new mojang_minecraft__WEBPACK_IMPORTED_MODULE_0__.BlockLocation(x, y, z))
    let block = new norma_core__WEBPACK_IMPORTED_MODULE_1__.BlockType(rawBlock.id, rawBlock.permutation.getAllProperties().reduce(
        (pre, cur) => Object.assign(pre, { [cur.name]: cur.value }),
        {}
    ))
    return block
}

norma_core__WEBPACK_IMPORTED_MODULE_1__.systemInstance.inject({
    createRuntime: function (id) {
        let user = norma_core__WEBPACK_IMPORTED_MODULE_1__.systemInstance.getUser(id);
        return {
            logger: loggerFactory(id),
            getBlock: getBlock
        };
    }
})

mojang_minecraft__WEBPACK_IMPORTED_MODULE_0__.world.events.blockPlace.subscribe(({ player, block, dimension }) => {
    handlePlayerRequest({ requestType: "get_block_type", playerID: player.nameTag/*No other unique identifier available.*/, additionalData: assembleUseItemData(player, block.location) })
})
mojang_minecraft__WEBPACK_IMPORTED_MODULE_0__.world.events.itemUseOn.subscribe(({ source, item, blockLocation }) => {
    if (source.id === "minecraft:player" && item.id.startsWith("normaconstructor:")) {
        handlePlayerRequest({ requestType: item.id.slice(item.id.indexOf(":") + 1), playerID: source.nameTag, additionalData: assembleUseItemData(source, blockLocation) })
    }
})

function getUser(playerID) {
    function registerNewUser(playerID) {
        let user = norma_core__WEBPACK_IMPORTED_MODULE_1__.systemInstance.createUser(playerID)
        //TODO:Separate the following initialization process from this function.
        user.session["__requestAdditionalPosition"] = false;
        user.session["__requestAdditionalBlockType"] = false;
        user.session["__requestAdditionalDirection"] = false;
        user.session["__logLevel"] = "verbose";
        user.session["__on"] = true;
        return user;
    }
    return norma_core__WEBPACK_IMPORTED_MODULE_1__.systemInstance.hasUser(playerID) ? norma_core__WEBPACK_IMPORTED_MODULE_1__.systemInstance.getUser(playerID) : registerNewUser(playerID)
}

function handlePlayerRequest({ requestType, playerID, additionalData }) {
    //Debounce.
    const last = lastTimeOfPlayerRequest.get(playerID), now = Date.now()
    lastTimeOfPlayerRequest.set(playerID, now)
    if (last && now - last < 400) return

    let user = getUser(playerID)
    const logger = loggerFactory(playerID)
    logger.log("verbose", "NZ IS JULAO!")
    logger.logObject("verbose", { requestType, playerID, additionalData })
    switch (requestType) {
        case "get_position":
        case "get_direction":
        case "get_block_type": {
            if (requestType == "get_position" || user.session["__requestAdditionalPosition"]) user.addPosition(additionalData.position)
            if (requestType == "get_direction" || user.session["__requestAdditionalDirection"]) user.addDirection(additionalData.direction)
            if (requestType == "get_block_type" || user.session["__requestAdditionalBlockType"]) user.addBlockType(additionalData.blockType)
            break;
        }
        case "get_air": {
            user.addBlockType(new norma_core__WEBPACK_IMPORTED_MODULE_1__.BlockType("minecraft:air", {}))
            break;
        }
        case "remove_last_position": {
            logger.log("info", "Removing the last position...")
            user.removePosition()
            break;
        }
        case "remove_last_blocktype": {
            logger.log("info", "Removing the last blockType...")
            user.removeBlockType()
            break;
        }
        case "remove_last_direction": {
            logger.log("info", "Removing the last direction...")
            user.removeDirection()
            break;
        }
        case "choose_next_generator": {
            logger.log("info", "Choosing next generator...")
            user.nextGenerator()
            logger.log("debug", "Current generator:")
            logger.logObject("debug", user.getCurrentGeneratorName())
            break;
        }
        case "show_saved_data": {
            //logger.log("info", "Current positionArray:")
            //logger.logObject("info", generatorArray[generatorIndex].positionArray)
            //logger.log("info", "Current blockTypeArray:")
            //logger.logObject("info", generatorArray[generatorIndex].blockTypeArray)
            //logger.log("info", "Current directionArray:")
            //logger.logObject("info", generatorArray[generatorIndex].directionArray)
            logger.log("info", "Current generator name:")
            logger.logObject("info", user.getCurrentGeneratorName())
            logger.log("info", "Current generator state:")
            logger.logObject("info", user.getCurrentState())
            logger.log("info", "Current session:")
            logger.logObject("info", user.session)
            break;
        }
        case "execute": {
            execute(playerID);
            break;
        }
        case "show_menu": {
            break;
        }
        case "show_meta_menu": {
            break;
        }
        case "run_nos": {
            user.runNOS(additionalData.nos, undefined)
            break;
        }
    }
}
mojang_minecraft__WEBPACK_IMPORTED_MODULE_0__.world.events.beforeChat.subscribe(e => {
    let logger = loggerFactory(e.sender.name);
    logger.log("debug", e.message)
    if (e.message.startsWith("nos:")) {
        e.cancel = true;
        handlePlayerRequest({ requestType: "run_nos", playerID: e.sender.name, additionalData: { nos: e.message.slice("nos:".length) } })
    }
})
let compiler = {
    raw: function (blockArray) {
        return blockArray
    },
    clone: function ({ startCoordinate, endCoordinate, targetCoordinate }) {
        if (startCoordinate.x >= endCoordinate.x) {
            let temp = startCoordinate.x
            startCoordinate.x = endCoordinate.x
            endCoordinate.x = temp
        }
        if (startCoordinate.y >= endCoordinate.y) {
            let temp = startCoordinate.y
            startCoordinate.y = endCoordinate.y
            endCoordinate.y = temp
        }
        if (startCoordinate.z >= endCoordinate.z) {
            let temp = startCoordinate.z
            startCoordinate.z = endCoordinate.z
            endCoordinate.z = temp
        }
        for (let x = startCoordinate.x; x <= endCoordinate.x; x += 32)
            for (let y = startCoordinate.y; y <= endCoordinate.y; y += 32)
                for (let z = startCoordinate.z; z <= endCoordinate.z; z += 32)
                    mojang_minecraft__WEBPACK_IMPORTED_MODULE_0__.world.getDimension("overworld").runCommand(`clone ${x} ${y} ${z} 
            ${Math.min(x + 31, endCoordinate.x)} 
            ${Math.min(y + 31, endCoordinate.y)} 
            ${Math.min(z + 31, endCoordinate.z)} 
            ${targetCoordinate.x + x - startCoordinate.x} 
            ${targetCoordinate.y + y - startCoordinate.y} 
            ${targetCoordinate.z + z - startCoordinate.z} 
            masked force`);

        return []
    },
    fill: function ({ blockType, startCoordinate, endCoordinate }) {

        if (startCoordinate.x >= endCoordinate.x) {
            let temp = startCoordinate.x
            startCoordinate.x = endCoordinate.x
            endCoordinate.x = temp
        }
        if (startCoordinate.y >= endCoordinate.y) {
            let temp = startCoordinate.y
            startCoordinate.y = endCoordinate.y
            endCoordinate.y = temp
        }
        if (startCoordinate.z >= endCoordinate.z) {
            let temp = startCoordinate.z
            startCoordinate.z = endCoordinate.z
            endCoordinate.z = temp
        }

        //Bypass the restriction of 32767 blocks
        for (let x = startCoordinate.x; x <= endCoordinate.x; x += 32)
            for (let y = startCoordinate.y; y <= endCoordinate.y; y += 32)
                for (let z = startCoordinate.z; z <= endCoordinate.z; z += 32) {
                    mojang_minecraft__WEBPACK_IMPORTED_MODULE_0__.world.getDimension("overworld").runCommand(`fill ${x} ${y} ${z} 
                    ${Math.min(x + 31, endCoordinate.x)} 
                    ${Math.min(y + 31, endCoordinate.y)} 
                    ${Math.min(z + 31, endCoordinate.z)} 
                    ${blockType.blockIdentifier.slice(blockType.blockIdentifier.indexOf(":") + 1)} 
                    [${blockType.blockState == null ? "" : JSON.stringify(blockType.blockState).slice(1, -1)}] replace`);
                }

        return []
    },
    setblockWithTiledata: function ({ x, y, z, blockIdentifier, tiledata }) {
        mojang_minecraft__WEBPACK_IMPORTED_MODULE_0__.world.getDimension("overworld").runCommand(`/setblock ${x} ${y} ${z} ${blockIdentifier.slice(blockIdentifier.indexOf(":") + 1)} ${tiledata} replace`);
        return []
    }
}

async function execute(playerID) {
    let user = getUser(playerID)
    let logger = loggerFactory(playerID);
    logger.log("info", "Start validating parameters...");
    let isVaild = await user.isValidParameter();
    if (isVaild) {
        logger.log("info", "Now Execution started.");

        let buildInstructions = await user.generate();
        if (buildInstructions === undefined) return;

        for (let buildInstruction of buildInstructions) {
            if (!buildInstruction.hasOwnProperty("type")) setBlock(buildInstruction)
            else {
                let blocks = compiler[buildInstruction.type](buildInstruction.data)
                for (let block of blocks) setBlock(block)
            }
        }
    }
}
function displayObject(object, playerID) {
    displayChat(JSON.stringify(object, null, '    '), playerID)
}
function displayChat(message, playerID) {
    if (playerID) {
        let EQO = new mojang_minecraft__WEBPACK_IMPORTED_MODULE_0__.EntityQueryOptions();
        EQO.name = playerID;
        [...(mojang_minecraft__WEBPACK_IMPORTED_MODULE_0__.world.getDimension("overworld").getPlayers(EQO))][0].runCommand(`me ${message}`)
    }
    else mojang_minecraft__WEBPACK_IMPORTED_MODULE_0__.world.getDimension("overworld").runCommand(`say ${message}`)

}

function setBlock(block) {
    let blockType = block.blockType
    let position = block.position
    let coordinate = position.coordinate
    // STILL thank you, WavePlayz!

    mojang_minecraft__WEBPACK_IMPORTED_MODULE_0__.world.getDimension("overworld").runCommand(`/setblock ${coordinate.x} ${coordinate.y} ${coordinate.z} ${blockType.blockIdentifier.slice(blockType.blockIdentifier.indexOf(":") + 1)} [${blockType.blockState == null ? "" : JSON.stringify(blockType.blockState).slice(1, -1)}] replace`);
    if (blockType.blockNBT) {
        //TODO:Warn that NBT is unsupported
    }
}
function loggerFactory(playerID) {
    return {
        displayChat, displayObject,
        log: function (level, message) {
            const colorMap = new Map([
                ["verbose", { num: 0, color: "§a" }],
                ["debug", { num: 1, color: "§6" }],
                ["info", { num: 2, color: "§b" }],
                ["warning", { num: 3, color: "§e" }],
                ["error", { num: 4, color: "§c" }],
                ["fatal", { num: 5, color: "§4" }]
            ])
            const user = getUser(playerID)
            if (colorMap.get(level).num >= colorMap.get(user.session["__logLevel"]).num)
                this.displayChat(colorMap.get(level).color + "[" + level + "]" + message, playerID)
        },
        logObject: function (level, object) {
            this.log(level, JSON.stringify(object, null, '    '))
        }
    }
}
})();

