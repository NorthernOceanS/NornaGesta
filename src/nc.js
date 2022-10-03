import { BlockLocation, Trigger, world } from "mojang-minecraft";
import {
    ActionFormData,
    MessageFormData,
    ModalFormData
} from "mojang-minecraft-ui"

import { systemInstance as system, emptyPlatform, Coordinate, Position, BlockType, Direction, Block } from 'norma-core';
import './plugin/index.js';

const lastTimeOfPlayerRequest = new Map()

function assembleUseItemData(player, blockLocation) {
    let { x, y, z } = blockLocation
    let dimension = "overworld"//Currently unable to fetch the name of the dimension

    return {
        blockType: getBlock(new Position(new Coordinate(x, y, z), dimension)),
        position: new Position({ x, y, z }, dimension),
        direction: new Direction(player.rotation.x, player.rotation.y)
    }
}
function getBlock(position) {
    let { x, y, z } = position.coordinate
    let rawBlock = world.getDimension(position.dimension).getBlock(new BlockLocation(x, y, z))
    let block = new BlockType(rawBlock.id, rawBlock.permutation.getAllProperties().reduce(
        (pre, cur) => Object.assign(pre, { [cur.name]: cur.value }),
        {}
    ))
    return block
}

system.inject({
    createRuntime: function (id) {
        let user = system.getUser(id);
        return {
            logger: loggerFactory(id),
            getBlock: getBlock
        };
    }
})

world.events.blockPlace.subscribe(({ player, block, dimension }) => {
    handlePlayerRequest({ requestType: "get_block_type", playerID: player.nameTag/*No other unique identifier available.*/, additionalData: assembleUseItemData(player, block.location) })
})
world.events.itemUseOn.subscribe(({ source, item, blockLocation }) => {
    if (source.id === "minecraft:player" && item.id.startsWith("normaconstructor:")) {
        handlePlayerRequest({ requestType: item.id.slice(item.id.indexOf(":") + 1), playerID: source.nameTag, additionalData: assembleUseItemData(source, blockLocation) })
    }
})

