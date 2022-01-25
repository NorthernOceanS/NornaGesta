import { world } from "mojang-minecraft";

// import './plugin/index.js';
// import { systemInstance as system, emptyPlatform, Coordinate, Position, BlockType, Direction, Block } from 'norma-core';

world.events.beforeChat.subscribe(data => {
    const nametest = data.sender.nameTag
    data.sender.runCommand("say NZ IS JULAO!")
    data.cancel=true
})
world.events.itemUseOn.subscribe(e => {
    const { x, y, z } = e.source.viewVector
    e.source.runCommand(`say ${JSON.stringify({ x, y, z })}`)
    e.source.runCommand(`say ${JSON.stringify(e.source.bodyRotation)}`)
    let rawBlock = world.getDimension("overworld").getBlock(e.blockLocation)
    
    e.source.runCommand(`say "${JSON.stringify(rawBlock.getTags())}"`)
    e.source.runCommand(`say "${JSON.stringify(rawBlock.permutation.getAllProperties())}"`)
    e.source.runCommand(`say "${JSON.stringify(rawBlock.permutation.getTags())}"`)
    e.source.runCommand(`say "${JSON.stringify(Date.now())}"`)
})

