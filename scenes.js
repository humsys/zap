// some utility functions for easily definining scenes
window.scenes = {}

function Scene(name, obj){
  scenes[name] = Object.assign(obj, Scene.utils, {type:name})
}
Scene.utils = {
  handle(event, context){
    console.log(this.type, 'handling', event)
    this.context = context
    this.playerId = context.playerId
    this.players = context.players
    this.player = context.player
    this.scene = context.player.scene
    this.task = context.player.task
    if (!this[event]) return false
    else this[event].call(this)
  },


  // tasks

  assign(role, taskType, task){
    var p = this.playerWithRole(role)
    if (!p) p = this.cast(role)
    task.is = 'new'
    task.type = taskType
    Object.assign(p, {
      DIRTY:true,
      task: task
    })
  },

  tell(role, stuff){
    stuff.text = this.interpolate(stuff.text)
    this.assign(role, 'tell', stuff)
  },

  ask(role, storeAs, q){
    this.assign(role, 'ask', {
      text: this.interpolate(q),
      storeAs: storeAs
    })
  },

  unwindLastTask(){
    if (this.task && this.task.is == 'done'){
      console.log('unwinding', this.task)
      if (this.task.type == 'ask'){
        if (this.task.answered && this.task.storeAs){
          this.player.DIRTY = true
          this.player[this.task.storeAs] = this.task.answered
        }
      }
    }
  },

  interpolate(string){
    return string.replace(/\|(\w+)\.(\w+)\|/g, (m, r, v) => {
      return this.playerWithRole(r)[v]
    })
  },


  // casting, releasing and setting nextScene

  cast(role, playerId){
    var p = this.players[playerId || this.playerId]
    p.DIRTY = true
    p.scene = {
      type: this.type,
      role: role
    }
    if (p.nextScene && p.nextScene.type == this.type) {
      delete p.nextScene
    }
    return p
  },

  release(role){
    this.route(role)
  },

  nextScene(role, nextSceneType, nextScene){
    var p = this.playerWithRole(role)
    if (!p) p = this.player
    if (!nextScene && nextSceneType) nextScene = {}
    if (nextSceneType) nextScene.type = nextSceneType
    Object.assign(p, {
      DIRTY: true,
      scene:null,
      role:null,
      task: null,
      nextScene: nextScene
    })
  },

  releaseAll(){
    Object.values(this.players).forEach(p => {
      if (this.playerIsParticipant(p)) this.release(p)
    })
  },


  // getting and testing players

  playerIsParticipant(p){
    if (!p.scene) return false
    if (p.scene.type != this.type) return false
    if (p.scene.performance && p.scene.performance != this.scene.performance) return false
    return true
  },

  playerWithRole(r){
    let allPlayers = Object.values(this.players)
    return allPlayers.find(p => {
      return this.playerIsParticipant(p) && p.scene.role == r
    })
  },

  otherAvailablePlayers(){
    let allPlayers = Object.values(this.players)
    return allPlayers.filter(p => {
      if (p == this.player || p.scene) return false
      if (p.nextScene && p.nextScene.type != this.type) return false
      return true
    })
  }
}





///////////////////////////
/// SCENES!
///


Scene('DEFAULT', {
  playerTriesToStarIn(){

    // if the player is already headed to a scene, see that they get there
    if (this.player.nextScene) {
      scenes[this.player.nextScene.type].handle('playerTriesToStarIn', this.context)

      // and if they didn't get in, don't do anything else
      return false
    }

    // if they just entered the room, route them to 'start'
    if (!this.player.started){
      this.player.started = true
      this.player.DIRTY = true
      scenes.start.handle('playerTriesToStarIn', this.context)
    }

    // otherwise, see if they can join a scene [UNUSED]
    Object.values(scenes).find(s => s.handle('playerTriesToJoin', this.context))

  }
})


Scene('start', {

  playerTriesToStarIn(){
    if (this.player.name) return this.playerTaskIsOver()
    this.ask('star', 'name', "What's your name?")
  },

  playerTaskIsOver(){
    this.unwindLastTask()
    this.nextScene('star', 'router')
  }

})



Scene('router', {

  playerTriesToStarIn(){
    this.ask('star', 'hasResearchQuestion', "Do you have a research question? (Y/N)")
  },

  playerTaskIsOver(){
    // TODO: implement Scene#decide as a utility
    this.unwindLastTask()
    var answer = this.player.hasResearchQuestion
    console.log('got answer', answer)
    if (!answer || !answer.match(/y|n/i)) return;// this.playerTriesToStarIn()
    if (answer.match(/y/i)){
      this.nextScene('star', 'researchHelp', { role: 'star' })
    } else {
      this.release('star')
    }
  }

})



Scene('researchHelp', {

  playerTriesToStarIn(){
    let support = this.otherAvailablePlayers()[0]
    if (!support) return false
    this.cast('support', support.id)
    this.tell('support', {
      text: "raise your hand. when someone approaches you, listen to their research question and recommend a book"
    })
    this.tell('star', {
      text: "think of a research question, then approach |support.name|, your research librarian, who should be raising their hand",
      timeout: 5*60*1000
    })
  },

  playerTaskIsOver(){
    if (this.scene.role == 'star'){
      this.nextScene('support', 'router' )
      this.release('star')
    }
  }

})