function getUser(playerID) {
    function registerNewUser(playerID) {
        let user = system.createUser(playerID)
        //TODO:Separate the following initialization process from this function.
        user.session["__requestAdditionalPosition"] = false;
        user.session["__requestAdditionalBlockType"] = false;
        user.session["__requestAdditionalDirection"] = false;
        user.session["__logLevel"] = "verbose";
        user.session["__on"] = true;
        return user;
    }
    return system.hasUser(playerID) ? system.getUser(playerID) : registerNewUser(playerID)
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
            user.addBlockType(new BlockType("minecraft:air", {}))
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
            //TODO
            let player = getPlayer(playerID)
            // player.sendModalForm("NZ IS JULAO", "Is NZ JULAO?", "YES!", "Of course!", (player, id) => {
            //     log(id)
            // })

            // let form=mc.newSimpleForm()
            // form.setTitle("title")
            // form.addButton("123")
            // form.addButton("123")
            // form.addButton("123")
            // form.addButton("123")
            // form.addButton("123")
            // form.addButton("123")
            // player.sendForm(form,()=>{})
            let user = getUser(playerID)
            let ui = user.getCurrentUI() ?? []

            let form = new ModalFormData()
            form.title(user.getCurrentGeneratorName())
            if (ui.length === 0) form.slider("UI is not available for this generator, so we just provide a slider for fun.", 0, 5, 1)
            else {
                ui.forEach(e => {
                    switch (e["viewtype"]) {
                        case "text": {
                            // form.addLabel(e.text) //TODO:
                            break;
                        }
                        case "button":
                        case "checkbox": {
                            let defaultValue = user.getCurrentState()[e.key]
                            let defaultChoice = e.data.findIndex(choice => choice.value == defaultValue)
                            form.dropdown(e.text, Array.from(e.data, choice => choice.text), defaultChoice == -1 ? 0 : defaultChoice)
                            break;
                        }
                        case "edittext": {
                            // form.addInput(e.text, "", user.getCurrentState()[e.key])
                            form.textField(e.text, `Input ${typeof user.getCurrentState()[e.key]} here`, user.getCurrentState()[e.key].toString())
                            // form.addInput(e.text,`Input number here`, user.getCurrentState()[e.key].toString())

                            break;
                        }
                    }
                });
            }
            form.show(player).then(({ formValues, isCanceled }) => {
                if (isCanceled) return
                formValues.forEach((e, i) => {
                    switch (ui[i]["viewtype"]) {
                        case "text": {
                            break;
                        }
                        case "button":
                        case "checkbox": {
                            user.getCurrentState()[ui[i].key] = ui[i].data[e].value
                            break;
                        }
                        case "edittext": {
                            // form.addInput(e.text, "", user.getCurrentState()[e.key])
                            // form.addInput(e.text,`Input ${typeof user.getCurrentState()[e.key]} here`, user.getCurrentState()[e.key].toString())
                            if (ui[i].inputType && ui[i].inputType == "string") user.getCurrentState()[ui[i].key] = e
                            else if (ui[i].inputType && ui[i].inputType == "float") user.getCurrentState()[ui[i].key] = parseFloat(e)
                            else user.getCurrentState()[ui[i].key] = parseInt(e)
                            break;
                        }
                    }
                    if (ui[i].hasOwnProperty("dataForUIHandler")) user.UIHandler(ui[i]["dataForUIHandler"])
                })

            })
            break;
        }
        case "show_meta_menu": {
            //TODO
            let player = getPlayer(playerID)
            let user = getUser(playerID)

            let form = new ModalFormData()
            form.title("Meta menu")
            form.dropdown("Choose generator:", user.getGeneratorNames(), user.getGeneratorNames().findIndex((e) => e == user.getCurrentGeneratorName()))
            form.show(player).then(({ formValues, isCanceled }) => {
                if (isCanceled) return
                user.switchGenerator(formValues[0])
            })
            break;
        }
        case "run_nos": {
            user.runNOS(additionalData.nos, undefined)
            break;
        }
    }
}
world.events.beforeChat.subscribe(e => {
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
                    world.getDimension("overworld").runCommand(`clone ${x} ${y} ${z} 
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
                    world.getDimension("overworld").runCommand(`fill ${x} ${y} ${z} 
                    ${Math.min(x + 31, endCoordinate.x)} 
                    ${Math.min(y + 31, endCoordinate.y)} 
                    ${Math.min(z + 31, endCoordinate.z)} 
                    ${blockType.blockIdentifier.slice(blockType.blockIdentifier.indexOf(":") + 1)} 
                    [${blockType.blockState == null ? "" : JSON.stringify(blockType.blockState).slice(1, -1)}] replace`);
                }

        return []
    },
    setblockWithTiledata: function ({ x, y, z, blockIdentifier, tiledata }) {
        world.getDimension("overworld").runCommand(`setblock ${x} ${y} ${z} ${blockIdentifier.slice(blockIdentifier.indexOf(":") + 1)} ${tiledata} replace`);
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

        let buildInstructions
        try {
            buildInstructions = await user.generate();
        }
        catch (e) {
            logger.logObject("error", e.message)
            logger.logObject("error", e.stack)
        }
        if (buildInstructions === undefined) return;
        // logger.logObject("verbose", buildInstructions)
        async function* throttler(buildInstructions) {
            while (buildInstructions.length > 0) {
                yield buildInstructions.splice(0, 50)
                await wait(1)
            }
        }

        for await (let buildInstructionBatch of throttler(buildInstructions)) {
            for (let buildInstruction of buildInstructionBatch) {
                logger.logObject("verbose", buildInstruction)

                try {
                    if (!buildInstruction.hasOwnProperty("type")) setBlock(buildInstruction)
                    else {
                        let blocks = compiler[buildInstruction.type](buildInstruction.data)
                        for (let block of blocks) setBlock(block)
                    }
                }
                catch (e) {
                    logger.logObject("error", e.message)
                    logger.logObject("error", e.stack)
                }
            }
        }
    }
}
function displayObject(object, playerID) {
    displayChat(JSON.stringify(object, null, '    '), playerID)
}
function displayChat(message, playerID) {
    if (playerID)
        [...(world.getDimension("overworld").getPlayers({ name: playerID }))][0].tell(message)
    else world.say(message)

}
function getPlayer(playerID) {
    return [...(world.getDimension("overworld").getPlayers({ name: playerID }))][0]
}
function setBlock(block) {
    let blockType = block.blockType
    let position = block.position
    let coordinate = position.coordinate
    // STILL thank you, WavePlayz!

    world.getDimension("overworld").runCommand(`setblock ${coordinate.x} ${coordinate.y} ${coordinate.z} ${blockType.blockIdentifier.slice(blockType.blockIdentifier.indexOf(":") + 1)} [${blockType.blockState == null ? "" : JSON.stringify(blockType.blockState).slice(1, -1)}] replace`);
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

let worldTick = 0, waitQueue = new Set()

world.events.tick.subscribe((event) => {
    worldTick = event.currentTick
    if (waitQueue.size > 0) {
        waitQueue.forEach((e) => {
            if (e.endTick >= worldTick) {
                e.resolve()
                waitQueue.delete(e)
            }
        })
    }
})

async function wait(period) {
    return new Promise((resolve, reject) => {
        waitQueue.add({
            resolve,
            endTick: worldTick + period
        })
    })
}